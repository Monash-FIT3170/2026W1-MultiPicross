Status: done

# Create/join UI: mode selector, public browser labels, waiting room player count

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

Let players pick a Game Mode when creating an unranked room, and make mode visible wherever rooms are listed or waited on.

`UnratedMultiplayer.tsx`'s "Create lobby" card gains a mode selector (pill buttons: `1v1` / `1v1v1` / `1v1v1v1` / `2v2`, mirroring the existing `SIZES` pill-button pattern), defaulting to `1v1`. Each option should make clear how many players it requires (e.g. a small "2 players" / "4 players" subtext). Mode is fully independent of board size — no restrictions or defaults coupling them. `handleCreate()` includes the selected mode in the `/create-room` request.

The public room browser (`PublicRoom` list) shows each room's mode explicitly alongside its existing size/slot-fraction text, since `2v2` and `1v1v1v1` both cap at 4 players and would otherwise be indistinguishable (e.g. `"1v1v1v1 · 15×15 · 3/4 players"`).

The waiting-room screen (`phase === "waiting"` branch of `Room.tsx`) currently hardcodes "Waiting for player 2…" and a `playerList.length < 2` check. Generalize this to show "X/N players joined" with `N - X` placeholder rows for whatever the room's mode requires. (2v2-specific team grouping in this screen is a separate slice — this one only generalizes the player count / placeholder rows, treating all joined players as one undifferentiated list for now.)

## Acceptance criteria

- [x] Create-lobby card shows a mode selector defaulting to `1v1`, with player-count context per option.
- [x] Creating a room with a non-default mode selected creates a room of that mode (verify via the room's later player-count requirement). Verified manually: created a `1v1v1v1` room, confirmed `maxClients`/capacity behavior via the waiting-room counter.
- [x] Public room browser rows show mode + current/required player count for all 4 modes. Verified manually: "1v1v1v1 · 15 × 15" / "1/4 players · waiting for more players".
- [x] Waiting-room screen shows the correct required/joined count and placeholder-row count for a `1v1v1v1` room (verified manually: 1/4 with 3 placeholders, then 2/4 with 2 placeholders after a second player joined). 2v2 uses the same generalized logic (same `maxPlayersFor` lookup), not separately tested here since 2v2 team grouping in the waiting room is deferred to issue 06 per scope.
- [x] Existing 1v1 create/join/waiting-room behavior is visually and functionally unchanged when `1v1` is selected (the default) — the Mode row is additive beneath the existing Size row; nothing else in the create card changed.
- [x] Board size selection works identically regardless of which mode is selected — the two pickers are fully independent pieces of state.

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
