import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  handleGenerateApiKey,
  handleGetLeaderboard,
  handleGetUserBets,
  handleGetCurrentUser,
  handleRevokeApiKey,
} from "./handlers";

export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .use(authMiddleware)
  .get("/me", handleGetCurrentUser)
  .post("/me/api-key", handleGenerateApiKey)
  .delete("/me/api-key", handleRevokeApiKey)
  .get("/leaderboard", handleGetLeaderboard, {
    query: t.Object({
      page: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
      username: t.Optional(t.String()),
    }),
  })
  .get("/me/bets", handleGetUserBets, {
    query: t.Object({
      pageResolved: t.Optional(t.Numeric()),
      limitResolved: t.Optional(t.Numeric()),
      pageActive: t.Optional(t.Numeric()),
      limitActive: t.Optional(t.Numeric()),
      pageMarkets: t.Optional(t.Numeric()),
      limitMarkets: t.Optional(t.Numeric()),
      pageAdminResolved: t.Optional(t.Numeric()),
      limitAdminResolved: t.Optional(t.Numeric()),
    }),
  });
