---
description: Prediction market web application - Themeisle internship challenge
globs: "**/*.ts,**/*.tsx,**/*.json,**/*.sql"
alwaysApply: true
---

# Build & Test Commands

```bash
cd server && bun run dev    # Start backend (Bun server + SQLite)
cd client && bun run dev    # Start frontend (Vite on port 3000)
cd client && bun test       # Run client tests (vitest)
cd client && bun test -- path/to/test.spec.ts  # Run single test file
```

# Admin Features

**Admin Authentication Required** for the following features:
- **Market Resolution**: Mark market as resolved with winning outcome, calculate and distribute proportional payouts to winners
- **Market Archive**: Mark market as archived, refund all bettors 100% of their bet amounts
- **Admin Profile Section**: View all markets resolved by the admin user

Admin users are determined by the `ADMIN_EMAILS` environment variable (comma-separated list of admin email addresses). Admin role is assigned at user registration time if the user's email matches a configured admin email.

All admin-protected endpoints return `403 Forbidden` if accessed by non-admin users.

# Architecture

**Monorepo Structure**: Backend (Bun + SQLite + REST API) + Frontend (React 19 + TanStack Router)

**Backend** (`server/`):
- Bun server with `Bun.serve()` (no Express)
- SQLite database with `bun:sqlite` (no ORMs)
- REST API endpoints for markets, bets, users, leaderboard
- Real-time updates via Server-Sent Events (SSE)
- Optional API key authentication for bot access

**Frontend** (`client/`):
- React 19 + TanStack Router (file-based routing in `src/routes/`)
- Tailwind CSS 4 + shadcn/ui (Radix primitives)
- TanStack Form for form handling, TanStack Query for state

**Database**: SQLite with schema for users, markets, bets, outcomes

# Code Style Guidelines

**TypeScript**: Strict mode, ES2022 target, path alias `@/*` for imports  
**Naming**: camelCase (functions/vars), PascalCase (components/types)  
**Error Handling**: Explicit try-catch, validate all user input server-side  
**Bun-first**: Use `bun:sqlite`, `Bun.serve()`, avoid npm/Node.js patterns  
**Formatting**: Prettier 3.x for client (bun format), consistent indentation

See `server/AGENTS.md` and `client/AGENTS.md` for env-specific details.
