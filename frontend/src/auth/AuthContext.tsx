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
  guestNickname: string | null;
}

interface AuthContextValue extends AuthState {
  playerName: string | null;
  login: (username: string, password: string) => Promise<void>;
  signIn: (returnTo?: string) => void;
  setHandle: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
  setGuestNickname: (nickname: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
    guestNickname: sessionStorage.getItem("guestNickname"),
  });

  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    apiFetch("/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as AuthUser;
          sessionStorage.removeItem("guestNickname");
          setState({
            status: "authenticated",
            user: body,
            guestNickname: null,
          });
        } else {
          setState((prev) => ({
            ...prev,
            status: "unauthenticated",
            user: null,
          }));
        }
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          status: "unauthenticated",
          user: null,
        }));
      });
  }, []);

  useEffect(() => {
    setLogoutHandler(() => {
      setState((prev) => ({ ...prev, status: "unauthenticated", user: null }));
    });
  }, []);

  function setGuestNickname(nickname: string) {
    sessionStorage.setItem("guestNickname", nickname);

    setState((prev) => ({
      ...prev,
      guestNickname: nickname,
    }));
  }

  const playerName =
    state.status === "authenticated"
      ? (state.user?.handle ?? null)
      : state.guestNickname;

  async function login(username: string, password: string): Promise<void> {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      await throwApiError(res);
    }
    const body = (await res.json()) as AuthUser;

    sessionStorage.removeItem("guestNickname");

    setState({ status: "authenticated", user: body, guestNickname: null });
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

    sessionStorage.removeItem("guestNickname");

    setState({ status: "unauthenticated", user: null, guestNickname: null });
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        playerName,
        login,
        signIn,
        setHandle,
        logout,
        setGuestNickname,
      }}
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
