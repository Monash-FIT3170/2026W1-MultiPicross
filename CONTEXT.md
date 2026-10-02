# Multipicross — Glossary

## Game Mode

One of `1v1`, `1v1v1`, `1v1v1v1`, `2v2` — determines player count, whether play is team-based, and how a match is won. Selected by the room creator when creating an **unranked** room. Ranked play is always `1v1` and does not expose Game Mode selection.

Each Game Mode implies a derived configuration: player count (`maxPlayers`), whether it's team-based (`teamBased`), and team count (`teamCount`). `1v1`/`1v1v1`/`1v1v1v1` are **Free-for-All (FFA)** — not team-based. `2v2` is team-based with 2 teams of 2.

## Free-for-All (FFA)

The non-team-based Game Modes (`1v1`, `1v1v1`, `1v1v1v1`): every player competes individually on their own board. The first player to complete the puzzle wins immediately (match ends for everyone). If no one has finished yet, the match continues until every player has either finished (won) or been eliminated (out of lives / left).

## Team (2v2 only)

A grouping of exactly 2 players who share a win/loss outcome and a single **Team Board** — both teammates solve the same board together. A team wins the instant its Team Board is completed (match ends immediately for all 4 players). The win belongs to the team as a whole — no individual teammate is credited as "the finisher," regardless of who placed the final cell. Completing the Team Board wins even if the final cell was revealed by a teammate's life-ending mistake. Team assignment is derived from join order at the moment each player joins the room: the 1st and 2nd players to join are Team 1, the 3rd and 4th are Team 2. This is recomputed fresh from current player order any time the room's membership changes pre-match (not locked in once assigned), so a player leaving the waiting room and being replaced can shift who ends up on which team.

## Team Board (2v2 only)

The single puzzle board owned by a **Team**. Every fill and cross made by either teammate lands on it, and both teammates see the same board. Crosses are shared notes: either teammate can place or remove any cross, regardless of who placed it. A cross never blocks a fill. Each team has its own Team Board; the two teams race on separate boards of the same puzzle.

## Teammate Cursor (2v2 only)

Your teammate's live mouse pointer, shown moving freely over your **Team Board** wherever they are pointing on theirs. Only teammates see it; it is never shown to the opposing team.

## Picture Reveal

The moment the solved puzzle's full coloured picture is shown. It happens for every player when the match ends, however it ended (a completion, a wipeout, a forfeit, or everyone running out of lives) and whatever their own outcome — winners, losers, eliminated players and non-finishers alike.

## Elimination

A player is eliminated when they run out of lives (3 mistakes) or leave/disconnect (forfeit) before the match ends. An eliminated player cannot win by completing the puzzle, but can still be awarded a win if they are the sole remaining active party (see Sole Survivor / Sole Surviving Team).

In 2v2, lives stay per-player even though the board is shared: each teammate has their own 3 lives, and a mistake costs a life only for the teammate who made it (the revealed cell still appears on the shared **Team Board**). An eliminated teammate can no longer act on the Team Board, but their surviving teammate keeps solving it and can still win for the team.

## Sole Survivor (FFA) / Sole Surviving Team (2v2)

If every other player (FFA) or every member of the opposing team (2v2) has left or been eliminated while at least one player (FFA) or one full team (2v2, i.e. at least one of its two members) remains active, that remaining party is declared the winner immediately, without needing to actually complete the puzzle. This generalizes the original 1v1 "opponent left, sole player remaining wins" rule.

## Placement (FFA only)

Only players who actually complete the puzzle receive a numbered placement (1st, 2nd, 3rd, ...), ordered by completion time. Players who are eliminated without finishing are not ranked relative to each other — they are simply "did not finish." (2v2 has no placement concept beyond team win/loss, since teammates share their team's outcome.)

## Ranked / Unranked (Game Type)

Existing top-level distinction, unrelated to Game Mode. **Ranked** games are always `1v1`, use the existing Elo system, and are entirely out of scope for the Game Mode feature — their matchmaking, rules, and Elo calculation are unchanged. **Unranked** games are where Game Mode selection applies; players create or join rooms directly (via invite code or the public room browser) — there is no matchmaking queue for unranked play.
