Status: done

# Progress-bar visibility: per-client snapshot scoping

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

Replace the current "show the opponent's real board, blurred via CSS" approach with progress bars, and stop sending other players' full board data to the server at all — not just hiding it client-side.

**Server (`PicrossRoom.ts`):** `buildSnapshot()` currently returns one shared payload broadcast identically to every client via `this.broadcast("state", snapshot)`. Change this to a per-client payload: for the requesting client's own player, include the full board arrays (`confirmedFilled`, `crosses`, `revealedEmpty`, `mistakeCross`) exactly as today. For every other player in the snapshot, include only aggregated data: `username`, `team`, a new `progress` field (`confirmedFilled.filter(Boolean).length / total-filled-cells-in-solution`), `livesLeft`, `done`, `won`, `connected`. Replace the single `this.broadcast("state", ...)` calls with a per-client loop (`this.clients.forEach(c => c.send("state", buildSnapshotFor(c.sessionId)))`).

This visibility rule holds even after the match ends — there is no "reveal everyone's board" moment anymore (a deliberate simplification vs. today's blur-then-unblur behavior, and a minor security improvement since blur was only ever a client-side CSS effect over data that was already fully present in the browser).

**Frontend (`Room.tsx`):** update `RoomSnapshot`/`PlayerSnapshot` types so board-array fields are optional (present only for `me`), and add `progress`. This slice's own UI scope is narrow: replace the current single blurred `opponent`/`opponentGrid` board section with a single progress-bar row (works against today's 1v1 layout — generalizing to N players/2v2 team grouping is the next slice's job, but this slice should leave 1v1 fully working end-to-end with the new progress-bar treatment).

**Important bug found and fixed while implementing this:** writing a test that actually completes a 1v1 puzzle (rather than only testing leaves/eliminations, which is all the existing suite covered) surfaced a real regression introduced by issue 03: `handlePlayerWin`'s FFA branch treated `1v1` as "keep racing" (since `1v1` has `teamBased: false`, same as `1v1v1`/`1v1v1v1`), so completing the puzzle in 1v1 no longer ended the match — it hung in `"playing"` waiting for the other player to also finish or be eliminated. Fixed by ending the match immediately whenever `modeConfig.teamBased` OR `modeConfig.maxPlayers === 2` — 1v1 is a degenerate case where "first finisher wins" and "nothing left to race for" are the same event. Added a regression test (`"ends a 1v1 match immediately once one player completes the puzzle, even though the other hasn't finished"`) directly in the D1 section of `PicrossRoom.test.ts` to lock this down going forward.

## Acceptance criteria

- [x] Server sends full board arrays only to the client whose own player they belong to; all other players in the same snapshot carry only `progress`/`livesLeft`/`done`/`won`/`connected`/`team`/`username`.
- [x] This holds both mid-match and after the match ends (no board-array fields for other players even in the `"finished"` phase).
- [x] `progress` is computed correctly (matches actual filled-cell ratio) and updates live as a player fills cells.
- [x] In the 1v1 unranked flow, the opponent is now shown as a progress bar (with live-updating %, lives, done/won status) instead of a blurred board. Verified manually in the browser with two guest tabs (Alice/Bob).
- [x] `colors` (solution reveal) is unaffected for `me`'s own board at match end — this slice does not change how a player's own board renders.
- [x] New/updated tests in `gameserver/test/PicrossRoom.test.ts` assert the snapshot shape difference between a client's own entry and other players' entries, for both mid-match and finished phases.
- [x] Existing 1v1 gameplay (fill, cross, mistakes, win) is functionally unchanged from the acting player's perspective — including a real regression (see note above) that was caught and fixed as part of this slice.

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
