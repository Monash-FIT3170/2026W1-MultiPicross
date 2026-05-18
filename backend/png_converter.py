from PIL import Image
import numpy as np
import itertools
import time

def png_to_array(picture, colour):
    """
    Takes an nxn PNG file and a colour value, then returns a 2D array
    where 1 means the pixel matches the colour and 0 means it does not.

    png: path to PNG file
    colour: tuple, e.g. (0, 0, 0) or (255, 0, 0, 255)
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

    img[arr == 1] = [0, 0, 0, 255]       # black
    img[arr == 0] = [255, 255, 255, 255] # white

    image = Image.fromarray(img)
    image.save(f"images/{picture_name}.generated.png")


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

    if hints == []:
        return [0]

    return hints

def get_row_hints(arr):
    row_hints = []

    for row in arr:
        row_hints.append(line_to_hints(row))

    return row_hints

def get_column_hints(arr):
    column_hints = []

    for col_index in range(arr.shape[1]):
        column = arr[:, col_index]
        column_hints.append(line_to_hints(column))

    return column_hints

def possible_lines(length, hints):
    if hints == [0]:
        return [tuple([0] * length)]

    lines = []

    for line in itertools.product([0, 1], repeat=length):
        if line_to_hints(line) == hints:
            lines.append(line)

    return lines

def check_unique_solution(row_hints, column_hints):
    height = len(row_hints)
    width = len(column_hints)

    row_options = []

    for hint in row_hints:
        row_options.append(possible_lines(width, hint))

    solution_count = 0
    solution = None

    for rows in itertools.product(*row_options):
        grid = np.array(rows)

        valid = True

        for col_index in range(width):
            column = grid[:, col_index]
            if line_to_hints(column) != column_hints[col_index]:
                valid = False
                break

        if valid:
            solution_count += 1
            solution = grid

            if solution_count > 1:
                return False, solution_count, None

    return solution_count == 1, solution_count, solution


def hints_can_still_match(partial_column, final_hint):
    """
    Checks whether a partial column could still become final_hint.
    """
    partial_hint = line_to_hints(partial_column)

    # If column is empty so far
    if partial_hint == [0]:
        return True

    # Too many groups already
    if len(partial_hint) > len(final_hint):
        return False

    # Completed groups must match
    for i in range(len(partial_hint) - 1):
        if partial_hint[i] != final_hint[i]:
            return False

    # Current group cannot be bigger than target group
    last_index = len(partial_hint) - 1
    if partial_hint[last_index] > final_hint[last_index]:
        return False

    return True

def check_unique_solution_fast(row_hints, column_hints):
    height = len(row_hints)
    width = len(column_hints)

    row_options = [possible_lines(width, hint) for hint in row_hints]
    col_options = [possible_lines(height, hint) for hint in column_hints]

    solutions = []

    def propagate(row_opts, col_opts):
        changed = True
        while changed:
            changed = False

            # Precompute which values each column allows at each row position.
            # col_allowed[c][r] is a set — O(1) lookup instead of scanning all col options per cell.
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

            # Precompute which values each row allows at each column position.
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

    def search(row_opts, col_opts):
        if len(solutions) > 1:
            return

        row_opts = [list(x) for x in row_opts]
        col_opts = [list(x) for x in col_opts]

        row_opts, col_opts = propagate(row_opts, col_opts)

        if row_opts is None:
            return

        if all(len(opts) == 1 for opts in row_opts):
            grid = np.array([opts[0] for opts in row_opts])
            # Explicit column verification: propagation can have gaps where all
            # row options are individually consistent but jointly produce a bad column.
            for c in range(width):
                if line_to_hints(grid[:, c]) != list(column_hints[c]):
                    return
            solutions.append(grid)
            return

        best_row = min(
            (r for r in range(height) if len(row_opts[r]) > 1),
            key=lambda r: len(row_opts[r])
        )

        for option in row_opts[best_row]:
            new_row_opts = [list(x) for x in row_opts]
            new_row_opts[best_row] = [option]
            # Pass an explicit col_opts copy so each branch is fully isolated.
            search(new_row_opts, [list(x) for x in col_opts])
            if len(solutions) > 1:
                return

    search(row_options, col_options)

    return len(solutions) == 1, len(solutions), solutions


def check_unique_solution_fast_v2(row_hints, column_hints):
    height = len(row_hints)
    width = len(column_hints)

    row_options = [possible_lines(width, hint) for hint in row_hints]
    col_options = [possible_lines(height, hint) for hint in column_hints]

    # Stores flattened tuples of each found grid so identical grids found via
    # different search paths are counted only once.
    found_signatures = set()
    solutions = []

    def propagate(row_opts, col_opts):
        changed = True
        while changed:
            changed = False

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

    def search(row_opts, col_opts):
        if len(solutions) > 1:
            return

        row_opts = [list(x) for x in row_opts]
        col_opts = [list(x) for x in col_opts]

        row_opts, col_opts = propagate(row_opts, col_opts)

        if row_opts is None:
            return

        if all(len(opts) == 1 for opts in row_opts):
            grid = np.array([opts[0] for opts in row_opts])

            for c in range(width):
                if line_to_hints(grid[:, c]) != column_hints[c]:
                    return

            sig = tuple(grid.flatten())
            if sig not in found_signatures:
                found_signatures.add(sig)
                solutions.append(grid)
            return

        best_row = min(
            (r for r in range(height) if len(row_opts[r]) > 1),
            key=lambda r: len(row_opts[r])
        )

        for option in row_opts[best_row]:
            new_row_opts = [list(x) for x in row_opts]
            new_row_opts[best_row] = [option]
            search(new_row_opts, [list(x) for x in col_opts])
            if len(solutions) > 1:
                return

    search(row_options, col_options)

    return len(solutions) == 1, len(solutions), solutions


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
            # bottom-left has small value, top-right has large value
            diagonal_value = x + (height - 1 - y)

            # controls how much of the image is coloured
            threshold = width + height

            if diagonal_value < threshold:
                output[y, x] = colour_pixels[y, x]

    return output

    

if __name__ == "__main__":
    arr = png_to_array("kirby", (0, 0, 0))

    array_to_png(arr, f"repo_test_regenerate_v4")

    row_hints = get_row_hints(arr)
    column_hints = get_column_hints(arr)

    print("Row hints:")
    print(row_hints)

    print("Column hints:")
    print(column_hints)

    start = time.time()

    is_unique, count, solution = check_unique_solution_fast_v2(row_hints, column_hints)

    print("Unique:", is_unique)
    print("Number of solutions:", count)
    print("Time:", round(time.time() - start, 4), "seconds")

    for i, sol in enumerate(solution):
        print(f"\nSolution {i+1}:")
        print(sol)
        array_to_png(sol, f"repo_sol_{i+1}")


    # arr = mono_to_colour_converter("kirby")

    # img = Image.fromarray(arr.astype(np.uint8))
    # img.save("../images/kirby.converted.png")


# TODO: take nxn PNG file and convert it into an array of tuples
