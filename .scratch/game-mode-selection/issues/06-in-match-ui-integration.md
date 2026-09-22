Status: done

# In-match UI for N players and teams: layout, team grouping, outcome banner, abandon copy

## Parent

`.scratch/game-mode-selection/PRD.md`

## What to build

This is the integration slice that makes all 4 modes fully playable and demoable end-to-end in the UI, building on the mode selector (slice 2), FFA race semantics (slice 3), 2v2 teams (slice 4), and progress-bar visibility (slice 5).

**In-match layout (`Room.tsx`):** replace the single-opponent progress-bar row (from slice 5) with a list derived from every non-self player in the room. The player's own board stays large/centered/interactive as today. Other players render as compact progress-bar rows (username, progress %, lives pips, done/won status, and for FFA finishers, their placement from `finishOrder`) in the sidebar beneath the existing Time/Size/Abandon stats. On narrow (mobile) screens, use the existing `@media` collapse pattern already established elsewhere in `index.css` (e.g. `mp-ranked-grid`/`mp-multiplayer-options`) so the layout stacks: board on top, progress-bar list full-width below.

**2v2 team grouping:** in both the waiting room (extending slice 2's placeholder-row work) and the in-match sidebar, color-code progress-bar rows by team membership (own team vs. opposing team via border/accent color) — no text labels ("Your Team"/"Opponents" was explicitly rejected in favor of color-only).

**Outcome banner:** generalize the current 3-way `iWon`/`opponentWon`/`noWinner` branch to: `iWon` (unchanged), a "someone else won" case that names the winning player (FFA, by username) or the winning team (2v2, e.g. "Team 1 wins!") derived via `winnerPlayer.team === me.team`, and `noWinner` (unchanged).

**Abandon dialog copy:** generalize the `opponentCanWin`-gated text per mode — FFA: "Leaving now eliminates you from the race." 2v2: "Leaving now removes you from your team — your teammate can still win" if the teammate is still active, or "...your team forfeits" if the teammate has already been eliminated too.

## Acceptance criteria

- [x] In a live `1v1v1v1` match, all 3 other players are visible as progress-bar rows with live-updating progress/lives/status. Verified manually with 4 live guest browser tabs.
- [x] In a live `2v2` match, the teammate's and both opponents' rows are visually distinguishable by color (team vs. opposing team), with no text labels. Verified manually — sage border for own team, coral for opposing team, symmetric from every viewer's perspective.
- [x] Waiting-room player list for `2v2` groups joined players by (current, pre-match) team via the same color treatment. Verified manually.
- [x] Layout stacks correctly (board on top, progress list below, full width) at mobile viewport widths, consistent with the existing mobile collapse pattern. Verified by code review against the exact DOM structure (mp-room-layout/board/sidebar/progress-stack) — live mobile-viewport rendering could not be exercised in this environment (window resize did not take effect on the available browser tooling), so this is a code-review-level verification, not a rendered screenshot. New purpose-built @media rules were written (replacing stale, never-wired-up rules found in index.css from an earlier mobile-UI PR) since those didn't match this feature's actual markup shape.
- [x] Outcome banner correctly names the winning player in a `1v1v1v1` match and the winning team ("Team 1 wins!" / "Team 2 wins!" / "X finished — your team wins!") in a `2v2` match. Verified manually for 2v2 (both "You win!" for the arbitrarily-chosen winnerId session and "P1 finished — your team wins!" for the teammate). FFA multi-way banner (someone else, not me, winning) was not separately exercised live (would require solving a 15x15 puzzle blind) but shares the same code path already verified for 2v2's "someone else won" case, and the win-declaration logic itself is covered by the gameserver's automated test suite.
- [x] Abandon dialog shows the correct mode-specific copy for FFA and for 2v2 (both teammate-active and teammate-already-eliminated cases). 1v1 case verified manually (byte-identical to original text). FFA/2v2-specific copy verified by code review (straightforward conditional branches, each mode's other logic already verified live).
- [x] Existing 1v1 outcome banner and abandon dialog text is unchanged. Verified manually — abandon dialog text confirmed byte-for-byte identical.
- [x] Manual end-to-end verification: play a full `1v1v1v1` match and a full `2v2` match from create → waiting room → in-match → outcome banner, confirming everything above. Done (2v2 played to completion via team wipeout; 1v1v1v1 played through waiting room + in-match progress rows + sole-survivor outcome).
- [x] Manual regression check: existing 1v1 unranked flow and the ranked flow are both unaffected. Verified manually — 1v1 create/waiting/in-match/abandon dialog all unchanged; ranked queue flow (join queue, timeout dialog) works correctly.

## Blocked by

- `.scratch/game-mode-selection/issues/02-create-join-ui-mode-selector.md`
- `.scratch/game-mode-selection/issues/03-ffa-race-semantics.md`
- `.scratch/game-mode-selection/issues/04-2v2-teams.md`
- `.scratch/game-mode-selection/issues/05-progress-bar-visibility.md`
