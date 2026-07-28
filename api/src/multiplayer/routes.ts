import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sValidator } from "@hono/standard-validator";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import { and, countDistinct, desc, eq, notInArray, sql } from "drizzle-orm";
import type { OpenAPIV3 } from "openapi-types";
import { db } from "../db/client.js";
import { nonograms, spCompletions } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { csrf } from "../auth/csrf.js";

function schema<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  s: T,
): OpenAPIV3.SchemaObject {
  return toJsonSchema(s) as unknown as OpenAPIV3.SchemaObject;
}

const errorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: { error: { type: "string" } },
};
const errorContent = { "application/json": { schema: errorSchema } };

const GuestPuzzleQuery = v.object({
  width: v.pipe(
    v.string(),
    v.transform((s) => parseInt(s, 10)),
    v.check((n) => !Number.isNaN(n), "Must be a valid number"),
    v.integer(),
    v.minValue(1),
  ),
  height: v.pipe(
    v.string(),
    v.transform((s) => parseInt(s, 10)),
    v.check((n) => !Number.isNaN(n), "Must be a valid number"),
    v.integer(),
    v.minValue(1),
  ),
});

const StartBody = v.object({
  width: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  height: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

const ActionBody = v.object({
  row: v.pipe(v.number(), v.integer(), v.minValue(0)),
  col: v.pipe(v.number(), v.integer(), v.minValue(0)),
  kind: v.picklist(["fill", "cross", "uncross"]),
});

function computeElapsed(
  elapsedSeconds: number,
  lastResumedAt: Date | null,
): number {
  if (!lastResumedAt) return elapsedSeconds;
  return (
    elapsedSeconds + Math.floor((Date.now() - lastResumedAt.getTime()) / 1000)
  );
}

const sp = new Hono();

sp.get(
  "/sizes",
  describeRoute({
    tags: ["Multiplayer"],
    summary: "List available puzzle sizes",
    responses: {
      200: {
        description: "Available sizes",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                sizes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      width: { type: "number" },
                      height: { type: "number" },
                      count: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }),
  async (c) => {
    const rows = await db
      .select({
        width: nonograms.width,
        height: nonograms.height,
        count: countDistinct(nonograms.id),
      })
      .from(nonograms)
      .groupBy(nonograms.width, nonograms.height);
    return c.json({
      sizes: rows.map((r) => ({
        width: r.width,
        height: r.height,
        count: Number(r.count),
      })),
    });
  },
);

sp.get(
  "/guest-puzzle",
  describeRoute({
    tags: ["Multiplayer"],
    summary: "Get a random puzzle (guest mode, full solution included)",
    parameters: [
      {
        in: "query",
        name: "width",
        required: true,
        schema: { type: "integer" },
      },
      {
        in: "query",
        name: "height",
        required: true,
        schema: { type: "integer" },
      },
    ],
    responses: {
      200: { description: "Puzzle data" },
      400: { description: "Invalid query params", content: errorContent },
      404: { description: "No puzzle of that size", content: errorContent },
    },
  }),
  sValidator("query", GuestPuzzleQuery, (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.map((i) => i.message).join(", ") },
        400,
      );
  }),
  async (c) => {
    const { width, height } = c.req.valid("query" as never) as v.InferOutput<
      typeof GuestPuzzleQuery
    >;
    const [puzzle] = await db
      .select()
      .from(nonograms)
      .where(and(eq(nonograms.width, width), eq(nonograms.height, height)))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    if (!puzzle) return c.json({ error: "No puzzle of that size" }, 404);
    return c.json({
      id: puzzle.id,
      width: puzzle.width,
      height: puzzle.height,
      rowClues: puzzle.rowClues,
      colClues: puzzle.colClues,
      solution: puzzle.solution,
      colors: puzzle.colors,
    });
  },
);

sp.get(
  "/active",
  requireAuth,
  describeRoute({
    tags: ["Multiplayer"],
    summary: "Get the current active game, or null",
    responses: {
      200: { description: "Active completion or null" },
      401: { description: "Not authenticated", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const [row] = await db
      .select({
        id: spCompletions.id,
        puzzleId: spCompletions.puzzleId,
        confirmedFilled: spCompletions.confirmedFilled,
        crosses: spCompletions.crosses,
        revealedEmpty: spCompletions.revealedEmpty,
        mistakeCross: spCompletions.mistakeCross,
        livesLeft: spCompletions.livesLeft,
        elapsedSeconds: spCompletions.elapsedSeconds,
        lastResumedAt: spCompletions.lastResumedAt,
        width: nonograms.width,
        height: nonograms.height,
        rowClues: nonograms.rowClues,
        colClues: nonograms.colClues,
      })
      .from(spCompletions)
      .innerJoin(nonograms, eq(spCompletions.puzzleId, nonograms.id))
      .where(
        and(
          eq(spCompletions.accountId, accountId),
          eq(spCompletions.state, "active"),
        ),
      );

    if (!row) return c.json({ completion: null });
    return c.json({
      completion: {
        id: row.id,
        puzzleId: row.puzzleId,
        width: row.width,
        height: row.height,
        rowClues: row.rowClues,
        colClues: row.colClues,
        confirmedFilled: row.confirmedFilled,
        crosses: row.crosses,
        revealedEmpty: row.revealedEmpty,
        mistakeCross: row.mistakeCross,
        livesLeft: row.livesLeft,
        elapsedSeconds: computeElapsed(row.elapsedSeconds, row.lastResumedAt),
      },
    });
  },
);

sp.post(
  "/start",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Multiplayer"],
    summary: "Start a new game (auto-abandons any active game)",
    requestBody: {
      required: false,
      content: { "application/json": { schema: schema(StartBody) } },
    },
    responses: {
      200: { description: "New completion" },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "No puzzle of that size", content: errorContent },
    },
  }),
  sValidator("json", StartBody, (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.map((i) => i.message).join(", ") },
        400,
      );
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const body = c.req.valid("json" as never) as v.InferOutput<
      typeof StartBody
    >;
    const width = body?.width ?? 15;
    const height = body?.height ?? 15;

    // Find completed puzzle IDs to exclude
    const completedRows = await db
      .select({ puzzleId: spCompletions.puzzleId })
      .from(spCompletions)
      .where(
        and(
          eq(spCompletions.accountId, accountId),
          eq(spCompletions.state, "completed"),
        ),
      );
    const completedIds = completedRows.map((r) => r.puzzleId);

    const sizeFilter = and(
      eq(nonograms.width, width),
      eq(nonograms.height, height),
    );
    const excludeFilter =
      completedIds.length > 0
        ? and(sizeFilter, notInArray(nonograms.id, completedIds))
        : sizeFilter;

    let [puzzle] = await db
      .select()
      .from(nonograms)
      .where(excludeFilter)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    // Fall back to any puzzle of that size if all are completed
    if (!puzzle) {
      [puzzle] = await db
        .select()
        .from(nonograms)
        .where(sizeFilter)
        .orderBy(sql`RANDOM()`)
        .limit(1);
    }

    if (!puzzle) return c.json({ error: "No puzzle of that size" }, 404);

    const cellCount = puzzle.width * puzzle.height;
    const now = new Date();

    await db.transaction(async (tx) => {
      // Auto-abandon any existing active game
      const [existing] = await tx
        .select()
        .from(spCompletions)
        .where(
          and(
            eq(spCompletions.accountId, accountId),
            eq(spCompletions.state, "active"),
          ),
        );

      if (existing) {
        await tx
          .update(spCompletions)
          .set({
            state: "abandoned",
            elapsedSeconds: computeElapsed(
              existing.elapsedSeconds,
              existing.lastResumedAt,
            ),
            lastResumedAt: null,
          })
          .where(eq(spCompletions.id, existing.id));
      }

      await tx.insert(spCompletions).values({
        accountId,
        puzzleId: puzzle.id,
        confirmedFilled: Array(cellCount).fill(false),
        crosses: Array(cellCount).fill(false),
        revealedEmpty: Array(cellCount).fill(false),
        mistakeCross: Array(cellCount).fill(false),
        livesLeft: 3,
        elapsedSeconds: 0,
        lastResumedAt: now,
      });
    });

    const [created] = await db
      .select()
      .from(spCompletions)
      .where(
        and(
          eq(spCompletions.accountId, accountId),
          eq(spCompletions.state, "active"),
        ),
      );

    return c.json({
      completion: {
        id: created.id,
        puzzleId: created.puzzleId,
        width: puzzle.width,
        height: puzzle.height,
        rowClues: puzzle.rowClues,
        colClues: puzzle.colClues,
        confirmedFilled: created.confirmedFilled,
        crosses: created.crosses,
        revealedEmpty: created.revealedEmpty,
        mistakeCross: created.mistakeCross,
        livesLeft: created.livesLeft,
        elapsedSeconds: 0,
      },
    });
  },
);

sp.post(
  "/action",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Multiplayer"],
    summary: "Submit a cell action (fill/cross/uncross)",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(ActionBody) } },
    },
    responses: {
      200: { description: "Action result" },
      400: { description: "Invalid action", content: errorContent },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "No active game", content: errorContent },
    },
  }),
  sValidator("json", ActionBody, (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.map((i) => i.message).join(", ") },
        400,
      );
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const action = c.req.valid("json" as never) as v.InferOutput<
      typeof ActionBody
    >;
    const { row, col, kind } = action;

    type ActionResult =
      | { status: 200; body: object }
      | { status: 400 | 404; body: { error: string } };

    const result: ActionResult = await db.transaction(async (tx) => {
      const [gameRow] = await tx
        .select({
          id: spCompletions.id,
          confirmedFilled: spCompletions.confirmedFilled,
          crosses: spCompletions.crosses,
          revealedEmpty: spCompletions.revealedEmpty,
          mistakeCross: spCompletions.mistakeCross,
          livesLeft: spCompletions.livesLeft,
          elapsedSeconds: spCompletions.elapsedSeconds,
          lastResumedAt: spCompletions.lastResumedAt,
          width: nonograms.width,
          height: nonograms.height,
          solution: nonograms.solution,
          colors: nonograms.colors,
        })
        .from(spCompletions)
        .innerJoin(nonograms, eq(spCompletions.puzzleId, nonograms.id))
        .where(
          and(
            eq(spCompletions.accountId, accountId),
            eq(spCompletions.state, "active"),
          ),
        )
        .for("update");

      if (!gameRow) return { status: 404, body: { error: "No active game" } };
      if (gameRow.livesLeft <= 0)
        return { status: 400, body: { error: "No lives remaining" } };

      const { width, height } = gameRow;
      if (row < 0 || row >= height || col < 0 || col >= width) {
        return { status: 400, body: { error: "Cell out of bounds" } };
      }

      const idx = row * width + col;
      const confirmedFilled = gameRow.confirmedFilled as boolean[];
      const crosses = gameRow.crosses as boolean[];
      const revealedEmpty = gameRow.revealedEmpty as boolean[];
      const mistakeCross = gameRow.mistakeCross as boolean[];
      const solution = gameRow.solution as number[];

      if (confirmedFilled[idx] || revealedEmpty[idx]) {
        return { status: 400, body: { error: "Cell is already locked" } };
      }

      if (kind === "uncross") {
        const newCrosses = [...crosses];
        newCrosses[idx] = false;
        await tx
          .update(spCompletions)
          .set({ crosses: newCrosses })
          .where(eq(spCompletions.id, gameRow.id));
        return {
          status: 200,
          body: { result: "uncross", livesLeft: gameRow.livesLeft },
        };
      }

      if (kind === "cross") {
        if (solution[idx] === 1) {
          // Crossing a filled cell — treat as a mistake, reveal as confirmed filled
          const newConfirmedFilled = [...confirmedFilled];
          newConfirmedFilled[idx] = true;
          const newCrosses = [...crosses];
          newCrosses[idx] = false;
          const newMistakeCross = [...mistakeCross];
          newMistakeCross[idx] = true;
          const newLives = (gameRow.livesLeft as number) - 1;

          if (newLives <= 0) {
            const finalElapsed = computeElapsed(
              gameRow.elapsedSeconds,
              gameRow.lastResumedAt,
            );
            await tx
              .update(spCompletions)
              .set({
                state: "failed",
                confirmedFilled: newConfirmedFilled,
                crosses: newCrosses,
                mistakeCross: newMistakeCross,
                livesLeft: newLives,
                elapsedSeconds: finalElapsed,
                lastResumedAt: null,
              })
              .where(eq(spCompletions.id, gameRow.id));
            return {
              status: 200,
              body: {
                result: "mistake-cross",
                livesLeft: newLives,
                gameOver: true,
              },
            };
          }

          const isComplete = solution.every(
            (v, i) => v === 0 || newConfirmedFilled[i],
          );
          if (isComplete) {
            const finalElapsed = computeElapsed(
              gameRow.elapsedSeconds,
              gameRow.lastResumedAt,
            );
            await tx
              .update(spCompletions)
              .set({
                state: "completed",
                confirmedFilled: newConfirmedFilled,
                crosses: newCrosses,
                mistakeCross: newMistakeCross,
                livesLeft: newLives,
                elapsedSeconds: finalElapsed,
                lastResumedAt: null,
                completedAt: new Date(),
              })
              .where(eq(spCompletions.id, gameRow.id));
            return {
              status: 200,
              body: {
                result: "mistake-cross",
                livesLeft: newLives,
                completed: true,
                colors: gameRow.colors,
              },
            };
          }

          await tx
            .update(spCompletions)
            .set({
              confirmedFilled: newConfirmedFilled,
              crosses: newCrosses,
              mistakeCross: newMistakeCross,
              livesLeft: newLives,
            })
            .where(eq(spCompletions.id, gameRow.id));
          return {
            status: 200,
            body: { result: "mistake-cross", livesLeft: newLives },
          };
        }

        // Normal cross on an empty cell
        const newCrosses = [...crosses];
        newCrosses[idx] = true;
        await tx
          .update(spCompletions)
          .set({ crosses: newCrosses })
          .where(eq(spCompletions.id, gameRow.id));
        return {
          status: 200,
          body: { result: "cross", livesLeft: gameRow.livesLeft },
        };
      }

      // kind === "fill"
      if (solution[idx] === 1) {
        // Correct fill
        const newConfirmedFilled = [...confirmedFilled];
        newConfirmedFilled[idx] = true;
        const newCrosses = [...crosses];
        newCrosses[idx] = false;

        const isComplete = solution.every(
          (v, i) => v === 0 || newConfirmedFilled[i],
        );

        if (isComplete) {
          const finalElapsed = computeElapsed(
            gameRow.elapsedSeconds,
            gameRow.lastResumedAt,
          );
          await tx
            .update(spCompletions)
            .set({
              state: "completed",
              confirmedFilled: newConfirmedFilled,
              crosses: newCrosses,
              elapsedSeconds: finalElapsed,
              lastResumedAt: null,
              completedAt: new Date(),
            })
            .where(eq(spCompletions.id, gameRow.id));
          return {
            status: 200,
            body: {
              result: "correct",
              livesLeft: gameRow.livesLeft,
              completed: true,
              colors: gameRow.colors,
            },
          };
        }

        await tx
          .update(spCompletions)
          .set({ confirmedFilled: newConfirmedFilled, crosses: newCrosses })
          .where(eq(spCompletions.id, gameRow.id));
        return {
          status: 200,
          body: {
            result: "correct",
            livesLeft: gameRow.livesLeft,
            completed: false,
          },
        };
      } else {
        // Mistake
        const newLives = (gameRow.livesLeft as number) - 1;
        const newRevealedEmpty = [...revealedEmpty];
        newRevealedEmpty[idx] = true;

        if (newLives <= 0) {
          const finalElapsed = computeElapsed(
            gameRow.elapsedSeconds,
            gameRow.lastResumedAt,
          );
          await tx
            .update(spCompletions)
            .set({
              state: "failed",
              revealedEmpty: newRevealedEmpty,
              livesLeft: newLives,
              elapsedSeconds: finalElapsed,
              lastResumedAt: null,
            })
            .where(eq(spCompletions.id, gameRow.id));
        } else {
          await tx
            .update(spCompletions)
            .set({ revealedEmpty: newRevealedEmpty, livesLeft: newLives })
            .where(eq(spCompletions.id, gameRow.id));
        }

        return {
          status: 200,
          body: {
            result: "mistake",
            livesLeft: newLives,
            gameOver: newLives <= 0,
          },
        };
      }
    });

    return c.json(result.body, result.status as 200);
  },
);

