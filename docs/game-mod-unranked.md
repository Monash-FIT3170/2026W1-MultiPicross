# PRD: Unranked Game Mode Selection

**Status:** Approved for implementation
**Scope:** Unranked play only. Ranked play (matchmaking, rules, Elo) is explicitly unchanged.

---

## 1. Problem / Goal

Multipicross currently only supports 1v1 matches. We want players to choose a match format before entering an **unranked** game, so casual play supports larger free-for-all races and team play, not just head-to-head.

Ranked play stays exactly as it is today — 1v1, Elo-rated, matchmaking-queue-based. This PRD does not touch it.

## 2. Game Modes

| Mode    | Players | Structure        | Win condition                                       |
| ------- | ------- | ---------------- | --------------------------------------------------- |
| 1v1     | 2       | Individual       | First to complete the puzzle wins                   |
| 1v1v1   | 3       | Individual (FFA) | First to complete wins; others keep racing          |
| 1v1v1v1 | 4       | Individual (FFA) | First to complete wins; others keep racing          |
| 2v2     | 4       | 2 teams of 2     | First team with a member completing the puzzle wins |

All players/teams in a match solve the **same** puzzle. Terms are defined precisely in `CONTEXT.md` (Game Mode, FFA, Team, Elimination, Sole Survivor, Placement).

## 3. Out of Scope

- Ranked matchmaking, ranked rules, Elo calculation, `player_elo_history`/`rated_waiting_list` schema — **zero changes**.
- A new matchmaking queue for unranked play. Unranked modes extend the existing create-room / join-by-code / public-room-browser flow; no "search for players" queue is introduced.
- Late joining mid-match, for any mode.
- Manual/early match start before a room reaches its mode's full player count.
- Post-game board reveal for other players (see Step 5) — this is an intentional simplification versus today's 1v1 blur-then-reveal.
- Any change to `NonogramGrid.tsx`, singleplayer, the puzzle bank, or auth.

---

## Step 1 — Game Mode as a concept

Define four selectable modes: `1v1`, `1v1v1`, `1v1v1v1`, `2v2`. Each implies:

- Required player count (2, 3, 4, 4)
- Whether it's team-based (`2v2` only)
- Team count (2, for `2v2`)

This is a single, shared, mode-agnostic concept — not four hardcoded parallel implementations. It is scoped to unranked rooms only; ranked's room-creation path is untouched and implicitly keeps behaving as `1v1`.

**Acceptance criteria**

- A room can be created with any of the 4 modes.
- Ranked-created rooms are unaffected and behave exactly as before.

## Step 2 — Room capacity and start trigger

A room does not start (does not transition to "playing") until the number of joined players exactly equals the mode's required player count. No manual start button. No early start with a partial lobby.

**Acceptance criteria**

- A `1v1v1v1` room with 3/4 players stays in the waiting state.
- The room starts automatically the instant the 4th player joins.
- 1v1 behavior is unchanged (starts at 2/2, as today).

## Step 3 — 2v2 team assignment

Teams are assigned by join order: the 1st and 2nd players to join are Team 1; the 3rd and 4th are Team 2. This means a room creator who shares an invite code with one friend (their natural 2nd joiner) ends up teamed with that friend.

Team assignment is **not** locked in early — if a player leaves during the waiting phase, team assignment is recomputed fresh from current join order as new players fill the room, right up until the match starts.

**Acceptance criteria**

- In a 2v2 room, the 1st and 2nd joiners are shown as Team 1; 3rd and 4th as Team 2.
- If the 2nd joiner leaves before the room is full, the next joiner takes their place on Team 1.
- Once the match starts, team assignment is fixed for the remainder of the match.

## Step 4 — Win conditions and match end

**FFA (1v1v1 / 1v1v1v1):**

- The match does **not** end when the first player finishes. Remaining players keep racing.
- The match ends once every remaining player has either finished (won) or been eliminated (out of lives, or left).
- Only players who actually complete the puzzle receive a numbered placement (1st, 2nd, ...), in completion order. Players who don't finish are simply "did not finish" — no ranking between them.

**2v2:**

- The match ends immediately for all 4 players the instant either member of a team completes the puzzle. The whole match stops — the winning player's teammate and both opposing players do not continue.
- There is no placement concept beyond team win/loss.

**Acceptance criteria**

- FFA: match continues after the first finisher; ends only when all players are done; finishers are placed in completion order; non-finishers are unplaced.
- 2v2: any single completion ends the match for all 4 players immediately.
- Existing 1v1 behavior (win on first completion) is unchanged, since 1v1 is a degenerate case of both rules.

## Step 5 — Leaving, disconnecting, and elimination

- A player leaving or being eliminated (out of lives) mid-match does **not** automatically hand a win to a specific opponent. It simply removes/eliminates that player, and the match continues for everyone still active.
- **Exception — Sole Survivor:** if a leave or elimination drops the active field to exactly one remaining player (FFA) or exactly one team with any active member left (2v2), that player/team is declared the winner immediately, without needing to finish the puzzle. This generalizes the existing 1v1 "last player standing wins" rule.
- In 2v2, one team member leaving does not forfeit the team — the remaining teammate keeps playing normally. The team is only eliminated once both members have left/been eliminated.
- Late joining to backfill an empty slot is not supported, for any mode.

**Acceptance criteria**

