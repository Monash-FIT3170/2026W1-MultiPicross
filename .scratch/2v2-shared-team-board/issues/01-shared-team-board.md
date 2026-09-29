Status: ready-for-agent

# Shared Team Board, end to end

## Parent

`.scratch/2v2-shared-team-board/PRD.md`

## What to build

Make `2v2` teams solve a single shared **Team Board** (see `CONTEXT.md`; the reasoning is in `docs/adr/0001-2v2-shared-team-board.md`).

- **Server.** In team-based modes, the room keeps board state (confirmed fills, crosses, revealed empties, mistake crosses) per team instead of per player. The fill and cross handlers pick the board from the acting player: their team's board in 2v2, their own board otherwise. Auto-complete, completion checks and progress then run unchanged on that board. Lives, done, won, connected and team stay per player.
- **Who can act.** A move is ignored if the acting player is done (eliminated, won or left), even though their teammate can still act on the same board. The existing cell-state checks apply to the shared board, so two concurrent moves on the same cell resolve in the order they arrive: the first applies, the second is a no-op.
- **Mistakes.** A mistake costs only the acting player a life, but the revealed cell is written to the Team Board. The `mistake` message goes to every member of the acting player's team, and must still arrive before the state update.
- **Winning.** Completing a Team Board ends the match immediately for all 4 players, with that team winning. The completion check runs before the elimination check, so a move that completes the board *and* uses up the actor's last life is a win. `winnerId` stays the acting player's session internally. Team wipeout and sole surviving team logic are unchanged.
- **State update.** In 2v2, the state update gains a `teamBoards` map keyed by team index. Each entry holds that board's arrays plus its `progress`. In 2v2, player entries drop their board arrays and per-player progress. FFA state updates are unchanged. All boards still go to every client, as today.
- **Frontend.**
  - Each player's main board renders their Team Board. When the player is done, the board still updates live but ignores clicks, so an eliminated player spectates.
  - The existing per-player sidebar cards keep working by showing each player's team's board and progress. This is a deliberate stopgap until issue 02 redesigns the layout.
  - The `mistake` handler's comment ("sent only to the player who made the mistake") must be updated to match the new behaviour.
- FFA and ranked behaviour must be completely unchanged.

## Acceptance criteria

- [ ] In 2v2, a fill by one teammate appears on the other teammate's board, and the opposing team's board is unaffected.
- [ ] Either teammate can place or remove any cross on their Team Board, and filling a crossed cell clears the cross.
- [ ] A row or column auto-crosses when its clue is satisfied, whichever teammate filled the last cell of it.
- [ ] A mistake costs only the acting player's life, the revealed cell appears on the Team Board, and both teammates receive `mistake`.
- [ ] An eliminated player's `fill` and `cross` messages are ignored, and their main board is non-interactive but keeps updating live.
- [ ] The surviving teammate of an eliminated or departed player can still complete the Team Board and win for the team.
- [ ] Completing a Team Board ends the match for all 4 players with that team winning, including when the final cell is revealed by the actor's life-ending mistake.
- [ ] Team wipeout (both members of a team eliminated or left) still gives the other team the win.
- [ ] A player who reconnects mid-match sees the current Team Board, including moves their teammate made while they were away.
- [ ] 2v2 state updates carry `teamBoards`, and FFA state updates still carry per-player boards.
- [ ] The existing sidebar still renders in 2v2 without errors (stopgap: per-player cards show their team's board).
- [ ] New server integration tests cover the above in `PicrossRoom.test.ts`, using real clients and asserting only on messages they receive. All existing tests (1v1, 1v1v1, team assignment, ranked) pass unchanged.

## Blocked by

None - can start immediately.
