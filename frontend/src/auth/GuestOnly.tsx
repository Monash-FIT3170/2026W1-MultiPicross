import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function GuestOnly() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking session…
      </div>
    );
  }
  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
