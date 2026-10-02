Status: ready-for-agent

# PRD: 2v2 Shared Team Board

See `CONTEXT.md` for the glossary (Team, **Team Board**, **Teammate Cursor**, Elimination, Sole Surviving Team) and `docs/adr/0001-2v2-shared-team-board.md` for why boards are shared but lives are not.

Builds on the completed `.scratch/game-mode-selection/` feature (2v2 teams, team assignment, team-aware win/leave logic, in-match N-player layout).

## Problem Statement

In today's `2v2` mode, each player solves their own independent board. Teammates share a win/loss outcome but nothing else — there is no way to actually play _together_. The mode plays like a four-player free-for-all where your partner is just a second lottery ticket for finishing first. Players who pick 2v2 to team up with a friend get no teamwork: they can't split the puzzle, cover each other's lines, or see what their partner is doing.

## Solution

In `2v2`, each team solves a single shared **Team Board**. Every fill and cross either teammate makes lands on the same board, and both see it update live. Each player keeps their own 3 lives: a mistake costs only the player who made it, but the revealed cell appears on the shared board for both. If one teammate runs out of lives, they stop acting and watch while their partner keeps solving and can still win for the team.

To coordinate, each player sees their teammate's live mouse pointer (the **Teammate Cursor**) moving over the board in the team colour. Opponents never see it.

The in-match layout reflects that there are two boards in play, not four: your own Team Board is the main board, your teammate appears as a status line (name, lives, status) beneath it, and the opposing team appears as a single sidebar card showing their blurred Team Board, one progress bar, and both opponents' names and lives. When a Team Board is completed, the win is announced for the whole team — no individual is named as the finisher.

Free-for-all modes (`1v1`, `1v1v1`, `1v1v1v1`) and ranked play are unchanged.

## User Stories

### Shared board

1. As a 2v2 player, I want my fills to appear on my teammate's board immediately, so that we are working on the same puzzle.
2. As a 2v2 player, I want to see my teammate's fills appear on my board as they make them, so that I don't redo their work.
3. As a 2v2 player, I want crosses my teammate places to appear on my board, so that I can use their deductions.
4. As a 2v2 player, I want to be able to remove a cross my teammate placed, so that I can correct a note I disagree with.
5. As a 2v2 player, I want my teammate to be able to remove a cross I placed, so that we treat crosses as shared notes rather than owned marks.
6. As a 2v2 player, I want to be able to fill a cell my teammate crossed, so that a wrong note never blocks progress.
7. As a 2v2 player, I want rows and columns to auto-cross when their clue is satisfied, no matter which teammate made the filling move, so that the shared board behaves like a single board.
8. As a 2v2 player, I want a cell revealed by my teammate's mistake to appear on my board, so that we both benefit from the information.
9. As a 2v2 player, I want the other team's actions never to affect my Team Board, so that each team races on its own board.
10. As a 2v2 player, I want both teams to be solving the same puzzle, so that the race is fair.
11. As a 2v2 player who reconnects after a brief drop, I want to see the current state of my Team Board, including everything my teammate did while I was away, so that I can pick up where we are.
12. As a 2v2 player, I want both of us dragging across the board at the same time to work without errors or lost moves, so that we can work in parallel.

### Lives and elimination

13. As a 2v2 player, I want my own 3 lives, so that my mistakes are my own responsibility.
14. As a 2v2 player, I want my teammate's mistake to cost only their life, not mine, so that I can keep playing at full strength.
15. As a 2v2 player, I want to see my teammate's remaining lives, so that I know how careful they need to be.
16. As a 2v2 player who has run out of lives, I want to keep watching my Team Board live, so that I can follow my teammate as they try to win for us.
17. As a 2v2 player who has run out of lives, I want my clicks to do nothing on the board, so that it's clear I can't act any more.
18. As a 2v2 player whose teammate has run out of lives, I want to keep solving our Team Board alone, so that our team can still win.
19. As a 2v2 player whose teammate left mid-match, I want to keep solving our Team Board alone, so that one quitter doesn't forfeit the team.
20. As a 2v2 player, I want the match to end with the other team winning if both my teammate and I are eliminated or have left, so that the match doesn't stall.
21. As a 2v2 player, I want our team to win automatically if both opponents are eliminated or have left while one of us is still active, so that we aren't forced to finish a board nobody is racing.

### Teammate Cursor

22. As a 2v2 player, I want to see my teammate's mouse pointer moving over our board in real time, so that I can see where they're working.
23. As a 2v2 player, I want my teammate's pointer to move smoothly rather than jump, so that it feels like they're really there.
24. As a 2v2 player, I want my teammate's pointer to land on the same part of the board they are pointing at, even if our windows or cell sizes differ, so that it's accurate.
25. As a 2v2 player, I want my teammate's pointer shown in our team colour, so that I instantly recognise it as theirs.
26. As a 2v2 player, I want my teammate's pointer to follow them while they drag-paint, so that I can see which line they're sweeping.
27. As a 2v2 player, I want my teammate's pointer to disappear when their mouse leaves the board, so that a stale pointer doesn't mislead me.
28. As a 2v2 player, I want my teammate's pointer to disappear when they are eliminated, disconnect, or leave, so that I don't think they're still working.
29. As a 2v2 player, I want my teammate's pointer to disappear when the match ends, so that the finished board is clean.
30. As a 2v2 player, I want the opposing team never to see my pointer, so that they can't tell where my team is working.
31. As a 2v2 player, I want never to receive the opposing team's pointers, so that the game stays fair and uncluttered.
32. As a 2v2 player, I don't want my own pointer highlighted on my own board, so that the sage pointer always means my teammate.
33. As a 2v2 player who has been eliminated, I want to keep seeing my surviving teammate's pointer, so that I can follow along while spectating.

