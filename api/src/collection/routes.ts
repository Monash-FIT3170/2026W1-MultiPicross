import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sql } from "drizzle-orm";
import type { OpenAPIV3 } from "openapi-types";
import { db } from "../db/client.js";
import { requireAuth } from "../auth/middleware.js";

const errorContent = {
  "application/json": {
    schema: {
      type: "object",
      properties: { error: { type: "string" } },
    } satisfies OpenAPIV3.SchemaObject,
  },
};

type CollectionPuzzle = {
  id: string;
  name: string | null;
  width: number;
  height: number;
  solution: number[];
  colors: string[];
  timesSolved: number;
  fastestSeconds: number;
  averageSeconds: number;
  totalSeconds: number;
  firstCompletedAt: string;
  lastCompletedAt: string;
  bestLivesLeft: number;
  modes: ("singleplayer" | "multiplayer")[];
};

// Raw timestamps come back from drizzle's postgres-js driver as zone-less
// strings, so format them as UTC ISO in SQL.
const iso = (col: string) =>
  sql.raw(`to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);

const collection = new Hono();

collection.get(
  "/",
  requireAuth,
  describeRoute({
    tags: ["Collection"],
    summary: "List every puzzle the caller has solved, with solve stats",
    responses: {
      200: { description: "Solved puzzles, most recently solved first" },
      401: { description: "Not authenticated", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };

    const rows = await db.execute<CollectionPuzzle>(sql`
      WITH solves AS (
        SELECT puzzle_id, 'singleplayer' AS mode, elapsed_seconds, lives_left,
               completed_at AS solved_at
        FROM sp_completions
        WHERE account_id = ${accountId} AND state = 'completed'
        UNION ALL
        SELECT puzzle_id, 'multiplayer', elapsed_seconds, lives_left, finished_at
        FROM mp_results
        WHERE account_id = ${accountId} AND solved
      ),
      agg AS (
        SELECT puzzle_id,
               count(*)::int AS "timesSolved",
               min(elapsed_seconds)::int AS "fastestSeconds",
               round(avg(elapsed_seconds))::int AS "averageSeconds",
               sum(elapsed_seconds)::int AS "totalSeconds",
               min(solved_at) AS first_at,
               max(solved_at) AS last_at,
               max(lives_left)::int AS "bestLivesLeft",
               array_agg(DISTINCT mode) AS modes
        FROM solves
        GROUP BY puzzle_id
      )
      SELECT n.id, n.name, n.width, n.height, n.solution, n.colors,
             a."timesSolved", a."fastestSeconds", a."averageSeconds",
             a."totalSeconds", a."bestLivesLeft", a.modes,
             ${iso("a.first_at")} AS "firstCompletedAt",
             ${iso("a.last_at")} AS "lastCompletedAt"
      FROM agg a
      JOIN nonograms n ON n.id = a.puzzle_id
      ORDER BY a.last_at DESC
    `);

    return c.json({ puzzles: rows });
  },
);

export default collection;
