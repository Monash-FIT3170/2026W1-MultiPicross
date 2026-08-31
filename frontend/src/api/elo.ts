import { useEffect, useState } from "react";
import { apiFetch } from "./client";

/*
elo gets the player's current Elo. It fetches this through the API and returns 
the result if the request is not cancelled. 
*/
export function useElo(enabled: boolean) {
  const [fetchedElo, setFetchedElo] = useState<number | null>(null);

  // Derived rather than stored: resetting it inside the effect would be a
  // synchronous setState, which react-hooks/set-state-in-effect rejects.
  const playerElo = enabled ? fetchedElo : null;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    apiFetch("/auth/elo")
      .then(async (res) => {
        if (!res.ok) return;

        const body = (await res.json()) as { elo: number };

        if (!cancelled) {
          setFetchedElo(body.elo);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedElo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { playerElo };
}
