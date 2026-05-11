import type { CellState } from "./Board";

type CellProps = {
  state: CellState;
  onClick: () => void;
  onRightClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export default function Cell({ state, onClick, onRightClick }: CellProps) {
  return (
    <button
      className={`
        w-[40px] h-[40px] flex items-center justify-center 
        text-xl font-bold transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-400
        ${state === "empty" ? "bg-black hover:bg-gray-900" : ""}
        ${state === "filled" ? "bg-white" : ""}
        ${state === "cross" ? "bg-black text-red-500" : ""}
      `}
      onClick={onClick}
      onContextMenu={onRightClick}
      aria-label={`Cell is ${state}`}
    >
      {state === "cross" ? "✕" : ""}
    </button>
  );
}
