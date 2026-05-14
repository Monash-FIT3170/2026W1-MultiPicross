import { useState, useEffect } from "react";
import Cell from "./Cell";
import cellClickSound from "../assets/sounds/cell-click.mp3";
import cellCrossSound from "../assets/sounds/cell-cross.mp3";

export type CellState = "empty" | "filled" | "cross";

export default function Board() {
  const [time, setTime] = useState(0);
  const rows = 5;
  const cols = 5;

  const [playCellClick] = useSound(cellClickSound, { volume: 0.35 });
  const [playCellCross] = useSound(cellCrossSound, { volume: 0.35 });

  const [grid, setGrid] = useState<CellState[][]>(
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => "empty" as CellState),
    ),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function handleLeftClick(row: number, col: number) {
    const newGrid = grid.map((r) => [...r]);

    if (newGrid[row][col] === "filled") {
      newGrid[row][col] = "empty";
    } else {
      newGrid[row][col] = "filled";
    }

    playCellClick();
    setGrid(newGrid);
  }

  function handleRightClick(event: React.MouseEvent, row: number, col: number) {
    event.preventDefault();

    const newGrid = grid.map((r) => [...r]);
    newGrid[row][col] = newGrid[row][col] === "cross" ? "empty" : "cross";

    playCellCross();
    setGrid(newGrid);
  }

  return (
    <section className="flex flex-col items-center py-8">
      <div className="text-center mb-6">
        <h2>Game Board</h2>
        <p>Click to fill, Right-click to cross.</p>
        <div className="timer">
          {String(Math.floor(time / 60)).padStart(2, "0")}:
          {String(time % 60).padStart(2, "0")}
        </div>
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
