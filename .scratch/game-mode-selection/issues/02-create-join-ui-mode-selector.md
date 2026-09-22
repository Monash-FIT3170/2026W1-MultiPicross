Status: ready-for-agent

# Create/join UI: mode selector, public browser labels, waiting room player count

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

Let players pick a Game Mode when creating an unranked room, and make mode visible wherever rooms are listed or waited on.

`UnratedMultiplayer.tsx`'s "Create lobby" card gains a mode selector (pill buttons: `1v1` / `1v1v1` / `1v1v1v1` / `2v2`, mirroring the existing `SIZES` pill-button pattern), defaulting to `1v1`. Each option should make clear how many players it requires (e.g. a small "2 players" / "4 players" subtext). Mode is fully independent of board size — no restrictions or defaults coupling them. `handleCreate()` includes the selected mode in the `/create-room` request.

The public room browser (`PublicRoom` list) shows each room's mode explicitly alongside its existing size/slot-fraction text, since `2v2` and `1v1v1v1` both cap at 4 players and would otherwise be indistinguishable (e.g. `"1v1v1v1 · 15×15 · 3/4 players"`).

The waiting-room screen (`phase === "waiting"` branch of `Room.tsx`) currently hardcodes "Waiting for player 2…" and a `playerList.length < 2` check. Generalize this to show "X/N players joined" with `N - X` placeholder rows for whatever the room's mode requires. (2v2-specific team grouping in this screen is a separate slice — this one only generalizes the player count / placeholder rows, treating all joined players as one undifferentiated list for now.)

## Acceptance criteria

- [ ] Create-lobby card shows a mode selector defaulting to `1v1`, with player-count context per option.
- [ ] Creating a room with a non-default mode selected creates a room of that mode (verify via the room's later player-count requirement).
- [ ] Public room browser rows show mode + current/required player count for all 4 modes.
- [ ] Waiting-room screen shows the correct required/joined count and placeholder-row count for a `1v1v1v1` room (e.g. 2/4, 2 placeholder rows) and a `2v2` room (e.g. 1/4, 3 placeholder rows).
- [ ] Existing 1v1 create/join/waiting-room behavior is visually and functionally unchanged when `1v1` is selected (the default).
- [ ] Board size selection works identically regardless of which mode is selected.

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
