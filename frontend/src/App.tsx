import { Navigate, Route, Routes } from "react-router-dom";

import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { PublicMultiplayer } from "./pages/PublicMultiplayer";
import { PrivateMultiplayer } from "./pages/PrivateMultiplayer";
import { Statistics } from "./pages/Statistics";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";
import { AuthLayout } from "./pages/AuthLayout";
import { GuestOnly } from "./auth/GuestOnly";
import { PicrossRanked } from "./pages/PicrossRanked";
import { GuestNickname } from "./pages/GuestNickname";
import { PlayerNameRoute } from "./auth/PlayerNameRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/singleplayer" element={<Singleplayer />} />

      <Route element={<PlayerNameRoute />}>
        <Route path="/publicmultiplayer" element={<PublicMultiplayer />} />
        <Route path="/privatemultiplayer" element={<PrivateMultiplayer />} />
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
      <Route path="/picrossranked" element={<PicrossRanked />} />
    </Routes>
  );
}
