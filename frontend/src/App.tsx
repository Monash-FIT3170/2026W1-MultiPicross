import { useState } from "react";
import MainMenu from "./pages/MainMenu";
import heroImg from "./assets/hero.png";
import "./App.css";
import Board from "./components/Board";

function App() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
        <div>
          <h1>MultiPicross</h1>
        </div>
      </section>

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
    </>
  );
  const [page, setPage] = useState("menu");

  function renderPage() {
    switch (page) {
      case "menu":
      default:
        return <MainMenu navigate={setPage} />;
    }
  }

  return <>{renderPage()}</>;
}

export default App;
