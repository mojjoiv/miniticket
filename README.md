# Mini Ticket Tracker

**Hosted application:** [https://miniticket.onrender.com/](https://miniticket.onrender.com/)

A small full-stack support-ticket tracker built with Express, PostgreSQL, React, and Docker Compose.

## Requirements
- Docker Engine and Docker Compose v2
- Git

## Configure environment

Copy the example file to create your local environment configuration, then replace the example database password with a local value. `.env` is ignored by Git; commit only `.env.example`, never real credentials.

```bash
cp .env.example .env
```

The template documents the PostgreSQL database/user/password, backend port and environment, database connection URL, and frontend API URL. The `DATABASE_URL` password must match `POSTGRES_PASSWORD`.

## Initialize and run

```bash
git clone https://github.com/mojjoiv/miniticket.git
cd miniticket
cp .env.example .env
# Edit .env and set a local password in both POSTGRES_PASSWORD and DATABASE_URL.
docker compose up --build
```

Open the UI at http://localhost:5173 and the API at http://localhost:3000. PostgreSQL is exposed on port 5432 for local inspection. On first startup, Compose mounts `backend/schema.sql` into PostgreSQL's initialization directory and creates the `tickets` table automatically. To reset the local database and re-run initialization, use `docker compose down -v` followed by `docker compose up --build` (this deletes local ticket data).

## API
- `POST /tickets` — create a ticket (title required; description, status and priority optional).
- `GET /tickets?status=open&page=1&limit=10` — list tickets with optional status filter and pagination.
- `PATCH /tickets/:id` — update status and/or priority.
- `GET /tickets/stats` — counts grouped by status.
- `GET /health` — lightweight health check.

Allowed statuses: `open`, `in_progress`, `closed`. Allowed priorities: `low`, `medium`, `high`. Invalid input returns a 400 response; missing ticket IDs return 404. List responses include `data` and pagination metadata.

## Run tests

The integration tests use a real PostgreSQL database. Start the stack first, then run:

```bash
docker compose exec backend npm test
```

The test runner creates and removes its own test records in the configured database. For isolated test data, set `DATABASE_URL` to a dedicated test database before running the backend test command.
