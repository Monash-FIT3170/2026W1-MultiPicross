Status: ready-for-human

# Smooth teammate cursor motion

## Parent

`.scratch/2v2-shared-team-board/PRD.md`

## What to build

Make the **Teammate Cursor** glide rather than stutter. Updates arrive about 20 times a second, and unevenly, because of network jitter. Jumping straight to each position (issue 03) looks jerky.

- Keep a short buffer of received positions with their arrival times. Render the pointer at "now minus a fixed delay" (start at about 100ms), working out the position between the two buffered samples on either side of that time.
- If the buffer runs out (no newer sample), hold at the last position rather than extrapolating.
- A `null` hides the pointer immediately, with no delay. When the pointer reappears after being hidden, it snaps to the first new position instead of sliding in from the old one.
- All of this stays inside the cursor overlay's own animation loop (per issue 03's performance rule) and must not re-render the grid.

This is **HITL** because the right delay and feel can only be judged by a human: try it with 2 browsers (ideally with some artificial latency or jitter) and tune the delay.

## Acceptance criteria

- [ ] The teammate's pointer moves smoothly with no visible stutter under normal network conditions.
- [ ] With simulated jitter (e.g. browser devtools network throttling), the motion stays smooth and the added delay isn't distracting.
- [ ] Clearing the pointer (leaving the board, blur, elimination, match end) hides it immediately.
- [ ] When the pointer reappears after being hidden, it snaps to the new position rather than sliding across the board.
- [ ] Still no grid re-renders from cursor updates.
- [ ] A human has signed off on the feel and the chosen delay value.

## Blocked by

- `.scratch/2v2-shared-team-board/issues/03-teammate-cursor.md`
