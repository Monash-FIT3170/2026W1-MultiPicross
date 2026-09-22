Status: done

# Game Mode foundation: mode config, capacity gating, mode-aware room creation

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

Introduce the Game Mode concept (`1v1`, `1v1v1`, `1v1v1v1`, `2v2`) as a shared, mode-agnostic primitive that unranked rooms can use, scoped strictly to unranked play — ranked's room-creation path must not change (`RatedMatchmakingRoom`'s `matchMaker.createRoom("picross_room", {...})` call passes no `mode`, so it implicitly keeps behaving as `1v1` via a default).

A room now knows its Game Mode at creation time and exposes it via room metadata. Each mode implies a required player count, and the room will only start (transition from "waiting" to "playing") once it has exactly that many players — not before, and no manual start. This generalizes today's hardcoded "starts at exactly 2 players" 1v1 rule.

This slice deliberately does NOT change match-end/win semantics — a room created with `1v1v1v1` still ends the match the instant the first player finishes (today's rule), just as before. Race-to-finish behavior for 3-4 players is out of scope here (see the FFA and 2v2 slices). This slice only proves that rooms of the correct size can be created, reach capacity, and start.

Suggested shape (adapt to what fits `PicrossRoom.ts`'s existing style):

```ts
export type GameMode = "1v1" | "1v1v1" | "1v1v1v1" | "2v2";
export interface GameModeConfig {
  maxPlayers: number;
  teamBased: boolean;
  teamCount: number;
}
export const GAME_MODES: Record<GameMode, GameModeConfig> = {
  "1v1": { maxPlayers: 2, teamBased: false, teamCount: 1 },
  "1v1v1": { maxPlayers: 3, teamBased: false, teamCount: 1 },
  "1v1v1v1": { maxPlayers: 4, teamBased: false, teamCount: 1 },
  "2v2": { maxPlayers: 4, teamBased: true, teamCount: 2 },
};
```

`PicrossRoom.onCreate(options)` accepts an optional `mode` string (default `"1v1"` for anything missing/invalid, mirroring the room's existing defensive style elsewhere), stores the resolved mode + its config, sets `this.maxClients` from the config (currently a static class field — becomes an assignment inside `onCreate`), and includes `mode` in the existing `setMetadata({inviteCode, width, height, ...})` call.

`onJoin`'s start-gate changes from the hardcoded `this.players.size === 2` to `this.players.size === <mode's maxPlayers>`.

The HTTP `/create-room` endpoint accepts an optional `?mode=` query param, validated against the known mode strings the same way `width`/`height` are already validated (400 on anything invalid), defaulting to `"1v1"`, and passes it through to `matchMaker.createRoom`.

`/public-rooms` includes `mode` in its response (reads `r.metadata?.mode`).

## Acceptance criteria

- [ ] A room can be created via `/create-room?mode=1v1v1v1&...` and requires exactly 4 players to start.
- [ ] A room created with no `mode` param (or an invalid one) behaves exactly as `1v1` does today (2 players, starts at 2/2).
- [ ] `RatedMatchmakingRoom`'s room-creation call is untouched and its rooms still behave as `1v1` (verify: ranked match still works end-to-end).
- [ ] A `1v1v1v1` room with 3/4 players joined stays in the `"waiting"` phase; joining the 4th starts it.
- [ ] `/public-rooms` response includes each room's `mode`.
- [ ] New/updated tests in `gameserver/test/PicrossRoom.test.ts` cover: room capacity gating for at least one non-1v1 mode, and that an invalid/missing mode falls back to `1v1` behavior.
- [ ] Existing 1v1 tests continue to pass unmodified.

## Blocked by

None - can start immediately
