const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const pg = (err as { cause?: unknown }).cause;
  if (pg instanceof Error && "code" in pg)
    return (pg as { code: string }).code === PG_UNIQUE_VIOLATION;
  return (
    "code" in err && (err as { code: string }).code === PG_UNIQUE_VIOLATION
  );
}
