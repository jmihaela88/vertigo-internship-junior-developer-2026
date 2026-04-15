type Runtime = {
  process?: { env?: Record<string, string | undefined>; exit?: (code: number) => never };
  Bun?: { env?: Record<string, string | undefined>; exit?: (code: number) => never };
};

const runtime: Runtime = globalThis as unknown as Runtime;
const env = runtime.Bun?.env ?? runtime.process?.env ?? {};

const API_URL = env.API_URL || "http://localhost:4001";
const USER_EMAIL = env.USER_EMAIL || "bot.demo@vertigo.local";
const USER_PASSWORD = env.USER_PASSWORD || "botpass123";
const USERNAME_PREFIX = env.USERNAME_PREFIX || "botdemo";
const BET_AMOUNT = Number(env.BET_AMOUNT || "5");

if (!Number.isFinite(BET_AMOUNT) || BET_AMOUNT <= 0) {
  throw new Error("BET_AMOUNT must be a positive number.");
}

type JsonValue = Record<string, unknown>;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function request(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; data: JsonValue }> {
  const res = await fetch(`${API_URL}${path}`, options);

  let data: JsonValue = {};
  try {
    data = (await res.json()) as JsonValue;
  } catch {
    data = {};
  }

  return { status: res.status, data };
}

async function registerIfNeeded(email: string, password: string) {
  const username = `${USERNAME_PREFIX}-${randomSuffix()}`;
  const registerRes = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  if (registerRes.status === 201) {
    console.log(`Registered user ${email}`);
    return;
  }

  if (registerRes.status === 409) {
    console.log(`User ${email} already exists, continuing with login.`);
    return;
  }

  throw new Error(`Failed to register user: ${registerRes.status} ${JSON.stringify(registerRes.data)}`);
}

async function login(email: string, password: string): Promise<string> {
  const loginRes = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.data)}`);
  }

  const token = loginRes.data.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Login succeeded but token is missing.");
  }

  return token;
}

async function generateApiKey(token: string): Promise<string> {
  const keyRes = await request("/api/users/me/api-key", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (keyRes.status !== 200) {
    throw new Error(`API key generation failed: ${keyRes.status} ${JSON.stringify(keyRes.data)}`);
  }

  const apiKey = keyRes.data.apiKey;
  if (typeof apiKey !== "string" || !apiKey) {
    throw new Error("API key response does not contain apiKey.");
  }

  return apiKey;
}

async function createMarketWithApiKey(apiKey: string): Promise<{ id: number; firstOutcomeId: number }> {
  const title = "Bot test";
  const createRes = await request("/api/markets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      title,
      description: "Created from API key bot demo",
      outcomes: ["Yes", "No"],
    }),
  });

  if (createRes.status !== 201) {
    throw new Error(`Market creation failed: ${createRes.status} ${JSON.stringify(createRes.data)}`);
  }

  const marketId = createRes.data.id;
  const outcomes = createRes.data.outcomes;

  if (
    typeof marketId !== "number" ||
    !Array.isArray(outcomes) ||
    outcomes.length === 0 ||
    typeof outcomes[0] !== "object" ||
    outcomes[0] === null ||
    typeof (outcomes[0] as { id?: unknown }).id !== "number"
  ) {
    throw new Error(`Unexpected create market response: ${JSON.stringify(createRes.data)}`);
  }

  return { id: marketId, firstOutcomeId: (outcomes[0] as { id: number }).id };
}

async function placeBetWithApiKey(apiKey: string, marketId: number, outcomeId: number) {
  const betRes = await request(`/api/markets/${marketId}/bets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ outcomeId, amount: BET_AMOUNT }),
  });

  if (betRes.status !== 201) {
    throw new Error(`Place bet failed: ${betRes.status} ${JSON.stringify(betRes.data)}`);
  }

  return betRes.data;
}

async function viewWithApiKey(apiKey: string, marketId: number) {
  const meRes = await request("/api/users/me", {
    headers: { "x-api-key": apiKey },
  });

  const marketRes = await request(`/api/markets/${marketId}`, {
    headers: { "x-api-key": apiKey },
  });

  if (meRes.status !== 200) {
    throw new Error(`Fetch current user failed: ${meRes.status} ${JSON.stringify(meRes.data)}`);
  }

  if (marketRes.status !== 200) {
    throw new Error(`Fetch market failed: ${marketRes.status} ${JSON.stringify(marketRes.data)}`);
  }

  return { me: meRes.data, market: marketRes.data };
}

async function main() {
  console.log(`API URL: ${API_URL}`);
  console.log("1) Register (or reuse existing user)");
  await registerIfNeeded(USER_EMAIL, USER_PASSWORD);

  console.log("2) Login to get JWT token");
  const token = await login(USER_EMAIL, USER_PASSWORD);

  console.log("3) Generate API key via JWT auth");
  const apiKey = await generateApiKey(token);
  console.log(`Generated API key (copy now): ${apiKey}`);

  console.log("4) Create market using x-api-key");
  const market = await createMarketWithApiKey(apiKey);
  console.log(`Created market #${market.id} (first outcome #${market.firstOutcomeId})`);

  console.log("5) Place bet using x-api-key");
  const bet = await placeBetWithApiKey(apiKey, market.id, market.firstOutcomeId);
  console.log(`Placed bet #${String(bet.id)} with amount ${BET_AMOUNT}`);

  console.log("6) View user and market via x-api-key");
  const info = await viewWithApiKey(apiKey, market.id);
  console.log(`User: ${String(info.me.username)} (balance ${String(info.me.balance)})`);
  console.log(`Market status: ${String(info.market.status)}, total pool: ${String(info.market.totalMarketBets)}`);

  console.log("Done: API key flow works end-to-end.");
}

main().catch((error) => {
  console.error("Bot demo failed:", error);
  if (runtime.Bun?.exit) {
    runtime.Bun.exit(1);
  }
  if (runtime.process?.exit) {
    runtime.process.exit(1);
  }
  throw error;
});
