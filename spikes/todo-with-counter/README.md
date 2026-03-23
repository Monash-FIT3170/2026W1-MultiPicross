# Todo with Synchronized Counter Spike

Todo app (Postgres + Drizzle) with a synchronized counter via Colyseus.

## Requirements

- `docker` and `docker compose`

On macOS/Linux, you can use [OrbStack](https://orbstack.dev/) (recommended). You can also use [Docker Desktop](https://docs.docker.com/desktop/) (scroll down to "Install Docker Desktop").

On Windows, you can use [Docker Desktop](https://docs.docker.com/desktop/) (Scroll down to "Install Docker Desktop").

- `node` and `npm` (optional for the spike but highly recommended)
Download from the [official Node.js website](https://nodejs.org/en/download/current) (links to current version).
 
Recommended to install with `nvm` + `npm` for macOS/Linux, and Chocolatey (`choco`) + `npm` for Windows.

## Running

```sh
docker compose up --watch --build
```

You can then access the following services in your browser or via API calls:

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:5173  |
| API      | http://localhost:3000  |
| Colyseus | http://localhost:2567  |
| Postgres | localhost:5432         |

You can read `docker-compose.yml` for more details on the services and their configuration, and the `Dockerfile` within each service for how they are built.

*Note*: Docker is set up to automatically sync/rebuild if you change any source code files, so you only need to run the command above once (keep it running in a terminal while you work on the spike). You can stop the services with `Ctrl + C` and restart them with the same command if needed. 

# Spike Outline

(See each section for more details)

The goal of this spike is to implement a simple todo app with an additional synchronized counter feature using Colyseus. 

The todo app will use a Postgres database with Drizzle as the ORM, and the frontend will be built with React. The user should be able to create, delete, and mark todos as completed through the frontend, which will communicate with the API service, and push updates to the database. 

The Colyseus server will manage a room that synchronizes a counter across all connected clients. Clients should be able to increment/decrement the counter, and see the updated value in real-time.

High-level tasks to implement:

- [ ] Implement api endpoints for todo app
- [ ] Implement frontend for todo app
- [ ] Implement Colyseus room for synchronized counter
- [ ] Implement frontend for synchronized counter


## API

The API service is built with [Hono](https://hono.dev/) (API server) and [Drizzle](https://orm.drizzle.team/) (ORM).

The API service is located in the `api` directory. You can read the code there for more details, but the main files to look at are:

- `api/src/index.ts`: main entry point, where you should register API routes 
- `api/src/db/schema.ts`: Drizzle schema for the `todos` table (in case you want to modify the schema, but you don't need to for this spike)
- `api/src/db/index.ts`: Drizzle database client setup (for those interested in how Drizzle is set up, but you don't need to change anything here for the spike)
- `api/src/routes/todos.ts`: API routes for the todo app (CRUD operations)

In the last file, you only need to implement routes to handle the following operations:

- [x] Get all todos (GET `/todos`). This is done for you, but feel free to read the code and understand how it works.
- [ ] Create a new todo (POST `/todos`). We provide the method signature, but you need to implement the logic to insert a new todo into the database.
- [ ] Delete a todo (DELETE `/todos/:id`). 
- [ ] Update a todo (PATCH `/todos/:id`). This should be used to mark a todo as completed, but you can also implement other update operations if you wish (e.g. update the text of the todo).

See the ORM section for more information about Drizzle if you're interested.

## Frontend

The frontend service is built with [Vite](https://vitejs.dev/) (build tool, not important to understand for this spike) and uses [React](https://react.dev/).

The frontend service is located in the `frontend` directory. The main files to look at are:
- `frontend/src/App.tsx`: main entry point, defines the UI and API calls for the todo app, as well as the synchronized counter. 
- `/frontend/src/components/Counter.tsx`: React component for the synchronized counter lobby. You can implement the UI and API calls to interact with the Colyseus room here.
- `/frontend/src/components/Todo.tsx`: React component for the todo list. You can implement the UI and API calls to interact with the API service here.

Each component has some TODO comments and some existing code to help you get started, but most of it is left for you to implement.

- [ ] Implement UI and API calls for todo app in `Todo.tsx` (You should implement the API first)
- [ ] Implement UI and API calls for synchronized counter lobby in `Counter.tsx` (You should implement the Colyseus room logic first)

Note: The colyseus client library has already been set up for you in `Counter.tsx`. You just need to implement the logic to connect to the room, send messages to increment/decrement the counter, and set up handlers to listen for changes in the room state to update the UI.

Remember to use `useEffect` in React to set up these handlers when the component mounts, otherwise the UI may not update in response to changes in the room state.


## Colyseus

The Colyseus service is built with [Colyseus](https://colyseus.io/) (real-time state synchronization with websockets).

Colyseus serves as our pub/sub server. Note, clients cannot directly modify the state in Colyseus rooms, but instead send messages to the server. The server then processes these messages (and can update the room state accordingly). The room state is then automatically synchronized across all clients in the room.

Colyseus supports setting up handlers on the client side to listen for changes in the room state, so you can update the UI in real-time as the state changes (e.g. when the counter is incremented/decremented by any client in the lobby).

(Remember to use `useEffect` in React to set up these handlers when the component mounts)

The Colyseus service is located in the `colyseus` directory. The main files to look at are:
- `colyseus/index.ts`: main entry point, registers room handlers and other endpoints (for this spike, you don't need to add anything here, but it may be useful to read and understand how the server is set up).
- `colyseus/src/rooms/MyRoom.ts`: room handler for the synchronized counter lobby. This is where you implement room logic. You'll need to implement logic to handle messages from clients to increment/decrement the counter.
- `colyseus/src/rooms/schema/MyRoomState.ts`: schema for the room state. You can add properties here that you want to synchronize across clients in the room (e.g. the counter value, or the number of active connections).

## Drizzle (Database ORM)

While you don't need to change the schema for this spike, if you do wish to do so, this section covers how to update the database schema using Drizzle.

After updating the schema in `api/src/db/schema.ts`, generate a new migration:

```sh
cd api
npm install
npx drizzle-kit generate
```

Then, rebuild the API service to apply the migration:

(make sure to kill the previous `docker compose` process and run it again to rebuild with the new migration)
```sh
docker compose up --watch --build
```

*Note*: The index.ts file in `api/src/index.ts` is set up to automatically run pending migrations on server start, so you don't need to do anything else to apply the migration to the database.
Normally, you would have to push the generated SQL migration manually, but in this case, we've set it up to avoid having to do that. The `package.json` file contains the following scripts for reference if you want to run the migration commands manually:

```json
{
    scripts: {
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:push": "drizzle-kit push",
        "db:studio": "drizzle-kit studio"
    }
}
```