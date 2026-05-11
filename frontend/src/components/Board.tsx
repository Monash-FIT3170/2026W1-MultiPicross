import { useState } from "react";
import Cell from "./Cell";

export type CellState = "empty" | "filled" | "cross";

export default function Board() {
  const rows = 5;
  const cols = 5;
  const [grid, setGrid] = useState<CellState[][]>(
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => "empty" as CellState),
    ),
  );

  function handleLeftClick(row: number, col: number) {
    const newGrid = grid.map((r) => [...r]);
    if (newGrid[row][col] === "filled") {
      newGrid[row][col] = "empty";
    } else {
      newGrid[row][col] = "filled";
    }
    setGrid(newGrid);
  }

  function handleRightClick(event: React.MouseEvent, row: number, col: number) {
    event.preventDefault();
    const newGrid = grid.map((r) => [...r]);
    newGrid[row][col] = newGrid[row][col] === "cross" ? "empty" : "cross";
    setGrid(newGrid);
  }

  return (
    <section className="flex flex-col items-center py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Game Board</h2>
        <p className="text-gray-600">Click to fill, Right-click to cross.</p>
      </div>

      {/* Tailwind Grid Container */}
      <div
        className="grid gap-px bg-gray-400 border-2 border-gray-800 shadow-xl"
        style={{ gridTemplateColumns: `repeat(${cols}, 40px)` }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Cell
              key={`${rowIndex}-${colIndex}`}
              state={cell}
              onClick={() => handleLeftClick(rowIndex, colIndex)}
              onRightClick={(event) =>
                handleRightClick(event, rowIndex, colIndex)
              }
            />
          )),
        )}
      </div>
    </section>
  );
}
