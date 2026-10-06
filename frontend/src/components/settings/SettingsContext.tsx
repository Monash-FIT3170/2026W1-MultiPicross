import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

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

  singleplayerLives: boolean;
  setSingleplayerLives: (enabled: boolean) => void;

  volume: number;
  setVolume: (volume: number) => void;

  cellFillSound: boolean;
  setCellFillSound: (enabled: boolean) => void;

  crossSound: boolean;
  setCrossSound: (enabled: boolean) => void;

  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;

  largerClueNumbers: boolean;
  setLargerClueNumbers: (enabled: boolean) => void;

  boldGridLines: boolean;
  setBoldGridLines: (enabled: boolean) => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

// The settings saved to the account (see api/src/settings/routes.ts). Also
// cached in localStorage so the theme applies before /settings answers, and so
// guests keep their choice between visits.
type AppearanceSettings = {
  theme: Theme;
  animationLevel: AnimationLevel;
  cellFillPop: boolean;
  showOpponentProgress: boolean;
};

const APPEARANCE_DEFAULTS: AppearanceSettings = {
  theme: "light",
  animationLevel: "full",
  cellFillPop: true,
  showOpponentProgress: true,
};

const APPEARANCE_STORAGE_KEY = "appearanceSettings";

function readCachedAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) return { ...APPEARANCE_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt; fall back to defaults.
  }
  return APPEARANCE_DEFAULTS;
}

function writeCachedAppearance(appearance: AppearanceSettings) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Storage blocked; the account copy still saves.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [appearance, setAppearance] =
    useState<AppearanceSettings>(readCachedAppearance);
  const { theme, animationLevel, cellFillPop, showOpponentProgress } =
    appearance;
  // Keys changed while the saved settings were loading, so the load doesn't
  // overwrite a choice the user just made.
  const changedWhileLoading = useRef(new Set<keyof AppearanceSettings>());
  const loading = useRef(false);
  const [profileAccent, setProfileAccent] = useState<ProfileAccent>("#3D5A80");
  const [primaryClick, setPrimaryClick] = useState<PrimaryClick>("fill");
  const [dragToFill, setDragToFill] = useState(true);
  const [autoCrossSolvedLines, setAutoCrossSolvedLines] = useState(true);
  const [confirmBeforeAbandoning, setConfirmBeforeAbandoning] = useState(true);
  const [singleplayerLives, setSingleplayerLives] = useState(true);
  const [volume, setVolume] = useState(60);
  const [cellFillSound, setCellFillSound] = useState(true);
  const [crossSound, setCrossSound] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [largerClueNumbers, setLargerClueNumbers] = useState(false);
  const [boldGridLines, setBoldGridLines] = useState(false);

  useEffect(() => {
    writeCachedAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    loading.current = true;
    changedWhileLoading.current.clear();

    apiFetch("/settings")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const saved = (await res.json()) as Partial<AppearanceSettings>;
        if (cancelled) return;
        for (const key of changedWhileLoading.current) delete saved[key];
        setAppearance((prev) => ({ ...prev, ...saved }));
      })
      .catch((err: unknown) => {
        console.warn("Failed to load saved settings:", err);
      })
      .finally(() => {
        if (!cancelled) loading.current = false;
      });

    return () => {
      cancelled = true;
      loading.current = false;
    };
  }, [status]);

  const updateAppearance = useCallback(
    <K extends keyof AppearanceSettings>(
      key: K,
      value: AppearanceSettings[K],
    ) => {
      setAppearance((prev) => ({ ...prev, [key]: value }));
      if (status !== "authenticated") return;
      if (loading.current) changedWhileLoading.current.add(key);

      apiFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      })
        .then((res) => {
          if (!res.ok) console.warn(`Failed to save ${key} (${res.status})`);
        })
        .catch((err: unknown) => {
          console.warn(`Failed to save ${key}:`, err);
        });
    },
    [status],
  );

  const setTheme = (value: Theme) => updateAppearance("theme", value);
  const setAnimationLevel = (value: AnimationLevel) =>
    updateAppearance("animationLevel", value);
  const setCellFillPop = (value: boolean) =>
    updateAppearance("cellFillPop", value);
  const setShowOpponentProgress = (value: boolean) =>
    updateAppearance("showOpponentProgress", value);

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
        singleplayerLives,
        setSingleplayerLives,
        volume,
        setVolume,
        cellFillSound,
        setCellFillSound,
        crossSound,
        setCrossSound,
        reducedMotion,
        setReducedMotion,
        largerClueNumbers,
        setLargerClueNumbers,
        boldGridLines,
        setBoldGridLines,
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
