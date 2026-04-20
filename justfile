# MultiPicross development commands

# Start all services with hot-reload (docker compose watch)
dev *args:
    docker compose up --build --watch {{args}}

# Start all services
up *args:
    docker compose up --build {{args}}

# Start all services in the background
upd *args:
    docker compose up --build -d {{args}}

# Stop all services
down *args:
    docker compose down {{args}}

# View logs (optionally for a specific service)
logs *args:
    docker compose logs -f {{args}}

# Restart a specific service
restart service:
    docker compose restart {{service}}

# Open a psql shell
db:
    docker compose exec db psql -U picross

# Wipe database volume and restart fresh
db-reset:
    docker compose down -v
    docker compose up --build -d

# Start production build
prod *args:
    docker compose -f compose.yaml -f compose.prod.yaml up --build {{args}}

# Show running services
ps:
    docker compose ps

# Format all code with Prettier
format:
    npm run format

# Lint all code with ESLint
lint:
    npm run lint