- FFA: a player leaving mid-match eliminates only them; others keep playing.
- FFA: if all but one player have left/been eliminated, that player auto-wins.
- 2v2: one member leaving does not end their team's chances; the teammate continues.
- 2v2: if an entire opposing team is eliminated/left, the surviving team auto-wins immediately.
- Existing 1v1 sole-survivor behavior is unchanged.

## Step 6 — In-match visibility (progress bars, not opponent boards)

Every player still has their own independent board and progress — 2v2 teammates do **not** share a board. What changes is what other players can see of each other:

- A player only ever sees their **own** full board (cells, crosses, mistakes) in detail.
- Every other player in the match (opponents, and in 2v2, your own teammate too) is represented as a compact **progress bar**: percentage of the puzzle correctly filled, lives remaining, and finished/eliminated status. Their actual board layout is not shown.
- This replaces today's 1v1 behavior of showing a blurred (but still fully present) copy of the opponent's board. It also closes a minor information leak, since blur was only a visual/CSS treatment.
- This holds true for the rest of the match, including after it ends — there is no "reveal everyone's board" moment at the end. The summary shows final progress/placement instead.

**Acceptance criteria**

- A player's client only ever receives full board detail for themselves.
- Other players show as progress bars with live-updating percentage, lives, and status.
- No board data for other players is ever sent to the client, even once the match ends.

## Step 7 — Create / join UI

- The existing "Create lobby" flow (board size + public/private toggle) gains a mode selector (1v1 / 1v1v1 / 1v1v1v1 / 2v2), defaulting to 1v1. Each option makes clear how many players it requires.
- Mode is fully independent of board size — no restrictions or defaults coupling the two.
- All 4 modes are available as both public (browsable) and private (invite-code) rooms — no restriction either way.
- The public room browser shows each room's mode explicitly (not just a player-count fraction), since `2v2` and `1v1v1v1` both cap at 4 players and would otherwise be indistinguishable.
- Guests (players without an account) can create/join any of the 4 modes, exactly as they can with 1v1 today.

**Acceptance criteria**

- Mode can be selected at room creation.
- Public room listings show mode + current/required player count (e.g. "1v1v1v1 · 15×15 · 3/4 players").
- No guest restrictions on any mode.

## Step 8 — Waiting room UI

- Shows "X/N players joined" appropriate to the selected mode, with placeholder rows for remaining open slots.
- For 2v2, joined players are grouped under "Team 1" / "Team 2" headings as they join, reflecting the live (not-yet-locked-in) team assignment from Step 3.

**Acceptance criteria**

- Waiting room correctly reflects required vs. joined count for all 4 modes.
- 2v2 waiting room visibly groups players by (current) team.

## Step 9 — In-match UI

- The player's own board remains the large, central, interactive element, exactly as today.
- Every other player is shown as a progress-bar row (per Step 6): username, progress %, lives remaining, finished/eliminated status, and for FFA finishers, their placement.
- For 2v2, teammate vs. opponent rows are visually distinguished by color coding only (no "Your Team" / "Opponents" text labels).
- On narrow (mobile) screens, the layout stacks: board on top, progress-bar list full-width below — consistent with the existing mobile collapse pattern used elsewhere in the app.

**Acceptance criteria**

- All non-self players are visible as progress rows during a live match.
- 2v2 rows are color-coded by team.
- Layout is usable on both desktop and mobile widths.

## Step 10 — Outcome & abandon messaging

- End-of-match banner: names the winner (FFA) or winning team (2v2) rather than assuming a single fixed opponent, while preserving the existing "you won / you lost / no winner" visual treatment.
- Abandon-confirmation dialog copy is generalized per mode:
  - FFA: leaving eliminates you from the race (no single opponent is named as "the winner" by your leaving, since it takes a sole-survivor situation to trigger an automatic win).
  - 2v2: leaving warns that your team continues without you if your teammate is still active, or that your team forfeits if your teammate has already been eliminated too.

**Acceptance criteria**

- Outcome banner text is correct for all 4 modes.
- Abandon dialog warns correctly based on mode and current match state.

## Step 11 — URL / naming cleanup

- The existing `?mode=ranked` URL parameter (used only to distinguish Ranked vs. Unranked navigation) is renamed to `?type=ranked` to avoid colliding with the new per-match Game Mode concept.
- Game Mode itself is never carried in the URL — it is sourced from the server's room state once connected, avoiding a second source of truth.

**Acceptance criteria**

- Ranked vs. unranked navigation continues to work correctly after the rename.
- No regressions to existing ranked flow from this rename.

---

## Testing

- Automated tests extend the existing multi-client Colyseus test harness (`PicrossRoom.test.ts`) to cover: capacity gating per mode, 2v2 team assignment and reassignment, FFA continue-after-first-finish and placement, sole-survivor auto-win (FFA and 2v2), team-member-leaves-without-forfeiting (2v2), and snapshot data scoping (own board vs. others' progress-only).
- Manual end-to-end verification across all 4 modes, plus a regression pass confirming existing 1v1 unranked and ranked flows are unaffected.

## Glossary

See `CONTEXT.md` at the repository root for canonical definitions of: Game Mode, Free-for-All (FFA), Team, Elimination, Sole Survivor / Sole Surviving Team, Placement, and Ranked/Unranked (Game Type).
