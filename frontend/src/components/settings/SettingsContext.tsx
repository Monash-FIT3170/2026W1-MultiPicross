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

// The settings saved to the account (see api/src/settings/routes.ts). Also
// cached in localStorage so they apply before /settings answers, and so guests
// keep their choices between visits.
export type Settings = {
  // Appearance
  theme: Theme;
  animationLevel: AnimationLevel;
  cellFillPop: boolean;
  showOpponentProgress: boolean;
  // Gameplay
  primaryClick: PrimaryClick;
  dragToFill: boolean;
  autoCrossSolvedLines: boolean;
  confirmBeforeAbandoning: boolean;
  singleplayerLives: boolean;
  // Audio
  volume: number;
  cellFillSound: boolean;
  crossSound: boolean;
  // Accessibility
  reducedMotion: boolean;
  largerClueNumbers: boolean;
  boldGridLines: boolean;
};

const SETTINGS_DEFAULTS: Settings = {
  theme: "light",
  animationLevel: "full",
  cellFillPop: true,
  showOpponentProgress: true,
  primaryClick: "fill",
  dragToFill: true,
  autoCrossSolvedLines: true,
  confirmBeforeAbandoning: true,
  singleplayerLives: true,
  volume: 60,
  cellFillSound: true,
  crossSound: true,
  reducedMotion: false,
  largerClueNumbers: false,
  boldGridLines: false,
};

// A setter for every setting: theme -> setTheme, volume -> setVolume, ...
type Setters = {
  [K in keyof Settings as `set${Capitalize<K>}`]: (value: Settings[K]) => void;
};

type SettingsContextType = Settings &
  Setters & {
    isOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;

    profileAccent: ProfileAccent;
    setProfileAccent: (accent: ProfileAccent) => void;
  };

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_STORAGE_KEY = "settings";

function readCachedSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt; fall back to defaults.
  }
  return SETTINGS_DEFAULTS;
}

function writeCachedSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked; the account copy still saves.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(readCachedSettings);
  // Keys changed while the saved settings were loading, so the load doesn't
  // overwrite a choice the user just made.
  const changedWhileLoading = useRef(new Set<keyof Settings>());
  const loading = useRef(false);
  const [profileAccent, setProfileAccent] = useState<ProfileAccent>(
    user?.profileAccent ?? "#3D5A80",
  );

  useEffect(() => {
    writeCachedSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    loading.current = true;
    changedWhileLoading.current.clear();

    apiFetch("/settings")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const saved = (await res.json()) as Partial<Settings>;
        if (cancelled) return;
        for (const key of changedWhileLoading.current) delete saved[key];
        setSettings((prev) => ({ ...prev, ...saved }));
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

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
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

  const setters: Setters = {
    setTheme: (value) => updateSetting("theme", value),
    setAnimationLevel: (value) => updateSetting("animationLevel", value),
    setCellFillPop: (value) => updateSetting("cellFillPop", value),
    setShowOpponentProgress: (value) =>
      updateSetting("showOpponentProgress", value),
    setPrimaryClick: (value) => updateSetting("primaryClick", value),
    setDragToFill: (value) => updateSetting("dragToFill", value),
    setAutoCrossSolvedLines: (value) =>
      updateSetting("autoCrossSolvedLines", value),
    setConfirmBeforeAbandoning: (value) =>
      updateSetting("confirmBeforeAbandoning", value),
    setSingleplayerLives: (value) => updateSetting("singleplayerLives", value),
    setVolume: (value) => updateSetting("volume", value),
    setCellFillSound: (value) => updateSetting("cellFillSound", value),
    setCrossSound: (value) => updateSetting("crossSound", value),
    setReducedMotion: (value) => updateSetting("reducedMotion", value),
    setLargerClueNumbers: (value) => updateSetting("largerClueNumbers", value),
    setBoldGridLines: (value) => updateSetting("boldGridLines", value),
  };

  const { theme, animationLevel, cellFillPop, reducedMotion } = settings;

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

    // Reduced motion reuses the "off" animation rules.
    document.documentElement.classList.toggle(
      "animations-off",
      animationLevel === "off" || reducedMotion,
    );
  }, [animationLevel, reducedMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "cell-fill-pop-off",
      !cellFillPop,
    );
  }, [cellFillPop]);


return (
  <SettingsContext.Provider
    value={{
      ...settings,
      ...setters,
      isOpen,
      openSettings: () => setIsOpen(true),
      closeSettings: () => setIsOpen(false),
      profileAccent,
      setProfileAccent,
    }}
  >
    {children}
  </SettingsContext.Provider>
);


export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return context;
}
