# Submission

## Short Description
The implementation focuses on task completeness, clear UX, and consistent API behavior between frontend and backend.

## What Was Implemented (Short)
- Dashboard: market cards with odds/total amount, status filter, sorting (date/volume/participants), pagination (20/page), and near real-time refresh.

- User profile: active bets + resolved bets, win/loss display, separate pagination for each list, near real-time odds refresh.

- Market detail: outcome odds, bet distribution chart, positive-amount validation, safer disabled states for invalid input.

- Leaderboard: users ranked by total winnings (descending), pagination (20/page), plus name search in UI.

- Role system: admin role with dedicated admin UI/actions.

- Admin market resolution: resolve with winning outcome, archive flow, admin authentication/authorization checks.
**Admin Setup:**
- Default admin user is created during database seed with:
  - Email: `admin@vertigo.local`
  - Username: `admin`
  - Password: `admin123`
- Admins are determined by the `ADMIN_EMAILS` environment variable (comma-separated list)
- To change default admin credentials, set environment variables before seeding:
  - `SEED_ADMIN_EMAIL=your@email.com`
  - `SEED_ADMIN_USERNAME=your_username`
  - `SEED_ADMIN_PASSWORD=your_password`

- Payout distribution: proportional winner payout based on stake, balance updates on resolve/archive logic.

- User balance tracking: initial balance, balance deduction on bet, winnings/refunds applied correctly.

## Cross-Cutting Requirements
- Real-time updates implemented using periodic polling (dashboard/profile refresh without manual reload).
- Pagination implemented for all unbounded lists (20 items per page, previous/next navigation).

## Notes
- Admin behavior and endpoints were documented in project AGENTS docs.
- UI was refined for consistency (status colors, card alignment, admin labels/actions).

## Images or Video Demo
- Add screenshots in this folder (recommended): dashboard, profile, market detail, leaderboard, admin resolve flow.
- Or include a public video link here.