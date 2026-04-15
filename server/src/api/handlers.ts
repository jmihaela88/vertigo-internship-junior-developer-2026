import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import db from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import {
  generateApiKey,
  hashPassword,
  verifyPassword,
  type AuthTokenPayload,
} from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";
import { calculateUserWinnings } from "../lib/odds";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

const configuredAdminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function getRegistrationRole(email: string): "user" | "admin" {
  return configuredAdminEmails.has(email.trim().toLowerCase()) ? "admin" : "user";
}

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const role = getRegistrationRole(email);

  const newUser = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, role })
    .returning();

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    role: newUser[0].role,
    balance: newUser[0].balance,
    hasApiKey: false,
    apiKeyId: null,
    apiKeyCreatedAt: null,
    apiKeyLastUsedAt: null,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    balance: user.balance,
    hasApiKey: Boolean(user.apiKeyId),
    apiKeyId: user.apiKeyId,
    apiKeyCreatedAt: user.apiKeyCreatedAt,
    apiKeyLastUsedAt: user.apiKeyLastUsedAt,
    token,
  };
}

export async function handleGetCurrentUser({
  user,
}: {
  user: typeof usersTable.$inferSelect;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    balance: user.balance,
    hasApiKey: Boolean(user.apiKeyId),
    apiKeyId: user.apiKeyId,
    apiKeyCreatedAt: user.apiKeyCreatedAt,
    apiKeyLastUsedAt: user.apiKeyLastUsedAt,
  };
}

