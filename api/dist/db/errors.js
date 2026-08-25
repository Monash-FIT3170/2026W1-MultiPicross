const PG_UNIQUE_VIOLATION = "23505";
export function isUniqueViolation(err) {
    if (!(err instanceof Error))
        return false;
    const pg = err.cause;
    if (pg instanceof Error && "code" in pg)
        return pg.code === PG_UNIQUE_VIOLATION;
    return ("code" in err && err.code === PG_UNIQUE_VIOLATION);
}
