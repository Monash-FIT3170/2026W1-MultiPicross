import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  matchMaker,
} from "colyseus";

import { MyRoom } from "./rooms/MyRoom.js";
import { PicrossRoom } from "./rooms/PicrossRoom.js";

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom),
    picross_room: defineRoom(PicrossRoom),
  },

  express: (app) => {
    // Create a new Picross room server-side; returns roomId + inviteCode.
    // The client then joins via joinById so we avoid double-connection.
    app.post("/create-room", async (req, res) => {
      try {
        const width = parseInt(String(req.query.width ?? "10"), 10) || 10;
        const height = parseInt(String(req.query.height ?? "10"), 10) || 10;
        const isPublic = req.query.public === "true";
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
        console.error("create-room error", err);
        res.status(500).json({ error: "Failed to create room" });
      }
    });

    // Look up a room by its invite code.
    app.get("/room-by-code/:code", async (req, res) => {
      try {
        const { code } = req.params;
        const rooms = await matchMaker.query({ name: "picross_room" });
        const found = rooms.find(
          (r) => r.metadata?.inviteCode === code.toUpperCase(),
        );
        if (!found) {
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