### Layout

34. As a 2v2 player, I want my Team Board as the main interactive board, so that the layout matches single-player and FFA.
35. As a 2v2 player, I want my teammate shown as a compact status line (name, lives, connected/eliminated) under my board rather than a separate mini-board, so that I'm not shown a duplicate of the board I'm playing on.
36. As a 2v2 player, I want the opposing team shown as one sidebar card rather than two, so that I'm not shown the same board twice.
37. As a 2v2 player, I want the opponents' card to show their Team Board blurred during play, so that I can sense their progress without copying their solution.
38. As a 2v2 player, I want the opponents' card to show one progress bar for their Team Board, so that I can see how close they are.
39. As a 2v2 player, I want the opponents' card to list both opponents with their own lives and status, so that I can see if one of them is out.
40. As a 2v2 player, I want the opponents' card to keep the opposing-team colour and my teammate's line to keep the own-team colour, so that the existing colour-only team distinction still holds.
41. As a 2v2 player, I want the opponents' board to unblur when the match ends, so that I can see how far they got.
42. As a 2v2 player, I want the waiting room to behave as it does today, so that nothing about joining or team assignment changes.

### Winning and results

43. As a 2v2 player, I want our team to win the instant our Team Board is completed, so that the race is decided cleanly.
44. As a 2v2 player, I want the match to end for all 4 players when either Team Board is completed, so that nobody keeps playing a decided match.
45. As a 2v2 player, I want the win banner to say our team solved it, without naming whoever placed the last cell, so that credit goes to the team.
46. As a 2v2 player on the losing team, I want the banner to say which team solved it first, without naming a player, so that the result is framed as team versus team.
47. As a 2v2 player, I want our team to win if the final cell is revealed by a teammate's life-ending mistake, so that completing the board always counts.
48. As a 2v2 player who was eliminated before my teammate finished, I want to share in the team's win, so that I'm not treated as a loser in a match my team won.
49. As a 2v2 player, I want the existing forfeit messaging ("Opponent left — your team wins!") to keep working, so that wins by forfeit are still explained.

### Unchanged modes

50. As an FFA player, I want my own independent board and the existing per-player opponent cards, so that FFA plays exactly as before.
51. As a ranked player, I want ranked 1v1 to be completely unaffected, so that Elo and matchmaking behave as before.

## Implementation Decisions

