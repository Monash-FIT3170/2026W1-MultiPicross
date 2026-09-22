Status: done

# FFA race semantics: continue-after-first-finish, placement, sole survivor

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

For the Free-for-All modes (`1v1v1`, `1v1v1v1` — see `CONTEXT.md` for the FFA definition), change match-end behavior so the match does NOT end the instant the first player finishes. Instead, the match continues until every player has either finished (won) or been eliminated (out of lives, or left).

Only players who actually complete the puzzle receive a numbered placement, in completion order (1st, 2nd, ...). Players who don't finish are simply "did not finish" — not ranked relative to each other.

Leaving or being eliminated mid-match does not automatically hand a win to a specific opponent — it just removes/eliminates that player and the match continues for whoever's left. **Exception (Sole Survivor):** if a **leave** drops the active field to exactly one remaining player, that player is declared the winner immediately without needing to finish — this generalizes the existing 1v1 "last player standing wins" rule (currently a hardcoded `survivors.length === 1` check in `PicrossRoom.onLeave`).

**Important, resolved during implementation:** sole-survivor auto-win is triggered by a **leave only, never by elimination (running out of lives)** — regardless of player count or how many players have already left. This matches the existing 1v1 test `"does not crown an eliminated player when the opponent leaves"`, which expects that eliminating one player while another is still connected and active does NOT end the match — the survivor must keep playing until they either finish or the opponent actually leaves. Running out of lives only ends the match once *every* remaining player is done (won or eliminated) — see `allPlayersDone()`.

Concretely, in `PicrossRoom.ts`:
- `handleFill`/`handleCross`'s completion branch (`handlePlayerWin`): for FFA modes, on completion set that player's `won = true`, set `winnerId` only if unset (first finisher stays first), record them in a new `finishOrder: string[]` list — but do NOT end the match. Instead check whether all players are now done (won or eliminated) via a shared helper, and only then transition to `"finished"`. Team modes (2v2) end the match immediately instead, unchanged from today's behavior.
- The lives-exhausted branch (`handlePlayerElimination`) only checks `allPlayersDone()` — it never triggers sole-survivor.
- `checkSoleSurvivor()` is called only from `onLeave`, after removing the leaving player: if exactly one non-eliminated player remains, declare them the winner and end the match. `forfeit = true` is set unconditionally by `onLeave` on any leave during "playing" (matching today's semantic that `forfeit` means "ended because someone left"), regardless of whether a winner was crowned.
- If `checkSoleSurvivor()` finds no single survivor (0, or 2+, remain active) and the match hasn't ended, `onLeave` separately checks `allPlayersDone()` to end the match with no winner if everyone remaining is already eliminated (this is what keeps the existing "no winner when the last player already lost" 1v1 test passing).
- `buildSnapshot()` includes `finishOrder` so the client can render placements.

1v1 must remain provably unchanged, since it's the degenerate 2-player case of these same rules (first-and-only finisher already ends the match; a leave already means sole-survivor-wins).

## Acceptance criteria

- [ ] In a `1v1v1v1` match, the first player to finish does not end the match; remaining players keep playing.
- [ ] The match ends once all 4 players are won/eliminated; finishers appear in `finishOrder` in completion order; non-finishers are absent from `finishOrder`.
- [ ] A player leaving mid-`1v1v1v1`-match with 2+ others still active does not end the match or declare anyone a winner.
- [ ] If a leave drops the field to exactly one active player, that player is declared the winner immediately (no need to finish), consistent with today's 1v1 rule.
- [ ] An elimination (out of lives) never auto-wins the match for a sole remaining active player, regardless of player count or prior leaves — they must keep playing until they finish or someone actually leaves.
- [ ] `forfeit` is `true` for any match that ends via a leave (whether or not a winner was crowned), and `false` when the match ends via elimination (everyone done, no leave involved).
- [ ] Existing 1v1 tests in `gameserver/test/PicrossRoom.test.ts` pass unmodified.
- [ ] New tests cover: continue-after-first-finish, `finishOrder` correctness, leave-without-ending-match, and sole-survivor auto-win for a 3-4 player FFA room.

## Blocked by

- `.scratch/game-mode-selection/issues/01-mode-foundation-capacity-gating.md`
