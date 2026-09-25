import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "high-contrast";
type AnimationLevel = "full" | "subtle" | "off";
type ProfileAccent = string;
type PrimaryClick = "fill" | "cross";

type SettingsContextType = {
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;

  animationLevel: AnimationLevel;
  setAnimationLevel: (level: AnimationLevel) => void;

  cellFillPop: boolean;
  setCellFillPop: (enabled: boolean) => void;

  showOpponentProgress: boolean;
  setShowOpponentProgress: (enabled: boolean) => void;

  profileAccent: ProfileAccent;
  setProfileAccent: (accent: ProfileAccent) => void;

  primaryClick: PrimaryClick;
  setPrimaryClick: (action: PrimaryClick) => void;

  dragToFill: boolean;
  setDragToFill: (enabled: boolean) => void;

  autoCrossSolvedLines: boolean;
  setAutoCrossSolvedLines: (enabled: boolean) => void;

  confirmBeforeAbandoning: boolean;
  setConfirmBeforeAbandoning: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [animationLevel, setAnimationLevel] = useState<AnimationLevel>("full");
  const [cellFillPop, setCellFillPop] = useState(true);
  const [showOpponentProgress, setShowOpponentProgress] = useState(true);
  const [profileAccent, setProfileAccent] = useState<ProfileAccent>("#3D5A80");
  const [primaryClick, setPrimaryClick] = useState<PrimaryClick>("fill");
  const [dragToFill, setDragToFill] = useState(true);
  const [autoCrossSolvedLines, setAutoCrossSolvedLines] = useState(true);
  const [confirmBeforeAbandoning, setConfirmBeforeAbandoning] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle(
      "high-contrast",
      theme === "high-contrast",
    );
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "animations-subtle",
      animationLevel === "subtle",
    );

    document.documentElement.classList.toggle(
      "animations-off",
      animationLevel === "off",
    );
  }, [animationLevel]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "cell-fill-pop-off",
      !cellFillPop,
    );
  }, [cellFillPop]);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        openSettings: () => setIsOpen(true),
        closeSettings: () => setIsOpen(false),
        theme,
        setTheme,
        animationLevel,
        setAnimationLevel,
        cellFillPop,
        setCellFillPop,
        showOpponentProgress,
        setShowOpponentProgress,
        profileAccent,
        setProfileAccent,
        primaryClick,
        setPrimaryClick,
        dragToFill,
        setDragToFill,
        autoCrossSolvedLines,
        setAutoCrossSolvedLines,
        confirmBeforeAbandoning,
        setConfirmBeforeAbandoning,
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
