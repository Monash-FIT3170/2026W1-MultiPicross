import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  setLogoutHandler,
  signInRedirect,
  throwApiError,
} from "../api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthUser {
  id: string;
  handle: string | null;
  kind: "sso" | "service";
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  signIn: (returnTo?: string) => void;
  setHandle: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  });
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    apiFetch("/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as AuthUser;
          setState({ status: "authenticated", user: body });
        } else {
          setState({ status: "unauthenticated", user: null });
        }
      })
      .catch(() => {
        setState({ status: "unauthenticated", user: null });
      });
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      setState({ status: "unauthenticated", user: null });
    });
  }, []);

  async function login(username: string, password: string): Promise<void> {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      await throwApiError(res);
    }
    const body = (await res.json()) as AuthUser;
    setState({ status: "authenticated", user: body });
  }

  function signIn(returnTo?: string): void {
    signInRedirect(returnTo);
  }

  async function setHandle(handle: string): Promise<void> {
    const res = await apiFetch("/auth/handle", {
      method: "POST",
      body: JSON.stringify({ handle }),
    });
    if (!res.ok) {
      await throwApiError(res);
    }
    const body = (await res.json()) as { handle: string };
    setState((prev) =>
      prev.user
        ? { ...prev, user: { ...prev.user, handle: body.handle } }
        : prev,
    );
  }

  async function logout(): Promise<void> {
    await apiFetch("/auth/logout", { method: "POST" });
    setState({ status: "unauthenticated", user: null });
  }

  return (
    <AuthContext.Provider
      value={{ ...state, login, signIn, setHandle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
