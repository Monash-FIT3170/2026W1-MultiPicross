import useSound from "use-sound";
import cellClickSound from "../../assets/sounds/cell-click.wav";
import cellCrossSound from "../../assets/sounds/cell-cross.wav";
import { useSettings } from "./SettingsContext";

// The volume slider's 100% maps to this. The default slider position (60%)
// then plays at ~0.35, the level the sounds were originally tuned to.
const MAX_SFX_VOLUME = 0.6;

// Cell sound effects, following the Audio settings (volume and per-sound
// toggles).
export function useGameSounds() {
  const { volume, cellFillSound, crossSound } = useSettings();
  const level = (volume / 100) * MAX_SFX_VOLUME;

  const [playFill] = useSound(cellClickSound, {
    volume: level,
    soundEnabled: cellFillSound && volume > 0,
  });
  const [playCross] = useSound(cellCrossSound, {
    volume: level,
    soundEnabled: crossSound && volume > 0,
  });

  return { playFill, playCross };
}