- **2v2 is replaced, not duplicated.** There is no new Game Mode; `2v2` changes meaning. The game-mode config is unchanged (4 players, team-based, 2 teams).
- **Board state is keyed by team in 2v2 and by player otherwise.** The room keeps board state (confirmed fills, crosses, revealed empties, mistake crosses) per team for team-based modes. Per-player state (lives, done, won, connected, team) stays per player. FFA keeps per-player boards. The move handlers resolve the _board to act on_ from the acting player (their team's board in 2v2, their own board otherwise), so fill/cross/auto-complete/completion logic runs unchanged against whichever board is resolved.
- **Acting is gated per player.** A fill or cross is ignored if the acting player is done (eliminated, won, or left) even though their teammate may still act on the same board. Existing checks on cell state (already confirmed / already revealed) apply to the shared board, so concurrent moves on the same cell resolve in order: the first one wins, the second is a no-op.
- **Mistakes cost the actor.** A wrong fill or a wrong cross decrements only the acting player's lives, while the revealed cell is written to the Team Board. The `mistake` message (which drives the shake animation) is sent to every member of the acting player's team, since the board they are both looking at changed.
- **Completion is checked on the board.** When a move completes a Team Board, that team wins and the match ends immediately for all 4 players. The completion check runs before the elimination check, so a move that both completes the board and uses up the actor's last life is a win. `winnerId` is set to the acting player's session internally (the client derives "my team won" from the winner's team, as today) but is never shown as individual credit.
- **Team wipeout / sole surviving team logic is unchanged.** It already works off per-player done state and applies as-is.
- **Snapshot shape (2v2).** The `state` snapshot gains a `teamBoards` map keyed by team index, each holding the board arrays plus that board's `progress`. In 2v2, player entries carry identity/lives/status/team only, without board arrays or per-player progress. FFA snapshots are unchanged. Every client continues to receive all boards (per the current approach, where the client blurs opponents during play and puzzle colours are revealed only at match end).
- **Teammate Cursor protocol.**
  - Client → server message `cursor`: either `{ x, y }` in _board coordinates_ (fractional column and row, e.g. `x = 2.4` means 40% of the way across column 2) or `null` when the pointer leaves the board. Board coordinates make the pointer independent of window size and cell size.
  - The server ignores `cursor` outside 2v2, outside the `playing` phase, from a player who is done, or with non-finite / out-of-range values (valid range: `0 ≤ x ≤ width`, `0 ≤ y ≤ height`). It also drops messages from a client that sends faster than a sanity cap (well above the client's send rate).
  - Server → client message `teammateCursor`: `{ x, y }` or `null`, sent **only** to the sender's teammate. It is never broadcast and never sent to the opposing team. Cursor data is not part of the snapshot and is not persisted.
  - The server sends `teammateCursor: null` to the teammate when the player is eliminated, drops, or leaves, and when the match ends.
  - The client throttles `cursor` sends to about 20 per second and sends only when the position has changed.
- **Teammate Cursor rendering.** A sage (own-team colour) arrow pointer is drawn as an overlay on the player's main board, positioned from board coordinates using the local cell size and clue offset. Between updates the client interpolates toward the latest position so motion is smooth. There's no name label (only one teammate) and no cell or row highlight. It follows drag-painting. It's hidden on `null`, when the teammate is done or disconnected, and when the match is finished. The player's own pointer gets no extra rendering.
- **In-match layout (2v2 only).**
  - The main board renders the viewer's Team Board. It is non-interactive when the viewer is done but still updates live.
  - A teammate status line under the main board shows the teammate's name, lives and connected/eliminated state in the own-team colour, with no mini-board.
  - The sidebar shows one opposing-team card instead of per-player cards: the opposing Team Board (blurred during play and unblurred at finish, as today), one progress bar, and both opponents' names, each with their own lives and status, with the opposing-team accent colour.
  - FFA layout is unchanged.
- **Result copy (2v2).** The winning team sees "Your team solved it!". The losing team sees "Team N solved it first". Forfeit and wipeout copy stays as today ("Opponent left — your team wins!" etc.). No 2v2 banner names an individual finisher. The abandon-confirmation copy stays accurate as-is.
- **Out of the path of ranked.** Ranked is always `1v1` and never uses team boards. The ranked result recording is untouched.

## Testing Decisions

- **What makes a good test:** test external behaviour only. Real SDK clients join a real room, send the same messages the frontend sends (`fill`, `cross`, `cursor`), and assert on what each client receives (`state` snapshots, `mistake`, `teammateCursor`). No tests reach into room internals or assert on private fields.
- **Server: extend `PicrossRoom.test.ts`** (the existing `@colyseus/testing` integration suite with real Postgres). Reuse `startSquadMatch()`, `track()`/`wait()` and `fill()`. New coverage:
  - A teammate's fill appears in the other teammate's snapshot on their shared Team Board. The opposing team's board is unaffected.
  - Either teammate can place and remove any cross on the Team Board. Filling a crossed cell clears the cross.
  - A mistake decrements only the actor's lives, and the revealed cell appears on the Team Board. Both teammates receive `mistake`.
  - An eliminated player's `fill` / `cross` are ignored, while the teammate can still complete the board and win for the team.
  - Completing a Team Board ends the match for all 4 players with the correct team winning, including when the final cell is revealed by the actor's life-ending mistake.
  - Wipeout still works: both members of one team eliminated or left leads to the other team winning.
  - Teammate Cursor: a `cursor` from A reaches A's teammate as `teammateCursor` and is **never** received by either opponent. Invalid and out-of-range coordinates are dropped. `cursor` is ignored in FFA. The teammate receives `null` when the sender is eliminated or leaves, and when the match ends.
  - Regression: all existing 1v1 / 1v1v1 / team-assignment / ranked tests keep passing unchanged. FFA snapshots still carry per-player boards.
- **Frontend: checked by hand, no automated tests.** The frontend has no test tooling today, and the changes are mostly visual (opponent-team card, teammate status line, cursor overlay and interpolation, result copy). Verify with 4 browser sessions against the dev stack: cursor accuracy at different window sizes, smooth motion, visibility rules, layout, banners.

## Out of Scope

- Any change to FFA modes (`1v1`, `1v1v1`, `1v1v1v1`) or to ranked play, matchmaking or Elo.
- Team assignment rules and the waiting room (unchanged).
- A shared team life pool (rejected; see ADR 0001).
- Keeping the old independent-board 2v2 as a separate or selectable mode.
- Pointer sharing in any mode other than 2v2, and showing any pointer to opponents.
- Teammate chat, pings or other communication beyond the Teammate Cursor.
- Per-player contribution stats ("who filled what") or naming an individual finisher.
- A touch or mobile equivalent of the Teammate Cursor (the mobile app has no multiplayer room).
- Adding frontend test tooling.
- Changing the approach of sending all boards to every client and blurring on the client.

## Further Notes

- This reverses the glossary's earlier definition of **Team** (which said teammates do not share board state). `CONTEXT.md` has already been updated, and the ADR records the reasoning.
- The shared board means a team effectively has 6 lives against one board. This asymmetry against FFA is intentional (see the ADR).
- A mistake's effect (the revealed cell) is shared while its cost is not, so a teammate's mistake gives you information for free. This is intentional.
