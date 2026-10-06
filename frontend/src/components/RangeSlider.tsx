import { useState } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  labels: [string, string];
  valueText: (v: number) => string;
}

export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  labels,
  valueText,
}: RangeSliderProps) {
  const [lo, hi] = value;
  // Overlapping inputs: the last-touched thumb must sit on top to stay grabbable.
  const [top, setTop] = useState<0 | 1>(1);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const thumb = (i: 0 | 1) => ({
    type: "range" as const,
    min,
    max,
    step,
    value: value[i],
    "aria-label": labels[i],
    "aria-valuetext": valueText(value[i]),
    style: { zIndex: top === i ? 2 : 1 },
    onPointerDown: () => setTop(i),
    onFocus: () => setTop(i),
  });

  return (
    <div className="range-slider">
      <div className="range-slider-track" />
      <div
        className="range-slider-fill"
        style={{
          left: `calc(8px + ${pct(lo)} * (100% - 16px) / 100)`,
          right: `calc(8px + ${100 - pct(hi)} * (100% - 16px) / 100)`,
        }}
      />
      <input
        {...thumb(0)}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
      />
      <input
        {...thumb(1)}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
      />
    </div>
  );
}
