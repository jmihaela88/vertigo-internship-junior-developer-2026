---
description: Prediction Markets API Server - Bun + Elysia + SQLite + Drizzle
globs: "src/**/*.ts, index.ts, test.spec.ts, package.json"
alwaysApply: true
---

# Prediction Markets Server - Agent Guidelines

## Project Overview

This is a Bun-based REST API server for a prediction markets platform. It handles user authentication, market creation, and betting functionality.

**Tech Stack:**

- **Runtime**: Bun (not Node.js)
- **Framework**: Elysia (with @elysiajs/cors)
- **Database**: SQLite with Drizzle ORM
- **Testing**: Bun's built-in test framework

## Key Commands

### Development

- `bun run dev` - Start hot-reload server on http://localhost:4001
- `bun test` - Run all tests in `*.test.ts` files
- `bun reset-password.ts <email|id>` - Reset user password and generate new one
- `bun run lint` - Run the linter
- `bun run lint:fix` - To apply possible fixes reported by the linter
- `bun run format` - To format the code

### Database

- `bun src/db/migrate.ts` - Run pending migrations
- `bun src/db/seed.ts` - Seed database with sample data
- `bunx drizzle-kit studio` - Open Drizzle Studio UI on http://localhost:5555

### Building

- `bun build index.ts` - Build production bundle

## Project Structure

```
src/
├── api/
│   ├── handlers.ts            # Route handler functions (Elysia context style)
│   ├── auth.routes.ts         # Auth route group (/api/auth)
│   └── markets.routes.ts      # Markets route group (/api/markets) with auth guard
├── db/
│   ├── schema.ts              # Drizzle schema definitions
│   ├── index.ts               # Database connection
│   ├── migrate.ts             # Migration runner
│   └── seed.ts                # Sample data seeding
├── lib/
│   ├── auth.ts                # Password hashing & auth payload helpers
│   ├── validation.ts          # Input validation for requests
│   └── odds.ts                # Odds calculation logic
├── plugins/
│   └── jwt.ts                 # Elysia JWT plugin configuration
└── middleware/
    └── auth.middleware.ts      # Elysia derive plugin for Bearer token auth

index.ts                        # Main server entry point (Elysia app)
reset-password.ts               # Password reset utility
```

## API Routes

All endpoints at `http://localhost:4001`:

### Authentication (`src/api/auth.routes.ts`)

- `POST /api/auth/register` - Register new user → `201`
- `POST /api/auth/login` - Login user → `200`

### Markets (`src/api/markets.routes.ts`)

- `GET /api/markets?status=active|resolved|archived` - List markets → `200`
- `POST /api/markets` - Create market (auth required) → `201`
- `GET /api/markets/:id` - Get market details → `200`
- `POST /api/markets/:id/resolve` - **Resolve market with winning outcome (admin auth required)** → `200` / `403 Forbidden`
- `POST /api/markets/:id/archive` - **Archive market and refund all bettors (admin auth required)** → `200` / `403 Forbidden`

### Bets

- `POST /api/markets/:id/bets` - Place bet (auth required) → `201`

### Users

- `GET /api/users/:id/bets?type=active|resolved` - Get user bets (auth required) → `200`
- `GET /api/users/:id/resolved-markets` - **Get markets resolved by user (admin only)** → `200`
- `GET /api/leaderboard` - Get global leaderboard (public) → `200`

## Admin Authentication

**Admin Status**: Determined by `ADMIN_EMAILS` environment variable at user registration time
- Example: `ADMIN_EMAILS=admin@vertigo.local,admin2@company.com`
- Admin role assigned during registration if user's email matches configured admin emails

**Admin-Only Endpoints** (require valid JWT + role='admin'):
- `POST /api/markets/:id/resolve` - Marks market as resolved, calculates proportional payouts to winners
- `POST /api/markets/:id/archive` - Marks market as archived, refunds all bettors 100% of their bet amounts
- `GET /api/users/:id/resolved-markets` - Retrieves markets resolved by the specified admin user

**Response on Unauthorized Access**: Returns `403 Forbidden` with error message if non-admin user attempts admin endpoint

**CORS**: Enabled for `*` origin with headers `Content-Type, Authorization`

## Database Schema

**Users Table**

- `id` (PK), `username` (unique), `email` (unique), `passwordHash`, `createdAt`

**Markets Table**

- `id` (PK), `title`, `description`, `status` (active|resolved), `createdBy` (FK users), `createdAt`

**Market Outcomes Table**

- `id` (PK), `marketId` (FK), `title`, `position` (for ordering)

**Bets Table**

- `id` (PK), `userId` (FK), `marketId` (FK), `outcomeId` (FK), `amount`, `createdAt`

## Validation Rules

### Registration

- Username: min 3 chars
- Email: valid format (xxx@xxx.xxx)
- Password: min 6 chars

### Login

- Email required
- Password required

### Market Creation

- Title required
- At least 2 outcomes required
- Each outcome min 1 char

### Betting

- Amount required (must be > 0)
- Market must be active
- Outcome must belong to the market

## Authentication

Tokens are JWTs signed with `@elysiajs/jwt` and include `userId`.

Pass token in header:

```
Authorization: Bearer <token>
```

## Common Patterns

### Handler Structure (Elysia context style)

```ts
export async function handleSomething({ body, params, set, user }) {
  // body/params/query auto-parsed by Elysia schemas
  // user injected by auth middleware derive
  // Validation → DB query → return object (auto-serialized)
  set.status = 201;
  return { id, ...fields };
}
```

### Auth Guard

Protected routes use Elysia `guard` with `beforeHandle` that checks `user` from auth middleware:

```ts
.guard({
  beforeHandle({ user, set }) {
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
  }
}, (app) => app.post("/", protectedHandler))
```

### Response Format

- Success: `{ id, ...fields }` with status 200/201
- Validation Error: `{ errors: [{ field, message }] }` with status 400
- Auth Error: `{ error: "Unauthorized" }` with status 401
- Not Found: `{ error: "X not found" }` with status 404

## Testing

Run with: `bun test`

Test file: `test.spec.ts`

All tests verify:

- Register endpoint accepts valid input
- Login endpoint requires valid credentials
- Market listing returns market data
- Market detail retrieval works
- Bet placement requires authentication
- Unauthorized requests are rejected

## Development Tips

1. **Hot reload**: Use `bun run dev` (--hot flag in index.ts)
2. **Database changes**: Update schema.ts, then run `bun src/db/migrate.ts`
3. **Environment**: Create `.env` file (Bun auto-loads it) and set `JWT_SECRET`
4. **Debugging**: Add `console.log()` - output shows in terminal
5. **Password reset**: Use `bun reset-password.ts user@example.com` to generate new password
6. **Elysia validation**: Body/params/query schemas use `t` from Elysia (TypeBox). Business validation stays in `src/lib/validation.ts`
