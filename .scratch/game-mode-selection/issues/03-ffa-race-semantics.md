Status: ready-for-agent

# FFA race semantics: continue-after-first-finish, placement, sole survivor

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

For the Free-for-All modes (`1v1v1`, `1v1v1v1` — see `CONTEXT.md` for the FFA definition), change match-end behavior so the match does NOT end the instant the first player finishes. Instead, the match continues until every player has either finished (won) or been eliminated (out of lives, or left).

Only players who actually complete the puzzle receive a numbered placement, in completion order (1st, 2nd, ...). Players who don't finish are simply "did not finish" — not ranked relative to each other.

Leaving or being eliminated mid-match does not automatically hand a win to a specific opponent — it just removes/eliminates that player and the match continues for whoever's left. **Exception (Sole Survivor):** if a leave or elimination drops the active field to exactly one remaining player, that player is declared the winner immediately without needing to finish — this generalizes the existing 1v1 "last player standing wins" rule (currently a hardcoded `survivors.length === 1` check in `PicrossRoom.onLeave`).

Concretely, in `PicrossRoom.ts`:
- `handleFill`/`handleCross`'s completion branch: for FFA modes, on completion set that player's `won = true`, set `winnerId` only if unset (first finisher stays first), record them in a new `finishOrder: string[]` list — but do NOT end the match. Instead check whether all players are now done (won or eliminated) via a shared helper, and only then transition to `"finished"`.
- The lives-exhausted branch (`livesLeft === 0`) uses the same "all players done" helper.
- Add a shared `checkSoleSurvivor()`-style helper, called after any elimination (leave or lives-exhausted) when there's no winner yet: if exactly one non-eliminated player remains, declare them the winner and end the match. Reuse the existing `winnerId` field and `forfeit` flag (set `forfeit = true` only when triggered by a leave, not by lives exhaustion — matching today's semantic that `forfeit` means "ended because someone left").
- `onLeave` calls this helper instead of its current hardcoded 2-player survivor check; if 2+ players remain active after a leave, the match simply continues (no forced finish).
- `buildSnapshot()` includes `finishOrder` so the client can render placements.

1v1 must remain provably unchanged, since it's the degenerate 2-player case of these same rules (first-and-only finisher already ends the match; a leave already means sole-survivor-wins).

## Acceptance criteria

- [ ] In a `1v1v1v1` match, the first player to finish does not end the match; remaining players keep playing.
- [ ] The match ends once all 4 players are won/eliminated; finishers appear in `finishOrder` in completion order; non-finishers are absent from `finishOrder`.
- [ ] A player leaving mid-`1v1v1v1`-match with 2+ others still active does not end the match or declare anyone a winner.
- [ ] If a leave/elimination drops the field to exactly one active player, that player is declared the winner immediately (no need to finish), consistent with today's 1v1 rule.
- [ ] `forfeit` is `true` only when the match ended via a leave-triggered sole-survivor win, not via elimination-triggered sole-survivor win.
- [ ] Existing 1v1 tests in `gameserver/test/PicrossRoom.test.ts` pass unmodified.
- [ ] New tests cover: continue-after-first-finish, `finishOrder` correctness, leave-without-ending-match, and sole-survivor auto-win for a 3-4 player FFA room.

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
