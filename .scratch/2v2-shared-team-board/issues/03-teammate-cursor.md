Status: ready-for-agent

# Teammate Cursor, end to end

## Parent

`.scratch/2v2-shared-team-board/PRD.md`

## What to build

Show each 2v2 player their teammate's live mouse pointer (the **Teammate Cursor**, see `CONTEXT.md`) over their board, and never show it to the opposing team. This issue delivers the working pointer that jumps straight to each new position. Smooth motion is issue 04.

- **Protocol.**
  - The client sends a `cursor` message containing either `{ x, y }` in *board coordinates* or `null`. Board coordinates are fractional column and row positions measured over the cell area, not the clues; `x = 2.4` means 40% of the way across column 2. This makes the position independent of window size and cell size.
  - The server forwards it as `teammateCursor` (`{ x, y }` or `null`) **only** to the sender's teammate. It is never broadcast, never sent to opponents, never part of the state update and never stored.
- **Server checks.** Ignore `cursor` in these cases:
  - outside 2v2;
  - outside the `playing` phase;
  - from a player who is done;
  - with a non-finite or out-of-range value (valid range: `0 ≤ x ≤ width`, `0 ≤ y ≤ height`);
  - from a client sending faster than a sanity cap (set well above the client's ~20 per second).
- **Server clears the cursor.** Send `teammateCursor: null` to the teammate when a player is eliminated, drops or leaves, and to everyone still in the room when the match ends.
- **Client sending.**
  - Throttle to about 20 sends per second, and only send when the position has changed.
  - Send `null` when the pointer leaves the board.
  - Also send `null` when the window loses focus or the tab is hidden (`blur` / `visibilitychange`), because `pointerleave` does not reliably fire when a user alt-tabs away. Without this, the pointer is left frozen on the teammate's screen.
  - Position updates continue during drag-painting.
- **Client rendering.**
  - Draw a sage (own-team colour) arrow as an overlay on the main board, with no name label and no cell or row highlight.
  - Position the overlay inside the grid's **cell area** (not relative to the page or the whole board including clues), so the clue columns and page layout can't offset it.
  - **Performance (important):** cursor updates must not re-render the page or the grid. Keep the pointer in its own overlay, updated through a ref and a CSS transform (e.g. from a `requestAnimationFrame` loop), not through parent React state. Otherwise the whole board re-renders about 20 times a second, and large boards stutter.
  - Hide the pointer on `null`, when the teammate is done or disconnected, and when the match is finished. The viewer's own pointer gets no extra rendering.
  - An eliminated (spectating) player still sees their surviving teammate's pointer.

## Acceptance criteria

- [ ] A `cursor` from a 2v2 player is received by their teammate as `teammateCursor` with the same coordinates.
- [ ] Neither opponent ever receives a `teammateCursor`. There is a server test for this.
- [ ] `cursor` is ignored in FFA modes, outside `playing`, from a done player, and with out-of-range or non-finite values. There are server tests for this.
- [ ] Messages above the rate cap are dropped.
- [ ] The teammate receives `teammateCursor: null` when the sender is eliminated or leaves, and clients receive `null` when the match ends. There are server tests for this.
- [ ] The sage pointer appears over the right spot on the teammate's board even when the two windows have different sizes or cell sizes.
- [ ] Moving the mouse off the board, alt-tabbing away, or switching tabs clears the pointer on the teammate's screen.
- [ ] The pointer follows drag-painting.
- [ ] Cursor updates cause no re-render of the grid (check with React DevTools Profiler or equivalent), and play on a 20×20 board stays smooth while the teammate moves their mouse.
- [ ] Checked by hand with 2 browser sessions of different sizes in a 2v2 match against the dev stack.

## Blocked by

None - can start immediately. It touches the same room and page files as issue 01, so expect merge overlap if they run in parallel.
