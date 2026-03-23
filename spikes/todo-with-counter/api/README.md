# Backend

This service is built with [Hono](https://hono.dev/) (API server) and [Drizzle](https://orm.drizzle.team/) (ORM).

We recommend reading through the Hono documentation to understand how to implement API routes, and the Drizzle documentation to understand how to interact with the database.

Since we use Postgres, ensure the Drizzle documentation you read is for Postgres specifically, as some features may differ from other databases.

This service is dockerized (See `Dockerfile`), and as such we recommend running it with `docker compose` as described in the main `README.md`. However, you can also run it locally with the following commands if you prefer (requires Node.js and npm to be installed):

```sh
cd api
npm install
npm start
```

(*Note*: we do not recommend running the API without Docker, as you will also need to set up a local Postgres database and configure environment variables)