import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function PlayerNameRoute() {
  const { status, playerName } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking session…
      </div>
    );
  }

  if (!playerName) {
    return <Navigate to="/nickname" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
