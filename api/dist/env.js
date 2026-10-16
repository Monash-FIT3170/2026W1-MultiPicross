const cache = new Map();
export function env(name, fallback) {
    const cached = cache.get(name);
    if (cached !== undefined)
        return cached;
    const val = process.env[name];
    let resolved;
    if (val) {
        resolved = val;
    }
    else if (fallback !== undefined) {
        resolved = fallback;
    }
    else {
        throw new Error(`${name} must be set`);
    }
    cache.set(name, resolved);
    return resolved;
}
export function envBool(name, fallback = false) {
    const val = process.env[name];
    if (!val)
        return fallback;
    return val.toLowerCase() === "true" || val === "1";
}
export function envList(name, fallback = []) {
    const val = process.env[name];
    if (!val)
        return fallback;
    return val
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
