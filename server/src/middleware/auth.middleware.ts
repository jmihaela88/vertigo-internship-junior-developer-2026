import { Elysia } from "elysia";
import db from "../db";
import { eq } from "drizzle-orm";
import { usersTable } from "../db/schema";
import { getUserByApiKey, getUserById } from "../lib/auth";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = await jwt.verify(token);
      if (!payload) {
        return { user: null };
      }

      const user = await getUserById(payload.userId);
      return { user };
    }

    const apiKey =
      headers["x-api-key"] || (authHeader?.startsWith("ApiKey ") ? authHeader.substring(7) : null);

    if (!apiKey) {
      return { user: null };
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return { user: null };
    }

    await db
      .update(usersTable)
      .set({ apiKeyLastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    return { user };
  })
  .as("plugin");
