import { useEffect, useState } from "react";
import { apiFetch } from "./client";

export type SolveMode = "singleplayer" | "multiplayer";

export interface CollectionPuzzle {
  id: string;
  name: string | null;
  width: number;
  height: number;
  solution: number[];
  colors: string[];
  timesSolved: number;
  fastestSeconds: number;
  averageSeconds: number;
  totalSeconds: number;
  firstCompletedAt: string;
  lastCompletedAt: string;
  bestLivesLeft: number;
  modes: SolveMode[];
}

export type CollectionState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; puzzles: CollectionPuzzle[] };

export function useCollection(): CollectionState {
  const [state, setState] = useState<CollectionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiFetch("/collection")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { puzzles: CollectionPuzzle[] };
        if (!cancelled) setState({ status: "ready", puzzles: body.puzzles });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
