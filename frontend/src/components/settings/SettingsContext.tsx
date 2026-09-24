import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "high-contrast";

type SettingsContextType = {
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;

  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle(
      "high-contrast",
      theme === "high-contrast",
    );
  }, [theme]);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        openSettings: () => setIsOpen(true),
        closeSettings: () => setIsOpen(false),
        theme,
        setTheme,
        highContrast,
        setHighContrast
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
