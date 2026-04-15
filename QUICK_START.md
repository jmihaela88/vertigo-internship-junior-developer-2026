# Quick Start Guide

## Installation & Running

### 1. Install Dependencies
```bash
cd server && bun install && cd ..
cd client && bun install && cd ..
```

### 2. Initialize Database
```bash
cd server

# Create a copy of the environment variables
cp .env.example .env

# Generate local drizzle files from the schema
bun run db:generate

# Apply generated migrations to create tables
bun run db:migrate

# (OPTIONAL) Seed with test data & users
bun run db:reset

cd ..
```

> **Tip**: `bun run db:reset` will create 3 test users and 3 sample markets with bets.

### 3. Start Services
```bash
# Terminal 1 - Backend
cd server && bun run dev

# Terminal 2 - Frontend  
cd client && bun run dev
```

### 4. Access Application
- Frontend: http://localhost:3000
- API: http://localhost:4001/api

---

## Quick Test

1. **Register**: Click "Sign Up" and create account
2. **Create Market**: Click "Create Market" button
   - Title: "Will Bitcoin reach $100k?"
   - Outcomes: ["Yes", "No"]
3. **View Markets**: Back to dashboard
4. **Place Bet**: Click market → select outcome → enter amount → "Place Bet"
5. **Check Odds**: Odds should update after bet

---

## File Structure

```
Backend (Bun + SQLite + Drizzle):
server/
├── src/api/auth.routes.ts  → Auth endpoints
├── src/api/markets.routes.ts → Markets and betting endpoints
├── src/db/schema.ts        → Database tables
├── src/lib/auth.ts         → Password/token handling
└── index.ts                → Server startup

Frontend (React + TanStack):
client/
├── src/routes/             → Pages
│   ├── index.tsx           → Dashboard
│   ├── auth/login.tsx      → Login
│   ├── auth/logout.tsx     → Logout redirect page
│   ├── auth/register.tsx   → Sign up
│   └── markets/$id.tsx     → Market detail
├── src/components/         → React components
├── src/lib/api.ts          → API client
└── src/lib/auth-context.tsx→ Auth state
```

---

## Available Endpoints

### Auth
- `POST /api/auth/register` - Create user
- `POST /api/auth/login` - Login

### Markets
- `GET /api/markets?status=active` - List markets
- `POST /api/markets` - Create market (requires auth)
- `GET /api/markets/:id` - Get market details

### Bets
- `POST /api/markets/:id/bets` - Place bet (requires auth)

### Admin Resolution
- `POST /api/markets/:id/resolve` - Resolve market with winning outcome (requires admin auth)

---

## Environment Variables

### Server (.env)
```
DB_FILE_NAME=database.sqlite
PORT=4001
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAILS=admin@vertigo.local
```

Admin model (Polymarket-like):
- Market creators are regular users and cannot resolve their own markets by default.
- Resolution is handled by designated platform admin accounts (oracle-style) from `ADMIN_EMAILS`.
- Any registered user whose email is listed in `ADMIN_EMAILS` is assigned the `admin` role.

### Client (Vite)
```
VITE_API_URL=http://localhost:4001
```

---

## Common Commands

### Backend
```bash
cd server

# Start dev server with hot reload
bun run dev

# Generate local drizzle files from schema changes
bun run db:generate

# Run migrations
bun run db:migrate

# Build for production
bun run build
```

### Frontend
```bash
cd client

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
```

---

## Troubleshooting

### Database Issues
```bash
# Reset database
rm server/database.sqlite

# Recreate local drizzle output and schema
cd server
bun run db:generate
bun run db:migrate
```

### Port Already in Use
- **Backend**: Change PORT in server/.env
- **Frontend**: `bun run dev -- --port 5000`

### API Connection Error
- Check backend is running on port 4001
- Verify VITE_API_URL in frontend
- Check browser console for CORS errors

### Dependencies Missing
```bash
# Reinstall everything
rm -rf server/node_modules client/node_modules
cd server && bun install
cd ../client && bun install
```

---

## Next Steps

1. **Get MVP running** (following steps above)
2. **Understand the code** (read JOHN_IMPLEMENTATION_SUMMARY.md)
3. **Start building features** (see IMPLEMENTATION_PLAN.md)
4. **Key features to add**:
   - Pagination (20 items/page)
   - Sorting & filtering
   - User profile page
   - Leaderboard
   - Real-time updates
   - Market resolution

---

## Resources

- **Bun Docs**: https://bun.sh/docs
- **Drizzle ORM**: https://orm.drizzle.team
- **TanStack Router**: https://tanstack.com/router
- **TanStack Form**: https://tanstack.com/form
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com

---

## Tips

1. **Hot Reload**: Changes auto-reload in dev mode
2. **Database**: SQLite file stored at `database.sqlite` in server directory
3. **Auth Token**: Stored in browser localStorage as `auth_token`
4. **API Testing**: Use Postman or curl to test endpoints
5. **Console Logs**: Server logs show database queries, client logs show API calls

Good luck! 🚀

### Docker Compose
```bash
docker compose up --build
```

Application URLs:
- Frontend: http://localhost:3000
- API: http://localhost:4001/api

Notes:
- The server container runs database migrations automatically on startup.
- On the first run, the SQLite database is also seeded with sample users, markets, and bets.
- The SQLite file is stored in the named Docker volume `server_data`, so data persists across restarts.

To reset the Dockerized database and reseed from scratch:
```bash
docker compose down -v
docker compose up --build
```
