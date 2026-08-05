from PIL import Image
import numpy as np
import itertools
import time


# ---------------------------------------------------------------------------
# Image I/O
# ---------------------------------------------------------------------------

def png_to_array(picture, colour):
    """
    Takes an nxn PNG file and a colour value, then returns a 2D array
    where 1 means the pixel matches the colour and 0 means it does not.

    picture: image name (no extension)
    colour:  tuple, e.g. (0, 0, 0) or (255, 0, 0, 255)
    """
    png = "images/" + picture + ".puzzle.png"
    img = Image.open(png).convert("RGBA")
    pixels = np.array(img)

    colour = tuple(colour)
    if len(colour) == 3:
        colour = (*colour, 255)

    mask = np.all(pixels == colour, axis=-1)
    return mask.astype(int)


def array_to_png(arr, picture_name):
    height, width = arr.shape
    img = np.zeros((height, width, 4), dtype=np.uint8)
    img[arr == 1] = [0, 0, 0, 255]        # black
    img[arr == 0] = [255, 255, 255, 255]   # white
    Image.fromarray(img).save(f"images/{picture_name}.generated.png")


# ---------------------------------------------------------------------------
# HINTS
# ---------------------------------------------------------------------------

def line_to_hints(line):
    hints = []
    count = 0

    for value in line:
        if value == 1:
            count += 1
        else:
            if count > 0:
                hints.append(count)
                count = 0

    if count > 0:
        hints.append(count)

    return hints if hints else [0]


def get_row_hints(arr):
    return [line_to_hints(row) for row in arr]


def get_column_hints(arr):
    return [line_to_hints(arr[:, c]) for c in range(arr.shape[1])]


# ---------------------------------------------------------------------------
# Fast line generator (replaces brute-force possible_lines)
# ---------------------------------------------------------------------------

def possible_lines_fast(length, hints):
    """
    Generate only lines that satisfy `hints` for a line of `length` cells.
    Uses recursive group placement — no brute-force enumeration.

    Returns a list of tuples, e.g. [(0,1,0,1,...), ...]
    """
    if hints == [0]:
        return [tuple([0] * length)]

    results = []

    def place(pos, hint_idx, current):
        """
        pos:       next cell index available for writing
        hint_idx:  which group we are currently placing
        current:   cells decided so far (list)
        """
        if hint_idx == len(hints):
            # All groups placed — pad remainder with zeros and record
            results.append(tuple(current + [0] * (length - pos)))
            return

        group = hints[hint_idx]

        # Minimum space needed after this group:
        # sum of remaining group sizes + one mandatory gap between each
        remaining = hints[hint_idx + 1:]
        min_tail = sum(remaining) + len(remaining)

        # Latest valid start for this group
        last_start = length - group - min_tail

        for start in range(pos, last_start + 1):
            # Zeros from current pos up to start, then the filled group
            line = current + [0] * (start - pos) + [1] * group
            next_pos = start + group

            # Mandatory gap after group (unless this is the last group)
            if hint_idx < len(hints) - 1:
                line += [0]
                next_pos += 1

            place(next_pos, hint_idx + 1, line)

    place(0, 0, [])
    return results


# UNUSED brute-force version for reference / unit-testing
def possible_lines(length, hints):
    if hints == [0]:
        return [tuple([0] * length)]
    lines = []
    for line in itertools.product([0, 1], repeat=length):
        if line_to_hints(line) == hints:
            lines.append(line)
    return lines


# ---------------------------------------------------------------------------
# propagation + backtracking search
# ---------------------------------------------------------------------------

def _propagate(row_opts, col_opts, height, width):
    """
    Arc-consistency propagation.

    Repeatedly removes options from rows/columns that are incompatible with
    what the intersecting columns/rows still allow.  Runs until no further
    pruning is possible (fixed point).

    Mutates row_opts and col_opts in place.
    Returns (row_opts, col_opts), or (None, None) on contradiction.
    """
    changed = True
    while changed:
        changed = False

        # Values each column still allows at each row position
        col_allowed = [
            [set(col[r] for col in col_opts[c]) for r in range(height)]
            for c in range(width)
        ]

        for r in range(height):
            new_rows = [
                row for row in row_opts[r]
                if all(row[c] in col_allowed[c][r] for c in range(width))
            ]
            if not new_rows:
                return None, None
            if len(new_rows) != len(row_opts[r]):
                row_opts[r] = new_rows
                changed = True

        # Values each row still allows at each column position
        row_allowed = [
            [set(row[c] for row in row_opts[r]) for c in range(width)]
            for r in range(height)
        ]

        for c in range(width):
            new_cols = [
                col for col in col_opts[c]
                if all(col[r] in row_allowed[r][c] for r in range(height))
            ]
            if not new_cols:
                return None, None
            if len(new_cols) != len(col_opts[c]):
                col_opts[c] = new_cols
                changed = True

    return row_opts, col_opts


