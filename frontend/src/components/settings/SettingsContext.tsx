import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type SettingsContextType = {
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        openSettings: () => setIsOpen(true),
        closeSettings: () => setIsOpen(false),
        theme,
        setTheme
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return context;
}
