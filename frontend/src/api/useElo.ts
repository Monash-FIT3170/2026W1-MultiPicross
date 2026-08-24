import { useEffect, useState } from "react";
import { apiFetch } from "./client";

export function useElo(enabled: boolean) {
  const [playerElo, setPlayerElo] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPlayerElo(null);
      return;
    }

    let cancelled = false;

    apiFetch("/auth/elo")
      .then(async (res) => {
        if (!res.ok) return;

        const body = (await res.json()) as { elo: number };

        if (!cancelled) {
          setPlayerElo(body.elo);
        }
      })
      .catch(() => {
        if (!cancelled) setPlayerElo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { playerElo };
}