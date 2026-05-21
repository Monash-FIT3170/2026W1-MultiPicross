import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, parseApiError, setLogoutHandler } from "../api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    username: null,
  });
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    apiFetch("/auth/refresh", { method: "POST" })
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as { username: string };
          setState({ status: "authenticated", username: body.username });
        } else {
          setState({ status: "unauthenticated", username: null });
        }
      })
      .catch(() => {
        setState({ status: "unauthenticated", username: null });
      });
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      setState({ status: "unauthenticated", username: null });
    });
  }, []);

  async function login(username: string, password: string): Promise<void> {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }
    const body = (await res.json()) as { username: string };
    setState({ status: "authenticated", username: body.username });
  }

  async function register(username: string, password: string): Promise<void> {
    const regRes = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!regRes.ok) {
      throw new Error(await parseApiError(regRes));
    }
    await login(username, password);
  }

  async function logout(): Promise<void> {
    await apiFetch("/auth/logout", { method: "POST" });
    setState({ status: "unauthenticated", username: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
