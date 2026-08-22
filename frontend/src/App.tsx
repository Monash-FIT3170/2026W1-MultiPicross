import { Navigate, Route, Routes } from "react-router-dom";

import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { UnratedMultiplayer } from "./pages/UnratedMultiplayer";
import { Statistics } from "./pages/Statistics";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";
import { AuthLayout } from "./pages/AuthLayout";
import { GuestOnly } from "./auth/GuestOnly";
import { RankedMultiplayer } from "./pages/RankedMultiplayer";
import { GuestNickname } from "./pages/GuestNickname";
import { PlayerNameRoute } from "./auth/PlayerNameRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/singleplayer" element={<Singleplayer />} />
      <Route element={<PlayerNameRoute />}>
        <Route path="/multiplayer/unrated" element={<UnratedMultiplayer />} />
        <Route path="/multiplayer/ranked" element={<RankedMultiplayer />} />
      </Route>

      <Route path="/statistics" element={<Statistics />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="/settings" element={<Settings />} />

      <Route element={<GuestOnly />}>
        <Route path="/nickname" element={<GuestNickname />} />
        <Route path="/login" element={<AuthLayout />} />
        <Route path="/register" element={<AuthLayout />} />
        <Route path="/signup" element={<Navigate to="/register" replace />} />
      </Route>
    </Routes>
  );
}