def _search(row_opts, col_opts, height, width, column_hints, solutions, found_sigs):
    """
    Backtracking search on top of propagation.

    Branches on the row with fewest remaining options (fail-first heuristic).
    Stops as soon as 2 solutions are found — we only ever need to distinguish
    "unique" from "not unique".
    """
    if len(solutions) > 1:
        return

    row_opts = [list(x) for x in row_opts]
    col_opts = [list(x) for x in col_opts]

    row_opts, col_opts = _propagate(row_opts, col_opts, height, width)
    if row_opts is None:
        return

    if all(len(opts) == 1 for opts in row_opts):
        grid = np.array([opts[0] for opts in row_opts])
        # Explicit column verification (propagation can leave column gaps)
        for c in range(width):
            if line_to_hints(grid[:, c]) != column_hints[c]:
                return
        sig = tuple(grid.flatten())
        if sig not in found_sigs:
            found_sigs.add(sig)
            solutions.append(grid)
        return

    # Branch on row with fewest options remaining
    best_row = min(
        (r for r in range(height) if len(row_opts[r]) > 1),
        key=lambda r: len(row_opts[r])
    )

    for option in row_opts[best_row]:
        new_row_opts = [list(x) for x in row_opts]
        new_row_opts[best_row] = [option]
        _search(new_row_opts, [list(x) for x in col_opts],
                height, width, column_hints, solutions, found_sigs)
        if len(solutions) > 1:
            return


def _run_solver(row_opts, col_opts, height, width, column_hints):
    """Thin wrapper: run search and return (is_unique, count, solutions)."""
    solutions = []
    found_sigs = set()
    _search(row_opts, col_opts, height, width, column_hints, solutions, found_sigs)
    return len(solutions) == 1, len(solutions), solutions


# ---------------------------------------------------------------------------
# Public solver (used externally if needed)
# ---------------------------------------------------------------------------

def check_unique_solution_fast_v2(row_hints, column_hints):
    height = len(row_hints)
    width = len(column_hints)
    row_opts = [possible_lines_fast(width, h) for h in row_hints]
    col_opts = [possible_lines_fast(height, h) for h in column_hints]
    return _run_solver(row_opts, col_opts, height, width, column_hints)


# ---------------------------------------------------------------------------
# Givens helpers
# ---------------------------------------------------------------------------

def get_givens(solutions, original_arr):
    """
    Returns (row, col, value) for every cell that differs between the two
    solutions.  The intended value is taken from the original image.
    """
    sol1, sol2 = solutions[0], solutions[1]
    differing = np.argwhere(sol1 != sol2)
    return [
        (int(r), int(c), int(original_arr[r, c]))
        for r, c in differing
    ]


# ---------------------------------------------------------------------------
# Incremental givens resolution
# ---------------------------------------------------------------------------

def _inject_given(row_opts, col_opts, r, c, v):
    """
    Return new option lists with cell (r, c) forced to value v.
    Makes shallow copies of all rows/cols except the two that change,
    so we never mutate the caller's state.
    """
    new_row_opts = [list(opts) for opts in row_opts]
    new_col_opts = [list(opts) for opts in col_opts]

    # Keep only lines where position c == v  (for row r)
    new_row_opts[r] = [line for line in new_row_opts[r] if line[c] == v]
    # Keep only lines where position r == v  (for col c)
    new_col_opts[c] = [line for line in new_col_opts[c] if line[r] == v]

    return new_row_opts, new_col_opts


