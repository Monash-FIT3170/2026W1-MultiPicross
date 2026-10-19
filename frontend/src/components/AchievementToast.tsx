import { useEffect, useState } from "react";
import { Icon } from "./ui";
import { useAchievementDefinitions } from "../api/achievements";

const DISMISS_MS = 4500;

interface QueuedUnlock {
  id: number;
  key: string;
}

let nextId = 0;

/**
 * Top-of-screen toast for achievements unlocked mid-game. Consumers call
 * `push(keys)` with the `unlockedAchievements` array from an action response.
 * One card shows at a time; several unlocks get a counter and arrows, and the
 * card auto-advances every few seconds until the queue is exhausted.
 */
export function useAchievementToastQueue() {
  const [queue, setQueue] = useState<QueuedUnlock[]>([]);

  function push(keys: string[] | undefined) {
    if (!keys || keys.length === 0) return;
    setQueue((cur) => [...cur, ...keys.map((key) => ({ id: nextId++, key }))]);
  }

  function dismiss(id: number) {
    setQueue((cur) => cur.filter((u) => u.id !== id));
  }

  return { queue, push, dismiss };
}

export function AchievementToastStack({
  queue,
  onDismiss,
}: {
  queue: QueuedUnlock[];
  onDismiss: (id: number) => void;
}) {
  const { definitions } = useAchievementDefinitions();
  const [index, setIndex] = useState(0);
  const position = Math.min(index, queue.length - 1);
  const current = queue[position];

  function closeAll() {
    queue.forEach((u) => onDismiss(u.id));
    setIndex(0);
  }

  // Auto-advance to the next card, or close once the last one times out.
  // Restarts whenever the visible card changes or more unlocks arrive.
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => {
      if (position < queue.length - 1) setIndex(position + 1);
      else closeAll();
    }, DISMISS_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeAll reads the same queue this effect is keyed on
  }, [current?.id, queue.length]);

  if (!current) return null;
  const def = definitions?.find((d) => d.key === current.key);
  const multiple = queue.length > 1;

  return (
    <div className="mp-achievement-toast-stack">
      <div key={current.id} className="mp-achievement-toast">
        <div className="mp-achievement-toast-icon">
          <Icon name="trophy" size={16} color="#fff" />
        </div>
        <div className="mp-achievement-toast-body">
          <div className="mp-achievement-toast-title">
            Achievement unlocked
            {multiple && (
              <span className="mp-achievement-toast-count">
                {position + 1} / {queue.length}
              </span>
            )}
          </div>
          <div className="mp-achievement-toast-name">
            {def?.name ?? "New achievement"}
          </div>
          {def?.description && (
            <div className="mp-achievement-toast-desc">{def.description}</div>
          )}
        </div>
        <div className="mp-achievement-toast-controls">
          {multiple && (
            <>
              <button
                type="button"
                className="mp-achievement-toast-btn"
                aria-label="Previous achievement"
                disabled={position === 0}
                onClick={() => setIndex(position - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="mp-achievement-toast-btn"
                aria-label="Next achievement"
                disabled={position === queue.length - 1}
                onClick={() => setIndex(position + 1)}
              >
                ›
              </button>
            </>
          )}
          <button
            type="button"
            className="mp-achievement-toast-btn"
            aria-label="Dismiss achievements"
            onClick={closeAll}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