sp.post(
  "/abandon",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Multiplayer"],
    summary: "Abandon the active game",
    responses: {
      200: { description: "Game abandoned" },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "No active game", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const [completion] = await db
      .select()
      .from(spCompletions)
      .where(
        and(
          eq(spCompletions.accountId, accountId),
          eq(spCompletions.state, "active"),
        ),
      );

    if (!completion) return c.json({ error: "No active game" }, 404);

    const finalElapsed = computeElapsed(
      completion.elapsedSeconds as number,
      completion.lastResumedAt,
    );
    await db
      .update(spCompletions)
      .set({
        state: "abandoned",
        elapsedSeconds: finalElapsed,
        lastResumedAt: null,
      })
      .where(eq(spCompletions.id, completion.id));

    return c.json({ success: true });
  },
);

sp.get(
  "/history",
  requireAuth,
  describeRoute({
    tags: ["Multiplayer"],
    summary: "List completed games",
    responses: {
      200: { description: "Completed games" },
      401: { description: "Not authenticated", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const rows = await db
      .select({
        id: spCompletions.id,
        puzzleId: spCompletions.puzzleId,
        width: nonograms.width,
        height: nonograms.height,
        elapsedSeconds: spCompletions.elapsedSeconds,
        livesLeft: spCompletions.livesLeft,
        completedAt: spCompletions.completedAt,
      })
      .from(spCompletions)
      .innerJoin(nonograms, eq(spCompletions.puzzleId, nonograms.id))
      .where(
        and(
          eq(spCompletions.accountId, accountId),
          eq(spCompletions.state, "completed"),
        ),
      )
      .orderBy(desc(spCompletions.completedAt));

    return c.json({ completions: rows });
  },
);

export default sp;