def resolve_with_givens_incremental(row_hints, column_hints, original_arr,
                                    max_rounds=20):
    """
      - Options built with fast recursive generator (Approach 1).
      - Each givens round injects into the cached propagated state and
        re-propagates only the delta (Approach 2).

    Returns:
        givens   : list of (row, col, value) — empty if already unique
        solution : np.ndarray
        is_unique: bool
    """
    height = len(row_hints)
    width = len(column_hints)

    # --- Build options once with the fast generator (Approach 1) ---
    row_opts = [possible_lines_fast(width, h) for h in row_hints]
    col_opts = [possible_lines_fast(height, h) for h in column_hints]

    # --- Propagate once and cache the tightest starting state ---
    row_opts, col_opts = _propagate(row_opts, col_opts, height, width)
    if row_opts is None:
        print("ERROR: Contradiction during initial propagation.")
        return [], None, False

    # --- Initial search ---
    start = time.time()
    is_unique, count, solutions = _run_solver(
        row_opts, col_opts, height, width, column_hints
    )
    print(f"Initial solve: unique={is_unique}, solutions={count}, "
          f"time={round(time.time() - start, 4)}s")

    if is_unique:
        print("Puzzle is already unique. No givens needed.")
        return [], solutions[0], True

    accumulated_givens = []
    fixed_cells = set()

    for round_num in range(max_rounds):
        print(f"  Round {round_num + 1}: {count} solutions — adding a given...")

        candidates = get_givens(solutions, original_arr)
        candidates = [(r, c, v) for r, c, v in candidates if (r, c) not in fixed_cells]

        if not candidates:
            print("ERROR: No new candidates available.")
            break

        r, c, v = candidates[0]
        fixed_cells.add((r, c))
        accumulated_givens.append((r, c, v))
        print(f"    Given: cell ({r}, {c}) = {v}")

        # --- APPROACH 2: inject into existing pruned options ---
        row_opts, col_opts = _inject_given(row_opts, col_opts, r, c, v)

        # Re-propagate only the delta
        row_opts, col_opts = _propagate(row_opts, col_opts, height, width)
        if row_opts is None:
            print("ERROR: Over-constrained after injecting given.")
            break

        # Re-search on the updated (already tight) state
        start = time.time()
        is_unique, count, solutions = _run_solver(
            row_opts, col_opts, height, width, column_hints
        )
        print(f"    Re-solve: unique={is_unique}, solutions={count}, "
              f"time={round(time.time() - start, 4)}s")

        if is_unique:
            print(f"Resolved with {len(accumulated_givens)} given(s).")
            return accumulated_givens, solutions[0], True

        if count == 0:
            print("ERROR: No solutions remain — over-constrained.")
            break

    print(f"WARNING: Could not resolve after {max_rounds} rounds.")
    return accumulated_givens, solutions[0] if solutions else None, False


# ---------------------------------------------------------------------------
# Main Section
# ---------------------------------------------------------------------------

def generate_puzzle(picture, colour=(0, 0, 0), max_givens_rounds=20):
    """
    Full pipeline: PNG -> hints -> unique solution (with givens if needed).

    Returns a puzzle dict:
        row_hints    : list of hint lists
        column_hints : list of hint lists
        givens       : list of (row, col, value) — empty if already unique
        solution     : np.ndarray — the intended answer grid
        is_unique    : bool
    """
    print(f"\n--- Generating puzzle for '{picture}' ---")

    arr = png_to_array(picture, colour)
    row_hints = get_row_hints(arr)
    column_hints = get_column_hints(arr)

    print("Row hints:")
    print(row_hints)
    print("Column hints:")
    print(column_hints)

    givens, solution, is_unique = resolve_with_givens_incremental(
        row_hints, column_hints, arr, max_rounds=max_givens_rounds
    )

    return {
        "row_hints": row_hints,
        "column_hints": column_hints,
        "givens": givens,
        "solution": solution,
        "is_unique": is_unique,
    }


# ---------------------------------------------------------------------------
# Colour converter (unchanged)
# ---------------------------------------------------------------------------

def mono_to_colour_converter(picture):
    bw_png = "images/" + picture + ".puzzle.png"
    colour_png = "images/" + picture + ".picture.png"

    bw_img = Image.open(bw_png).convert("RGBA")
    colour_img = Image.open(colour_png).convert("RGBA")

    bw_pixels = np.array(bw_img)
    colour_pixels = np.array(colour_img)

    height, width, _ = bw_pixels.shape
    output = bw_pixels.copy()

    for y in range(height):
        for x in range(width):
            diagonal_value = x + (height - 1 - y)
            threshold = width + height
            if diagonal_value < threshold:
                output[y, x] = colour_pixels[y, x]

    return output


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    total_start = time.time()

    puzzle = generate_puzzle("repo")

    print("\n--- Puzzle Output ---")
    print("Row hints:   ", puzzle["row_hints"])
    print("Column hints:", puzzle["column_hints"])
    print("Givens:      ", puzzle["givens"])
    print("Is unique:   ", puzzle["is_unique"])
    print(f"Total time:   {round(time.time() - total_start, 4)}s")

    if puzzle["solution"] is not None:
        print("\nSolution grid:")
        print(puzzle["solution"])
        array_to_png(puzzle["solution"], "repo_solution")
        print("Solution saved to images/repo_solution.generated.png")