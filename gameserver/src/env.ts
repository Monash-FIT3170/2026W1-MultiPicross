// Environment access for the gameserver. Separate from api/src/env.ts on
// purpose: each service has its own Docker build context, so neither can
// bundle the other's code.

/** Reads a required environment variable, or throws if it is unset or empty. */
export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}
