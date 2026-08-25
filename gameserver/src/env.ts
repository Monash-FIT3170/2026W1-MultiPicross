/**
 * Environment access for the gameserver. Single home for the required-var
 * check so the db client and the room code cannot drift apart on its
 * semantics or its error wording.
 *
 * The api service has its own equivalent at api/src/env.ts. The two are
 * deliberately NOT shared: each service has its own Docker build context
 * (see compose.yaml), so neither can bundle code from the other.
 */

/** Reads a required environment variable, or throws if it is unset or empty. */
export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}
