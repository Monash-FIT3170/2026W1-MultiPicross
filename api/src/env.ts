const cache = new Map<string, string>();

export function env(name: string, fallback?: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const val = process.env[name];
  let resolved: string;
  if (val) {
    resolved = val;
  } else if (fallback !== undefined) {
    resolved = fallback;
  } else {
    throw new Error(`${name} must be set`);
  }

  cache.set(name, resolved);
  return resolved;
}

export function envBool(name: string, fallback = false): boolean {
  const val = process.env[name];
  if (!val) return fallback;
  return val.toLowerCase() === "true" || val === "1";
}

export function envList(name: string, fallback: string[] = []): string[] {
  const val = process.env[name];
  if (!val) return fallback;
  return val
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
