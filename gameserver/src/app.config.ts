import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  matchMaker,
  ServerError,
} from "colyseus";

import { MyRoom } from "./rooms/MyRoom.js";
import {
  PicrossRoom,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  ERR_NO_PUZZLE_FOR_SIZE,
} from "./rooms/PicrossRoom.js";

// A range check rather than a fixed list keeps the two sides decoupled. The
// upper bound matters: every player allocates several width*height arrays,
// so an unbounded ?width=99999 is a cheap memory-exhaustion vector.
const MIN_BOARD_SIZE = 1;
const MAX_BOARD_SIZE = 50;
const DEFAULT_BOARD_SIZE = 10;

// Built from generateCode()'s own alphabet so the two cannot drift.
const INVITE_CODE_PATTERN = new RegExp(
  `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`,
);

// Parses a width/height query param. Returns the default when absent, or
// null when present but not a whole number in range — a 400 to the caller.
function parseBoardDimension(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_BOARD_SIZE;
  }
  const text = String(raw).trim();
  // Digits only: rejects "abc", "-5", "1.5", "1e3", "10px".
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isInteger(value)) return null;
  if (value < MIN_BOARD_SIZE || value > MAX_BOARD_SIZE) return null;
  return value;
}

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom),
    picross_room: defineRoom(PicrossRoom),
  },

  express: (app) => {
    // Container healthcheck target (see compose.gcp.yaml). Registered before the
    // dev-only playground() mount so nothing shadows it. Deliberately does no DB
    // work: a Postgres blip must not restart a server still holding rooms.
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Create a new Picross room server-side; returns roomId + inviteCode.
    // The client then joins via joinById so we avoid double-connection.
    app.post("/create-room", async (req, res) => {
      const width = parseBoardDimension(req.query.width);
      const height = parseBoardDimension(req.query.height);
      if (width === null || height === null) {
        res.status(400).json({
          error: `width and height must be whole numbers between ${MIN_BOARD_SIZE} and ${MAX_BOARD_SIZE}`,
        });
        return;
      }
      const isPublic = req.query.public === "true";

      try {
        const room = await matchMaker.createRoom("picross_room", {
          width,
          height,
          isPublic,
        });
        res.json({
          roomId: room.roomId,
          inviteCode: room.metadata?.inviteCode,
        });
      } catch (err) {
        // onCreate throws a distinguishable code when the bank holds nothing this
        // size, so an empty bank reads as a 404 while 500 still means broken.
        if (err instanceof ServerError && err.code === ERR_NO_PUZZLE_FOR_SIZE) {
          res
            .status(404)
            .json({ error: `No puzzle available at ${width}x${height}` });
          return;
        }
        console.error("create-room error", err);
        res.status(500).json({ error: "Failed to create room" });
      }
    });

    // Unauthenticated because guest play is supported; brute force is held off
    // by the Traefik rate limit on this path.
    app.get("/room-by-code/:code", async (req, res) => {
      try {
        const code = String(req.params.code ?? "")
          .trim()
          .toUpperCase();
        if (!INVITE_CODE_PATTERN.test(code)) {
          res.status(404).json({ error: "Room not found" });
          return;
        }

        // Filter in the driver rather than scanning every room in JS. locked: false
        // also drops finished and full rooms, which would otherwise hand back a
        // roomId that joinById then rejects.
        const rooms = await matchMaker.query({
          name: "picross_room",
          locked: false,
          inviteCode: code,
        });
        const found = rooms.find((r) => r.clients < r.maxClients);
        if (!found) {
          // Same 404 either way, so the endpoint never confirms a code to a guesser.
          res.status(404).json({ error: "Room not found" });
          return;
        }
        res.json({ roomId: found.roomId });
      } catch (err) {
        console.error("room-by-code error", err);
        res.status(500).json({ error: "Internal error" });
      }
    });

    // List public, joinable rooms for the lobby browser.
    app.get("/public-rooms", async (_req, res) => {
      try {
        const rooms = await matchMaker.query({
          name: "picross_room",
          private: false,
          locked: false,
        });
        res.json(
          rooms.map((r) => ({
            roomId: r.roomId,
            width: r.metadata?.width,
            height: r.metadata?.height,
            clients: r.clients,
            maxClients: r.maxClients,
          })),
        );
      } catch (err) {
        console.error("public-rooms error", err);
        res.status(500).json({ error: "Internal error" });
      }
    });

    // monitor has no auth of its own, keep both dev-only
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/", playground());
    }
  },
});

export default server;
