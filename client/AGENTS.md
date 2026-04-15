# AGENTS.md

## Build & Test Commands

```bash
bun dev                           # Start dev server on port 3000 (Vite)
bun build                         # Build for production
bun test                          # Run vitest (single run)
bun test -- --watch               # Run vitest in watch mode
bun test -- path/to/test.spec.ts  # Run single test file
bun lint                          # Run ESLint
bun format                        # Run code formatter
```

## Admin Features (Requires Admin Authentication)

**Admin-Only UI Elements** (visible only to users with admin role):

On **Market Detail Page** (`routes/markets/$id.tsx`):
- "Resolve with Selected Outcome" button - Mark market as resolved, calculate and auto-distribute payouts
- "Archive Market + Refund Bettors" button - Mark market archived, refund all bettors their full bet amounts
- Confirmation dialogs before any admin action

On **User Profile Page** (`routes/profile.tsx`):
- "Resolved By You" tab - Shows all markets resolved by current admin user with their winning outcomes

All admin features require the user to have `role === "admin"` in their JWT token.

## Architecture

**Framework**: TanStack Start (React 19, TypeScript, Vite)  
**Styling**: Tailwind CSS 4 + shadcn/ui (Radix + CVA)  
**Routing**: TanStack Router with file-based routing (src/routes/)  
**Backend**: Nitro (server layer)  
**State/Forms**: TanStack Form, TanStack DevTools available

**Structure**:

- `src/routes/` - File-based routing
- `src/components/` - React components (ui/ contains shadcn/ui)
- `src/lib/` - Utilities and helpers
- `src/router.tsx` - Router config
- `vite.config.ts` - Vite + Tailwind + React Start setup

## Code Style Guidelines

**TypeScript**: Strict mode enabled, ES2022 target, JSX react-jsx  
**Imports**: Use path alias `@/*` for src imports (e.g., `@/components/ui/button`)  
**Linting**: TanStack ESLint config enforced  
**Formatting**: Prettier 3.x  
**Naming**: camelCase for functions/vars, PascalCase for components/types  
**Error Handling**: Explicit error catching, no silent failures
