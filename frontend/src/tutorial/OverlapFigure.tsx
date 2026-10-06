/**
 * The overlap move, drawn out: the run pushed as far one way as it goes, as far
 * the other way as it goes, and the squares that end up filled in both. Reading
 * the argument off three little columns is much faster than reading it in prose.
 */
export function OverlapFigure({
  height,
  run,
}: {
  height: number;
  run: number;
}) {
  const cs = height > 6 ? 13 : 20;
  const lowStart = height - run;
  const panels: { label: string; on: (i: number) => boolean; tone: string }[] =
    [
      {
        label: "pushed up",
        on: (i) => i < run,
        tone: "var(--color-blue-200)",
      },
      {
        label: "pushed down",
        on: (i) => i >= lowStart,
        tone: "var(--color-blue-200)",
      },
      {
        label: "certain either way",
        on: (i) => i >= lowStart && i < run,
        tone: "var(--color-blue-500)",
      },
    ];

  return (
    <div className="mp-tut-figure">
      {panels.map((panel) => (
        <div key={panel.label} className="mp-tut-figure-panel">
          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${height}, ${cs}px)`,
              border: "1px solid var(--color-line-strong)",
              width: cs,
            }}
          >
            {Array.from({ length: height }, (_, i) => (
              <div
                key={i}
                style={{
                  background: panel.on(i) ? panel.tone : "var(--tut-cell)",
                  borderTop:
                    i === 0 ? undefined : "1px solid var(--color-line)",
                }}
              />
            ))}
          </div>
          <span className="mp-tut-figure-label">{panel.label}</span>
        </div>
      ))}
    </div>
  );
}