export async function handleGenerateApiKey({
  user,
}: {
  user: typeof usersTable.$inferSelect;
}) {
  const key = await generateApiKey();

  await db
    .update(usersTable)
    .set({
      apiKeyId: key.apiKeyId,
      apiKeyHash: key.apiKeyHash,
      apiKeyCreatedAt: key.apiKeyCreatedAt,
      apiKeyLastUsedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  return {
    apiKey: key.apiKey,
    apiKeyId: key.apiKeyId,
    apiKeyCreatedAt: key.apiKeyCreatedAt,
    hasApiKey: true,
    message: "API key generated successfully",
  };
}

export async function handleRevokeApiKey({
  user,
}: {
  user: typeof usersTable.$inferSelect;
}) {
  await db
    .update(usersTable)
    .set({
      apiKeyId: null,
      apiKeyHash: null,
      apiKeyCreatedAt: null,
      apiKeyLastUsedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  return {
    hasApiKey: false,
    message: "API key revoked successfully",
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string, page?: number, limit?: number, sortBy?: string, sortOrder?: string } }) {
  const { status, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = query;
  const offset = (page - 1) * limit;

  let orderBy;
  
  const baseQuery = db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      description: marketsTable.description,
      status: marketsTable.status,
      createdAt: marketsTable.createdAt,
      createdBy: marketsTable.createdBy,
      creatorUsername: usersTable.username,
      totalBetAmount: sql`coalesce(sum(${betsTable.amount}), 0)`.mapWith(Number).as('totalBetAmount'),
      participantsCount: sql`count(distinct ${betsTable.userId})`.mapWith(Number).as('participantsCount')
    })
    .from(marketsTable)
    .leftJoin(usersTable, eq(marketsTable.createdBy, usersTable.id))
    .leftJoin(marketOutcomesTable, eq(marketsTable.id, marketOutcomesTable.marketId))
    .leftJoin(betsTable, eq(marketOutcomesTable.id, betsTable.outcomeId))
    .where(eq(marketsTable.status, status || "active"))
    .groupBy(marketsTable.id);

  if (sortBy === 'totalBetSize') {
    orderBy = sortOrder === 'asc' ? asc(sql`totalBetAmount`) : desc(sql`totalBetAmount`);
  } else if (sortBy === 'participants') {
    orderBy = sortOrder === 'asc' ? asc(sql`participantsCount`) : desc(sql`participantsCount`);
  } else {
    orderBy = sortOrder === 'asc' ? asc(marketsTable.createdAt) : desc(marketsTable.createdAt);
  }
  
  const pagedMarkets = await baseQuery.orderBy(orderBy).limit(limit).offset(offset);

  const enrichedMarkets = await Promise.all(
    pagedMarkets.map(async (market) => {
      const outcomes = await db
        .select()
        .from(marketOutcomesTable)
        .where(eq(marketOutcomesTable.marketId, market.id))
        .orderBy(asc(marketOutcomesTable.position));

      const outcomesWithBets = await Promise.all(
          outcomes.map(async (outcome) => {
            const result = await db
                .select({ total: sql`sum(${betsTable.amount})`.mapWith(Number) })
                .from(betsTable)
                .where(eq(betsTable.outcomeId, outcome.id));
            return { ...outcome, totalBets: result[0]?.total || 0 };
          })
      );
      
      const totalMarketBets = Number(market.totalBetAmount);

      return {
        id: market.id,
        title: market.title,
        description: market.description,
        status: market.status,
        createdAt: market.createdAt, 
        creator: market.creatorUsername,
        outcomes: outcomesWithBets.map((outcome) => {
          const odds =
            totalMarketBets > 0 ? Number(((outcome.totalBets / totalMarketBets) * 100).toFixed(2)) : 0;
          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcome.totalBets,
          };
        }),
        totalMarketBets,
        participantsCount: Number(market.participantsCount)
      };
    })
  );

  return enrichedMarkets;
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    resolvedOutcomeId: market.resolvedOutcomeId,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  if (user.balance < Number(amount)) {
    set.status = 400;
    return { error: "Insufficient balance" };
  }

  const bet = await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${Number(amount)}`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    const insertedBet = await tx
      .insert(betsTable)
      .values({
        userId: user.id,
        marketId,
        outcomeId,
        amount: Number(amount),
      })
      .returning();

    return insertedBet[0];
  });

  set.status = 201;
  return {
    id: bet.id,
    userId: bet.userId,
    marketId: bet.marketId,
    outcomeId: bet.outcomeId,
    amount: bet.amount,
  };
}

export async function handleResolveMarket({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (user.role !== "admin") {
    set.status = 403;
    return { error: "Forbidden: admin access required" };
  }

  const marketId = params.id;
  const { outcomeId } = body;

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
    with: {
      outcomes: true,
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 409;
    return { error: "Only active markets can be resolved" };
  }

  const matchingOutcome = market.outcomes.find((outcome) => outcome.id === outcomeId);
  if (!matchingOutcome) {
    set.status = 400;
    return { error: "Outcome does not belong to this market" };
  }

  const marketBets = await db
    .select({
      userId: betsTable.userId,
      outcomeId: betsTable.outcomeId,
      amount: betsTable.amount,
    })
    .from(betsTable)
    .where(eq(betsTable.marketId, marketId));

  const totalPool = marketBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  const winningTotal = marketBets
    .filter((bet) => bet.outcomeId === outcomeId)
    .reduce((sum, bet) => sum + Number(bet.amount), 0);

  const payoutsByUser = new Map<number, number>();

  if (winningTotal > 0) {
    for (const bet of marketBets) {
      if (bet.outcomeId !== outcomeId) continue;
      const payout = Number(((Number(bet.amount) / winningTotal) * totalPool).toFixed(2));
      payoutsByUser.set(bet.userId, (payoutsByUser.get(bet.userId) || 0) + payout);
    }
  }

  const updatedMarket = await db.transaction(async (tx) => {
    for (const [winnerUserId, payout] of payoutsByUser.entries()) {
      await tx
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${payout}`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, winnerUserId));
    }

    const updated = await tx
      .update(marketsTable)
      .set({
        status: "resolved",
        resolvedOutcomeId: outcomeId,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      })
      .where(eq(marketsTable.id, marketId))
      .returning();

    return updated[0];
  });

  return {
    id: updatedMarket.id,
    status: updatedMarket.status,
    resolvedOutcomeId: updatedMarket.resolvedOutcomeId,
    payoutUsersCount: payoutsByUser.size,
    payoutTotal: Number(Array.from(payoutsByUser.values()).reduce((sum, value) => sum + value, 0).toFixed(2)),
    message: "Market resolved successfully",
  };
}

