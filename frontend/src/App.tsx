import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { PublicMultiplayer } from "./pages/PublicMultiplayer";
import { PrivateMultiplayer } from "./pages/PrivateMultiplayer";
import { Room } from "./pages/Room";
import { Statistics } from "./pages/Statistics";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";
import { AuthLayout } from "./pages/AuthLayout";
import { ChooseHandle } from "./pages/ChooseHandle";
import { AuthError } from "./pages/AuthError";
import { GuestOnly } from "./auth/GuestOnly";
import { PicrossRanked } from "./pages/PicrossRanked";
import { GuestNickname } from "./pages/GuestNickname";
import { PlayerNameRoute } from "./auth/PlayerNameRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";

export default function App() {
  const { status, user } = useAuth();
  const location = useLocation();

  const needsHandle = status === "authenticated" && user?.handle === null;

  // /auth/error is exempt so a failed sign-in attempt (which can happen while
  // still authenticated from a previous session) never gets silently swapped
  // for a redirect to /welcome.
  const exemptFromHandleRedirect =
    location.pathname === "/welcome" || location.pathname === "/auth/error";

  if (needsHandle && !exemptFromHandleRedirect) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    // Adding a route here also needs RETURN_TO_PATHS in api/src/auth/claims.ts,
    // or signing in from that page silently drops the user on the main menu.
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/singleplayer" element={<Singleplayer />} />
      <Route path="/multiplayer">
        <Route element={<PlayerNameRoute />}>
          <Route path="public" element={<PublicMultiplayer />} />
          <Route path="private" element={<PrivateMultiplayer />} />
        </Route>
        <Route path="ranked" element={<PicrossRanked />} />
      </Route>
      <Route path="/room/:roomId" element={<Room />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/welcome" element={<ChooseHandle />} />
      <Route path="/auth/error" element={<AuthError />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/statistics" element={<Statistics />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/nickname" element={<GuestNickname />} />
        <Route path="/login" element={<AuthLayout />} />
      </Route>
      {/* Without this an unmatched path renders an empty document, with no way back. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
