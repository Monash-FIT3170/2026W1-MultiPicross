import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function PlayerNameRoute() {
  const { status, playerName } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking session…
      </div>
    );
  }

  if (!playerName) {
    return <Navigate to="/nickname" replace />;
  }

  return <Outlet />;
}