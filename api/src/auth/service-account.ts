import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { hashPassword } from "./helpers.js";
import { isUniqueViolation } from "../db/errors.js";

// Shared by the interactive create-admin script and boot-time env seeding, so
// the "does this username already exist" logic exists once.
export async function createServiceAccount(
  username: string,
  password: string,
): Promise<{ created: boolean }> {
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.username, username),
  });
  if (existing) return { created: false };

  const passwordHash = await hashPassword(password);
  try {
    await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash });
    return { created: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { created: false };
    throw err;
  }
}
