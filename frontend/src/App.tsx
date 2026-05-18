import { Routes, Route } from "react-router-dom";

import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { Multiplayer } from "./pages/Multiplayer";
import { Statistics } from "./pages/Statistics";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <div>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/singleplayer" element={<Singleplayer />} />
          <Route path="/multiplayer" element={<Multiplayer />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
    </div>

  );
}