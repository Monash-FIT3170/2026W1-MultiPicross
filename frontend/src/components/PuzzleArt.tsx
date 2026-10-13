import { memo } from "react";
import { useSettings } from "./settings/SettingsContext";

export type ArtView = "grid" | "picture";

interface PuzzleArtProps {
  solution: number[];
  colors: string[];
  width: number;
  height: number;
  cellSize: number;
  view: ArtView;
}

export const PuzzleArt = memo(function PuzzleArt({
  solution,
  colors,
  width,
  height,
  cellSize,
  view,
}: PuzzleArtProps) {
  const { theme } = useSettings();
  const darkMode = theme === "dark";
  const picture = view === "picture";
  const size = picture ? cellSize + 1 : cellSize;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${width}, ${size}px)`,
        gridTemplateRows: `repeat(${height}, ${size}px)`,
        gap: picture ? 0 : 1,
        borderRadius: picture ? 4 : 0,
        overflow: "hidden",
      }}
    >
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            borderRadius: picture ? 0 : cellSize > 12 ? 2 : 1,
            background: picture
              ? color
              : solution[i] === 1
                ? darkMode
                  ? "#ffffff"
                  : "#000000"
                : darkMode
                  ? "var(--color-paper)"
                  : "#ffffff",
          }}
        />
      ))}
    </div>
  );
});
