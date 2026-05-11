import Board from "../components/Board";
import "./PagePlaceholder.css";

type SingleplayerProps = {
  navigate: React.Dispatch<React.SetStateAction<string>>;
};

export function Singleplayer({ navigate }: SingleplayerProps) {
  return (
    <div className="page-placeholder">
      <h1>Singleplayer</h1>
      <p>Puzzle selection will go here.</p>
      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("mainmenu")}
      >
        Main Menu
      </button>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <h2>Board desc</h2>
          <p>Left click to fill/unfill. Right click to place/remove a cross.</p>
        </div>
        <div id="social">
          <Board />
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </div>
  );
}
