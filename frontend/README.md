# MultiPicross Frontend

The React single-page application, built with Vite and Tailwind CSS and served
by Nginx in production.

- `src/pages/`: top-level screens (menus, singleplayer, multiplayer, settings, statistics)
- `src/components/`: shared UI components
- `src/api/` and `src/colyseus.ts`: clients for the API and the game server

| Script          | Purpose                           |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the Vite development server |
| `npm run build` | Typecheck and build to `dist/`    |
| `npm run lint`  | Run ESLint                        |

The frontend uses relative URLs for `/api` and `/gs`, so it must be accessed
through Traefik at `http://multipicross.localhost`, not on its own port. See the
[root README](../README.md) for setup.
