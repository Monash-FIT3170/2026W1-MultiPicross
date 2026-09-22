Status: ready-for-agent

# Rename `?mode=ranked` URL param to `?type=ranked`

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

`Room.tsx` currently reads `searchParams.get("mode") === "ranked"` to distinguish ranked from unranked navigation, and `RankedMultiplayer.tsx` sets this via `navigate(\`/room/${roomId}?mode=ranked\`)`. This name collides with the new per-match Game Mode concept (`1v1`/`1v1v1`/`1v1v1v1`/`2v2`) being introduced elsewhere in this feature, which will also want to use the name `mode`.

Rename the existing Ranked/Unranked URL param from `mode` to `type` everywhere it's used. This is a pure rename — no behavior change. The new Game Mode value is NOT carried in the URL at all (per PRD); it will be sourced from the server's room snapshot in a later slice.

## Acceptance criteria

- [ ] `RankedMultiplayer.tsx`'s navigate call uses `?type=ranked` instead of `?mode=ranked`.
- [ ] `Room.tsx` reads `searchParams.get("type") === "ranked"` instead of `"mode"`.
- [ ] Ranked flow (queue → match → outcome banner "Play again" navigation) still works identically end-to-end — verify manually by playing a ranked match.
- [ ] Unranked flow is unaffected (it never set the `mode`/`type` param).
- [ ] No other reads of `searchParams.get("mode")` remain in the frontend.

## Blocked by

None - can start immediately
