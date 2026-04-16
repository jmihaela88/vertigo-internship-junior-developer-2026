# Submission

## Short Description
The implementation focuses on task completeness, clear UX, and consistent API behavior between frontend and backend.

## Design Choices
- Added pagination (20 items/page) for large collections to keep response/render costs predictable and maintain good client performance.
- Kept role-based behavior explicit in both backend authorization checks and frontend UI labels/actions, so admin-only capabilities are visible and auditable.
- Used consistent status/validation states (disabled buttons, clear errors, status colors) to reduce invalid user actions and improve usability.
- Centralized market resolution and payout logic server-side to keep financial calculations authoritative and avoid client-side drift.

## Challenges Faced
- This was my first time building a larger project with TypeScript, so a big challenge was understanding type errors and learning how to model data correctly across frontend and backend.
- Getting familiar with the project stack (routing, API layer, database models, and auth flow) took time, especially to understand how all parts connect end-to-end.
- I had to learn how to work with existing code patterns before extending features, so part of the effort was reading and understanding structure before implementing changes.
- Debugging was sometimes slower at the start because I was still learning where issues came from (types, validation, API responses, or UI state), but it improved as I got more familiar with the codebase.

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
- Video demo (local): `video/vertigo_presentation.mp4`
- Screenshots (local):
  - `screenshots/dashboard.png`
  - `screenshots/leaderboard.png`
  - `screenshots/profile.png`
  - `screenshots/admin_dashboard.png`
  - `screenshots/admin_market.png`
  - `screenshots/admin_profile.png`
  - `screenshots/api.png`
- Optional external backup folder: https://drive.google.com/drive/folders/1QISK762R-1TT-Pm70QbbSr666xFrQkiP?usp=drive_link
