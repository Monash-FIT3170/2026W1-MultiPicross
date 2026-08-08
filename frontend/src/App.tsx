import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import MainMenu from "./pages/MainMenu";
import { Singleplayer } from "./pages/Singleplayer";
import { Multiplayer } from "./pages/Multiplayer";
import { Statistics } from "./pages/Statistics";
import { Tutorial } from "./pages/Tutorial";
import { Settings } from "./pages/Settings";
import { AuthLayout } from "./pages/AuthLayout";
import { ChooseHandle } from "./pages/ChooseHandle";
import { AuthError } from "./pages/AuthError";
import { GuestOnly } from "./auth/GuestOnly";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";

export default function App() {
  const { status, user } = useAuth();
  const location = useLocation();

  const needsHandle =
    status === "authenticated" && user?.kind === "sso" && user.handle === null;

  // /auth/error is exempt so a failed sign-in attempt (which can happen while
  // still authenticated from a previous session) never gets silently swapped
  // for a redirect to /welcome.
  const exemptFromHandleRedirect =
    location.pathname === "/welcome" || location.pathname === "/auth/error";

  if (needsHandle && !exemptFromHandleRedirect) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/singleplayer" element={<Singleplayer />} />
      <Route path="/multiplayer" element={<Multiplayer />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/welcome" element={<ChooseHandle />} />
      <Route path="/auth/error" element={<AuthError />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/statistics" element={<Statistics />} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<AuthLayout />} />
      </Route>
    </Routes>
  );
}
