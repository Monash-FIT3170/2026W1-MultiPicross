---
status: accepted
---

# 2v2 teams share one board, but lives stay per-player

2v2 originally gave every player their own independent board, which made it little more than FFA with pooled wins. We replaced it (rather than adding a separate co-op mode) so that each team solves a single shared **Team Board**: every fill and cross from either teammate lands on it. Lives were deliberately _not_ moved to the board — each teammate keeps their own 3, a mistake costs only the teammate who made it, and an eliminated teammate is locked out while their partner keeps solving and can still win for the team.

## Considered Options

- **Lives pooled per team (3 shared).** Would have matched "one board, one team" more literally, and made elimination a team-level event. Rejected in favour of per-player lives, which keeps the existing per-player elimination and Sole Surviving Team rules working unchanged.
- **A new mode alongside the old independent-board 2v2.** Rejected — the independent-board variant offered little that FFA didn't, and a fifth mode would need its own name, selector entry, and tests.

## Consequences

- A team effectively has 6 lives against one board, so a shared-board team is more forgiving than an FFA player on the same puzzle.
- A mistake's _effect_ (the revealed cell) is shared while its _cost_ is not — a teammate's mistake helps you without costing you anything. This asymmetry is intentional.
- Board state is keyed by team, not by player, in 2v2; player state (lives, connection, elimination) is still keyed by player. FFA modes are unaffected.
