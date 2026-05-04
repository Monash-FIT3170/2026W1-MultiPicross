import { useState } from "react";
import MainMenu from "./pages/MainMenu";

function App() {
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
