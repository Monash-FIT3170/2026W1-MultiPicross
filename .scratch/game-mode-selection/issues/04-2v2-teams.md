Status: done

# 2v2 teams: assignment and team-aware win/leave logic

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

Implement the `2v2` mode (see `CONTEXT.md` for the Team definition). Each player on a team still solves their own independent board — teammates do not share board state. A team wins the instant either of its members completes the puzzle, and the match ends immediately for all 4 players at that point (unlike FFA, which keeps racing — see the FFA slice).

**Team assignment:** derived from join order, computed fresh each time a player joins (not locked in pre-match): the 1st and 2nd players to join a `2v2` room are Team 1, the 3rd and 4th are Team 2 (`team = Math.floor(this.players.size / 2)`, computed before inserting the new player — Colyseus serializes `onJoin` calls per room, so this is race-free). This is deliberately sequential (not alternating), so a room creator who invites one friend via invite code ends up teamed with them. If a player leaves during the waiting phase before the room is full, team assignment recomputes from current membership as new players join — it only becomes fixed once the match starts.

**Win logic:** in `PicrossRoom.ts`'s completion branch, when `modeConfig.teamBased`, set `won = true` and `winnerId` (if unset) on completion, then end the match (`setPhase("finished")`) immediately regardless of other players' state — do not wait for "all done" like FFA does.

**Leave/elimination logic:** one team member leaving or being eliminated does not forfeit the team — the remaining teammate keeps playing normally toward the team's win. A team is only knocked out once BOTH its members have left/been eliminated. Reuse (or extend, if the FFA slice's helper doesn't already generalize) the sole-survivor helper for teams: if one team is fully eliminated while the other team has any active member remaining, that team auto-wins immediately without needing to finish — pick either of the surviving team's active members as `winnerId`; the client derives "my team won" from `winnerId`'s `team` field matching the viewer's own `team`, not from a separate `winningTeam` field.

**Important, resolved during implementation:** unlike FFA (where elimination by lives never triggers an automatic win, only a leave does), a full **team** wipeout auto-wins the match for the other team even when it happens purely through elimination with no leave involved. A fully eliminated team is a clearer terminal state than "last FFA player standing" is for N individuals. This is implemented as a separate `checkTeamWipeout()` helper (distinct from FFA's `checkSoleSurvivor()`), called from both `onLeave` and `handlePlayerElimination`.

**Also found and fixed while implementing this:** the FFA slice's `checkSoleSurvivor()` originally bailed out entirely once `winnerId` was already set (guarding against overwriting an existing winner) — but in FFA, `winnerId` is set on the very first finish while the match is still "playing" (remaining players keep racing for placement), so this guard incorrectly prevented a later sole-survivor ending from ever firing once anyone had already finished. Fixed so `checkSoleSurvivor` still ends the match for a lone remaining player even after an earlier finisher exists — it just doesn't overwrite `winnerId` (the recorded 1st place stays put). A similar bug existed in `handlePlayerElimination`'s "all players done" check (guarded on `!this.winnerId`, which incorrectly blocked the match from ending once someone had already won) — fixed to guard on `this.state.phase === "playing"` instead.

`PlayerData` gains a `team: number | null` field (null for non-team-based modes). `buildSnapshot()` includes each player's `team`.

## Acceptance criteria

- [x] In a `2v2` room, the 1st and 2nd joiners are assigned Team 1 (`team: 0`), 3rd and 4th are Team 2 (`team: 1`) — verify via snapshot.
- [x] If the 2nd joiner leaves before the room is full, the next joiner takes their place on Team 1 (reassignment works correctly pre-match).
- [x] Once the match starts, team assignment does not change for the rest of the match.
- [x] Either team member finishing ends the match immediately for all 4 players (teammate and both opponents included), regardless of their own progress.
- [x] One team member leaving mid-match does not end the match or forfeit the team; the remaining teammate can still win normally.
- [x] If both members of one team leave/are eliminated while the other team has an active member, that team is declared the winner immediately without needing to finish. (Elimination-triggered team wipeout is a deliberate 2v2-specific exception to FFA's leave-only sole-survivor rule — see note above.)
- [x] `forfeit`/`winnerId` semantics are consistent with the FFA slice's shared helper (reuse, don't duplicate, if that slice has already landed — otherwise implement compatibly).
- [x] New tests cover: team assignment by join order, reassignment on pre-match leave, immediate match-end on first team-member finish, one-member-leaves-team-continues, and team sole-survivor auto-win (both via leave and via pure elimination).
- [x] Existing 1v1 tests pass unmodified (non-team-based modes are unaffected — `team` stays `null`).

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
