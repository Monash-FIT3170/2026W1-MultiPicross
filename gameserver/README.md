# MultiPicross Game Server

The Colyseus server that runs real-time multiplayer games, served at `/gs`.

- `src/rooms/`: game rooms (`PicrossRoom`), rated matchmaking, and room state schemas
- `src/elo/`: Elo rating calculation
- `src/results/`: persistence of match results to PostgreSQL

| Script             | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `npm start`        | Start with hot reload                     |
| `npm run build`    | Compile to `build/`                       |
| `npm test`         | Run the tests (requires PostgreSQL)       |
| `npm run loadtest` | Simulate clients against a running server |

See the [root README](../README.md) for setup, configuration, and deployment.