export async function handleArchiveMarket({
  params,
  set,
  user,
}: {
  params: { id: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  if (user.role !== "admin") {
    set.status = 403;
    return { error: "Forbidden: admin access required" };
  }

  const marketId = params.id;

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 409;
    return { error: "Only active markets can be archived" };
  }

  const marketBets = await db
    .select({ userId: betsTable.userId, amount: betsTable.amount })
    .from(betsTable)
    .where(eq(betsTable.marketId, marketId));

  const refundsByUser = new Map<number, number>();
  for (const bet of marketBets) {
    refundsByUser.set(bet.userId, (refundsByUser.get(bet.userId) || 0) + Number(bet.amount));
  }

  const archivedMarket = await db.transaction(async (tx) => {
    for (const [bettorId, refund] of refundsByUser.entries()) {
      await tx
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${refund}`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, bettorId));
    }

    const updated = await tx
      .update(marketsTable)
      .set({
        status: "archived",
        archivedBy: user.id,
        archivedAt: new Date(),
        resolvedOutcomeId: null,
        resolvedBy: null,
        resolvedAt: null,
      })
      .where(eq(marketsTable.id, marketId))
      .returning();

    return updated[0];
  });

  const refundTotal = Number(
    Array.from(refundsByUser.values())
      .reduce((sum, value) => sum + value, 0)
      .toFixed(2),
  );

  return {
    id: archivedMarket.id,
    status: archivedMarket.status,
    refundUsersCount: refundsByUser.size,
    refundTotal,
    message: "Market archived and bettors refunded",
  };
}

export async function handleGetUserBets({
  user,
  query,
}: {
  user: typeof usersTable.$inferSelect;
  query: {
    pageResolved?: number;
    limitResolved?: number;
    pageActive?: number;
    limitActive?: number;
    pageMarkets?: number;
    limitMarkets?: number;
    pageAdminResolved?: number;
    limitAdminResolved?: number;
  };
}) {
  const pageResolved = query.pageResolved || 1;
  const limitResolved = query.limitResolved || 20;
  const offsetResolved = (pageResolved - 1) * limitResolved;

  const pageActive = query.pageActive || 1;
  const limitActive = query.limitActive || 20;
  const offsetActive = (pageActive - 1) * limitActive;

  const pageMarkets = query.pageMarkets || 1;
  const limitMarkets = query.limitMarkets || 20;
  const offsetMarkets = (pageMarkets - 1) * limitMarkets;

  const pageAdminResolved = query.pageAdminResolved || 1;
  const limitAdminResolved = query.limitAdminResolved || 20;
  const offsetAdminResolved = (pageAdminResolved - 1) * limitAdminResolved;

  // 1. Get Resolved Bets
  const resolvedBets = await db
    .select({
      id: betsTable.id,
      amount: betsTable.amount,
      createdAt: betsTable.createdAt,
      marketId: marketsTable.id,
      marketTitle: marketsTable.title,
      outcomeTitle: marketOutcomesTable.title,
      status: sql<"won" | "lost">`CASE WHEN ${marketsTable.resolvedOutcomeId} = ${betsTable.outcomeId} THEN 'won' ELSE 'lost' END`,
    })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .innerJoin(marketOutcomesTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, "resolved")))
    .orderBy(desc(betsTable.createdAt))
    .limit(limitResolved)
    .offset(offsetResolved);

  const totalResolvedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, "resolved")));
  
  const totalResolved = totalResolvedResult[0]?.count || 0;

  // 2. Get Active Bets
  const activeBets = await db
    .select({
      id: betsTable.id,
      amount: betsTable.amount,
      createdAt: betsTable.createdAt,
      marketId: marketsTable.id,
      marketTitle: marketsTable.title,
      outcomeTitle: marketOutcomesTable.title,
      outcomeId: betsTable.outcomeId,
    })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .innerJoin(marketOutcomesTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, "active")))
    .orderBy(desc(betsTable.createdAt))
    .limit(limitActive)
    .offset(offsetActive);

  const totalActiveResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(and(eq(betsTable.userId, user.id), eq(marketsTable.status, "active")));
  
  const totalActive = totalActiveResult[0]?.count || 0;

  // Enrich active bets with odds
  const activeBetMarketIds = [...new Set(activeBets.map((b) => b.marketId))];

  let marketStats: Record<number, { totalMarketBets: number; outcomeBets: Record<number, number> }> = {};

  if (activeBetMarketIds.length > 0) {
    const allBetsForMarkets = await db
      .select({
        marketId: betsTable.marketId,
        outcomeId: betsTable.outcomeId,
        amount: betsTable.amount,
      })
      .from(betsTable)
      .where(inArray(betsTable.marketId, activeBetMarketIds));

    for (const bet of allBetsForMarkets) {
      if (!marketStats[bet.marketId]) {
        marketStats[bet.marketId] = { totalMarketBets: 0, outcomeBets: {} };
      }
      marketStats[bet.marketId].totalMarketBets += bet.amount;
      marketStats[bet.marketId].outcomeBets[bet.outcomeId] = (marketStats[bet.marketId].outcomeBets[bet.outcomeId] || 0) + bet.amount;
    }
  }

  const enrichedActiveBets = activeBets.map((bet) => {
    const stats = marketStats[bet.marketId];
    const totalMarketBets = stats?.totalMarketBets || 0;
    const outcomeBets = stats?.outcomeBets[bet.outcomeId] || 0;
    const odds = totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;
    
    return {
      ...bet,
      odds,
    };
  });

  const createdMarkets = await db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      description: marketsTable.description,
      status: marketsTable.status,
      createdAt: marketsTable.createdAt,
      outcomesCount: sql<number>`count(distinct ${marketOutcomesTable.id})`,
      totalMarketBets: sql<number>`coalesce(sum(${betsTable.amount}), 0)`,
      participantsCount: sql<number>`count(distinct ${betsTable.userId})`,
    })
    .from(marketsTable)
    .leftJoin(marketOutcomesTable, eq(marketsTable.id, marketOutcomesTable.marketId))
    .leftJoin(betsTable, eq(marketOutcomesTable.id, betsTable.outcomeId))
    .where(eq(marketsTable.createdBy, user.id))
    .groupBy(marketsTable.id)
    .orderBy(desc(marketsTable.createdAt))
    .limit(limitMarkets)
    .offset(offsetMarkets);

  const totalMarketsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketsTable)
    .where(eq(marketsTable.createdBy, user.id));

  const totalMarkets = totalMarketsResult[0]?.count || 0;

  let adminResolvedMarkets: Array<{
    id: number;
    title: string;
    resolvedAt: Date | null;
    winningOutcome: string | null;
    totalMarketBets: number;
    participantsCount: number;
  }> = [];

  let totalAdminResolved = 0;

  if (user.role === "admin") {
    const rows = await db
      .select({
        id: marketsTable.id,
        title: marketsTable.title,
        resolvedAt: marketsTable.resolvedAt,
        winningOutcome: marketOutcomesTable.title,
        totalMarketBets: sql<number>`coalesce(sum(${betsTable.amount}), 0)`,
        participantsCount: sql<number>`count(distinct ${betsTable.userId})`,
      })
      .from(marketsTable)
      .leftJoin(marketOutcomesTable, eq(marketsTable.resolvedOutcomeId, marketOutcomesTable.id))
      .leftJoin(betsTable, eq(marketsTable.id, betsTable.marketId))
      .where(and(eq(marketsTable.status, "resolved"), eq(marketsTable.resolvedBy, user.id)))
      .groupBy(marketsTable.id, marketOutcomesTable.title)
      .orderBy(desc(marketsTable.resolvedAt), desc(marketsTable.id))
      .limit(limitAdminResolved)
      .offset(offsetAdminResolved);

    const totalAdminResolvedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(marketsTable)
      .where(and(eq(marketsTable.status, "resolved"), eq(marketsTable.resolvedBy, user.id)));

    totalAdminResolved = totalAdminResolvedResult[0]?.count || 0;

    adminResolvedMarkets = rows.map((row) => ({
      id: row.id,
      title: row.title,
      resolvedAt: row.resolvedAt,
      winningOutcome: row.winningOutcome,
      totalMarketBets: Number(row.totalMarketBets),
      participantsCount: Number(row.participantsCount),
    }));
  }

  return {
    resolved: resolvedBets,
    active: enrichedActiveBets,
    markets: createdMarkets.map((market) => ({
      ...market,
      outcomesCount: Number(market.outcomesCount),
      totalMarketBets: Number(market.totalMarketBets),
      participantsCount: Number(market.participantsCount),
    })),
    adminResolvedMarkets,
    pagination: {
      resolved: {
        page: pageResolved,
        limit: limitResolved,
        total: totalResolved,
        totalPages: Math.ceil(totalResolved / limitResolved),
      },
      active: {
        page: pageActive,
        limit: limitActive,
        total: totalActive,
        totalPages: Math.ceil(totalActive / limitActive),
      },
      markets: {
        page: pageMarkets,
        limit: limitMarkets,
        total: totalMarkets,
        totalPages: Math.ceil(totalMarkets / limitMarkets),
      },
      adminResolvedMarkets: {
        page: pageAdminResolved,
        limit: limitAdminResolved,
        total: totalAdminResolved,
        totalPages: Math.ceil(totalAdminResolved / limitAdminResolved),
      },
    },
  };
}

export async function handleGetLeaderboard({
  query,
}: {
  query: {
    page?: number;
    limit?: number;
    username?: string;
  };
}) {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const username = query.username?.trim().toLowerCase();

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
    })
    .from(usersTable);

  const resolvedBets = await db
    .select({
      userId: betsTable.userId,
      marketId: betsTable.marketId,
      outcomeId: betsTable.outcomeId,
      amount: betsTable.amount,
      resolvedOutcomeId: marketsTable.resolvedOutcomeId,
    })
    .from(betsTable)
    .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
    .where(and(eq(marketsTable.status, "resolved"), sql`${marketsTable.resolvedOutcomeId} IS NOT NULL`));

  const winningsByUser = new Map<number, number>();

  if (resolvedBets.length > 0) {
    const resolvedMarketIds = [...new Set(resolvedBets.map((bet) => bet.marketId))];

    const totalByMarket = await db
      .select({
        marketId: betsTable.marketId,
        total: sql<number>`coalesce(sum(${betsTable.amount}), 0)`,
      })
      .from(betsTable)
      .where(inArray(betsTable.marketId, resolvedMarketIds))
      .groupBy(betsTable.marketId);

    const totalByOutcome = await db
      .select({
        outcomeId: betsTable.outcomeId,
        total: sql<number>`coalesce(sum(${betsTable.amount}), 0)`,
      })
      .from(betsTable)
      .where(inArray(betsTable.marketId, resolvedMarketIds))
      .groupBy(betsTable.outcomeId);

    const totalByMarketMap = new Map<number, number>(
      totalByMarket.map((row) => [row.marketId, Number(row.total)]),
    );
    const totalByOutcomeMap = new Map<number, number>(
      totalByOutcome.map((row) => [row.outcomeId, Number(row.total)]),
    );

    for (const bet of resolvedBets) {
      if (bet.resolvedOutcomeId === null || bet.outcomeId !== bet.resolvedOutcomeId) {
        continue;
      }

      const totalMarketBets = totalByMarketMap.get(bet.marketId) || 0;
      const winningOutcomeBets = totalByOutcomeMap.get(bet.resolvedOutcomeId) || 0;

      const winnings = calculateUserWinnings(
        Number(bet.amount),
        winningOutcomeBets,
        totalMarketBets,
      );

      winningsByUser.set(bet.userId, (winningsByUser.get(bet.userId) || 0) + winnings);
    }
  }

  const rankedUsers = users
    .map((user) => ({
      userId: user.id,
      username: user.username,
      totalWinnings: Number((winningsByUser.get(user.id) || 0).toFixed(2)),
    }))
    .sort((a, b) => {
      if (b.totalWinnings !== a.totalWinnings) {
        return b.totalWinnings - a.totalWinnings;
      }
      return a.username.localeCompare(b.username);
    });

  const rankedWithPosition = rankedUsers.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));

  const filteredEntries = username
    ? rankedWithPosition.filter((entry) => entry.username.toLowerCase().includes(username))
    : rankedWithPosition;

  const total = filteredEntries.length;

  return {
    entries: filteredEntries.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
