import { describe, it, expect, beforeAll } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq } from "drizzle-orm";
import { app } from "../index";
import db from "../src/db";
import { usersTable } from "../src/db/schema";

const BASE = "http://localhost";

// Shared state across tests (populated by earlier tests, consumed by later ones)
let authToken: string;
let userId: number;
let adminToken: string;
let adminUserId: number;
let marketId: number;
let outcomeId: number;

beforeAll(async () => {
  // Run migrations to create tables on the in-memory DB
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("Auth", () => {
  const username = "testuser";
  const email = "test@example.com";
  const password = "testpass123";

  it("POST /api/auth/register — creates a new user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.id).toBeDefined();
    expect(data.username).toBe(username);
    expect(data.email).toBe(email);
    expect(data.token).toBeDefined();

    authToken = data.token;
    userId = data.id;
  });

  it("POST /api/auth/register — rejects duplicate user", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it("POST /api/auth/register — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ab", email: "bad", password: "12" }),
      }),
    );

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("POST /api/auth/login — logs in with valid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.id).toBe(userId);
    expect(data.token).toBeDefined();
  });

  it("POST /api/auth/login — rejects invalid credentials", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
      }),
    );

    expect(res.status).toBe(401);
  });
});

describe("Markets", () => {
  it("POST /api/markets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test market",
          outcomes: ["Yes", "No"],
        }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets — creates a market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: "Will it rain tomorrow?",
          description: "Weather prediction",
          outcomes: ["Yes", "No"],
        }),
      }),
    );

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.outcomes).toHaveLength(2);

    marketId = data.id;
    outcomeId = data.outcomes[0].id;
  });

  it("POST /api/markets — validates input", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title: "Hi", outcomes: ["Only one"] }),
      }),
    );

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("GET /api/markets — lists markets", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets`));

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBeDefined();
    expect(data[0].title).toBeDefined();
    expect(data[0].outcomes).toBeDefined();
  });

  it("GET /api/markets/:id — returns market detail", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/${marketId}`));

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.id).toBe(marketId);
    expect(data.title).toBe("Will it rain tomorrow?");
    expect(data.description).toBe("Weather prediction");
    expect(data.outcomes).toHaveLength(2);
  });

  it("GET /api/markets/:id — 404 for nonexistent market", async () => {
    const res = await app.handle(new Request(`${BASE}/api/markets/99999`));

    expect(res.status).toBe(404);
  });
});

describe("Bets", () => {
  it("POST /api/markets/:id/bets — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId, amount: 100 }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets/:id/bets — places a bet", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: 50 }),
      }),
    );

    expect(res.status).toBe(201);
    const data: any = await res.json();
    expect(data.id).toBeDefined();
    expect(data.userId).toBe(userId);
    expect(data.marketId).toBe(marketId);
    expect(data.outcomeId).toBe(outcomeId);
    expect(data.amount).toBe(50);
  });

  it("POST /api/markets/:id/bets — validates amount", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/bets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId, amount: -10 }),
      }),
    );

    expect(res.status).toBe(400);
    const data: any = await res.json();
    expect(data.errors.length).toBeGreaterThan(0);
  });
});

describe("Admin Market Resolution", () => {
  it("creates an admin account", async () => {
    const adminEmail = "admin@example.com";
    const adminPassword = "adminpass123";

    const registerRes = await app.handle(
      new Request(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "adminuser",
          email: adminEmail,
          password: adminPassword,
        }),
      }),
    );

    expect(registerRes.status).toBe(201);
    const registerData: any = await registerRes.json();
    adminUserId = registerData.id;

    await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, adminUserId));

    const loginRes = await app.handle(
      new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      }),
    );

    expect(loginRes.status).toBe(200);
    const loginData: any = await loginRes.json();
    expect(loginData.role).toBe("admin");
    adminToken = loginData.token;
  });

  it("POST /api/markets/:id/resolve — requires auth", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeId }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/markets/:id/resolve — blocks non-admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ outcomeId }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST /api/markets/:id/resolve — validates outcome belongs to market", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ outcomeId: 999999 }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("POST /api/markets/:id/resolve — resolves active market for admin", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ outcomeId }),
      }),
    );

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.status).toBe("resolved");
    expect(data.resolvedOutcomeId).toBe(outcomeId);
  });

  it("POST /api/markets/:id/resolve — prevents resolving twice", async () => {
    const res = await app.handle(
      new Request(`${BASE}/api/markets/${marketId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ outcomeId }),
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe("Leaderboard", () => {
  it("GET /api/users/leaderboard — returns paginated ranked users", async () => {
    const res = await app.handle(new Request(`${BASE}/api/users/leaderboard?page=1&limit=20`));

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(20);
    expect(typeof data.pagination.total).toBe("number");
    expect(typeof data.pagination.totalPages).toBe("number");

    if (data.entries.length > 0) {
      expect(data.entries[0].userId).toBeDefined();
      expect(data.entries[0].username).toBeDefined();
      expect(typeof data.entries[0].totalWinnings).toBe("number");
    }
  });
});

describe("Error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.handle(new Request(`${BASE}/nonexistent`));

    expect(res.status).toBe(404);
    const data: any = await res.json();
    expect(data.error).toBe("Not found");
  });
});
