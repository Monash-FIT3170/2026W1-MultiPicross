# MultiPicross API

The Hono HTTP API, served at `/api`. It handles OIDC sign-in and sessions,
profiles, settings, achievements, collections, and singleplayer saves.

- `src/auth/`: OIDC flow, cookies, CSRF, and session middleware
- `src/db/`: Drizzle schema and client. Migrations are generated into `drizzle/`
- `imgs/`: the puzzle bank, imported at startup

| Script                | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start with hot reload                          |
| `npm run build`       | Compile to `dist/`                             |
| `npm test`            | Run the tests (DB tests skip without Postgres) |
| `npm run db:generate` | Generate a migration from schema changes       |
| `npm run db:migrate`  | Apply migrations                               |

Interactive API documentation is served at `/api/docs`. See the
[root README](../README.md) for setup, configuration, and deployment.
