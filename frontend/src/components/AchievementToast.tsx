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
 * Stacked top-of-screen toasts for achievements unlocked mid-game. Consumers
 * call `push(keys)` with the `unlockedAchievements` array from an action
 * response; each toast dismisses itself after a few seconds.
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
  if (queue.length === 0) return null;

  return (
    <div className="mp-achievement-toast-stack">
      {queue.map((u) => {
        const def = definitions?.find((d) => d.key === u.key);
        return (
          <AchievementToastItem
            key={u.id}
            name={def?.name ?? "Achievement unlocked"}
            description={def?.description}
            onDismiss={() => onDismiss(u.id)}
          />
        );
      })}
    </div>
  );
}

function AchievementToastItem({
  name,
  description,
  onDismiss,
}: {
  name: string;
  description?: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDismiss is stable per toast instance (keyed by id)
  }, []);

  return (
    <div className="mp-achievement-toast">
      <div className="mp-achievement-toast-icon">
        <Icon name="trophy" size={16} color="#fff" />
      </div>
      <div>
        <div className="mp-achievement-toast-title">Achievement unlocked</div>
        <div className="mp-achievement-toast-name">{name}</div>
        {description && (
          <div className="mp-achievement-toast-desc">{description}</div>
        )}
      </div>
    </div>
  );
}
