import { usersTable } from "../db/schema";
import db from "../db";
import { eq } from "drizzle-orm";

export interface AuthTokenPayload {
  userId: number;
}

export interface GeneratedApiKey {
  apiKey: string;
  apiKeyId: string;
  apiKeyHash: string;
  apiKeyCreatedAt: Date;
}

/**
 * Hash a password using Bun's built-in crypto
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

export async function hashApiKey(apiKeySecret: string): Promise<string> {
  return await Bun.password.hash(apiKeySecret);
}

export async function verifyApiKey(apiKeySecret: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(apiKeySecret, hash);
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const apiKeyId = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const apiKeySecret = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const apiKeyHash = await hashApiKey(apiKeySecret);
  return {
    apiKey: `pmk_${apiKeyId}.${apiKeySecret}`,
    apiKeyId,
    apiKeyHash,
    apiKeyCreatedAt: new Date(),
  };
}

export function parseApiKey(apiKey: string): { apiKeyId: string; apiKeySecret: string } | null {
  const match = /^pmk_([a-z0-9]{16})\.([a-z0-9]+)$/i.exec(apiKey.trim());
  if (!match) return null;
  return { apiKeyId: match[1], apiKeySecret: match[2] };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<typeof usersTable.$inferSelect | null> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return user ?? null;
}

export async function getUserByApiKey(apiKey: string): Promise<typeof usersTable.$inferSelect | null> {
  const parsed = parseApiKey(apiKey);
  if (!parsed) return null;

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.apiKeyId, parsed.apiKeyId) });
  if (!user || !user.apiKeyHash) return null;

  const isValid = await verifyApiKey(parsed.apiKeySecret, user.apiKeyHash);
  if (!isValid) return null;

  return user;
}
