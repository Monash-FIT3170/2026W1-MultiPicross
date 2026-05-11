import { useState } from "react";
import MainMenu from "./pages/MainMenu";
import heroImg from "./assets/hero.png";
import Board from "./components/Board";
import { Singleplayer } from "./pages/Singleplayer";


function App() {
  const [page, setPage] = useState("menu");
  
  function renderPage() {
    switch (page) {
      case "menu":
      default:
        return <MainMenu navigate={setPage} />;
      case "singleplayer":
        return <Singleplayer navigate={setPage} />;
      }
    }

    return <>{renderPage()}</>;
}

export default App;
