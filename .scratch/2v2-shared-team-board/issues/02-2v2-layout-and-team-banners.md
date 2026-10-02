Status: done

# 2v2 layout and team-only result banners

## Parent

`.scratch/2v2-shared-team-board/PRD.md`

## What to build

Replace issue 01's stopgap sidebar with a 2v2 layout that shows two boards in play, not four, and make the result banners credit the team rather than an individual.

- **Opponent-team card.** In the sidebar, the two per-player opponent cards become one card for the opposing team. It shows:
  - their Team Board, blurred during play and unblurred at match end (same behaviour as today);
  - one progress bar for that board;
  - both opponents' names, each with their own lives and connected/eliminated status;
  - the opposing-team accent colour.
- **Teammate status line.** Your teammate no longer gets a sidebar card or mini-board. They appear as a compact line under your main board showing name, lives and connected/eliminated status, in the own-team accent colour. Keep the colour-only distinction: no "Your Team" / "Opponents" text labels.
- **Result banners (2v2).**
  - The winning team sees "Your team solved it!".
  - The losing team sees "Team N solved it first".
  - No 2v2 banner names an individual finisher.
  - Forfeit and wipeout wording (e.g. "Opponent left — your team wins!") and the abandon-confirmation wording stay as they are.
- FFA layout and banners are unchanged.

Rough sketch (from the design session):

```
┌──────────────────────────────┐   ┌─────────────────────────┐
│  YOUR TEAM BOARD (playable)  │   │ ▌ OPPOSING TEAM (coral) │
│                              │   │ ▌ ┌───────────────────┐ │
│   (big interactive grid)     │   │ ▌ │ blurred Team Board│ │
│                              │   │ ▌ │ (unblurs at end)  │ │
└──────────────────────────────┘   │ ▌ └───────────────────┘ │
 You    ♥♥♥                         │ ▌ ████████░░░░  62%     │
 Bob    ♥♡♡  (teammate, sage)       │ ▌ Carol   ♥♥♡           │
                                    │ ▌ Dave    ♡♡♡  out      │
                                    └─────────────────────────┘
```

## Acceptance criteria

- [ ] In 2v2, the sidebar shows exactly one opposing-team card, with their blurred Team Board, one progress bar, and both opponents' names, lives and status.
- [ ] The opposing Team Board unblurs when the match finishes.
- [ ] The teammate appears as a status line under the main board (name, lives, connected/eliminated) with no mini-board.
- [ ] Team accent colours are kept (sage for own team, coral for opponents), with no text team labels.
- [ ] The winning team's banner reads "Your team solved it!", and the losing team's reads "Team N solved it first". Neither names a player.
- [ ] Forfeit and wipeout banners still show their current wording.
- [ ] FFA modes render exactly as before.
- [ ] Checked by hand with 4 browser sessions against the dev stack: a full 2v2 match through to a win, plus one match ending in team wipeout.

## Blocked by

- `.scratch/2v2-shared-team-board/issues/01-shared-team-board.md`
