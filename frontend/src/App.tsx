import { useState } from "react";
import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { Multiplayer } from "./pages/Multiplayer";
import { Statistics } from "./pages/Statistics";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";

function App() {
  const [page, setPage] = useState("menu");

  function renderPage() {
    switch (page) {
      case "menu":
      default:
        return <MainMenu navigate={setPage} />;
      case "singleplayer":
        return <Singleplayer navigate={setPage} />;
      case "multiplayer":
        return <Multiplayer navigate={setPage} />;
      case "statistics":
        return <Statistics navigate={setPage} />;
      case "login":
        return <Login navigate={setPage} />;
      case "signup":
        return <Signup navigate={setPage} />;
      case "tutorial":
        return <Tutorial navigate={setPage} />;
      case "settings":
        return <Settings navigate={setPage} />;
    }
  }

  return <>{renderPage()}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create-account" element={<AccountCreationPage />} />
      <Route path="/account-creation" element={<AccountCreationPage />} />
    </Routes>
  );
}

export default App;
