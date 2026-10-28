# Part 1 — Build the REST API

**Target time:** 30 minutes  
**Goal:** serve campus events from SQLite through a validated Express API.

> Path check: this worksheet expects the paths below. The final starter scaffold may rename files; use `npm run doctor`, the workspace `package.json` files, and facilitator instructions to verify them before editing.

## API contract

You will implement:

- `GET /health`
- `GET /api/v1/categories`
- `GET /api/v1/events?q=<text>&from=<ISO date>&to=<ISO date>&category=<value>`
- `GET /api/v1/events/:id`
- `POST /api/v1/events`

An event has an ID, title, description, category, location, start time, and end time. Use the starter's schema and field names as the source of truth.

## TODO 1: inspect the seed data

Expected paths:

- `api/src/db/database.ts` — opens SQLite and applies migrations
- `api/src/db/seed.ts` — creates relative-date workshop data
- `api/migrations/001_init.sql` — initial schema
- `api/data/campus-events.db` — generated local database; do not hand-edit it

Find the events table and answer:

1. Which fields are required?
2. Are timestamps stored in UTC?
3. Which code owns database initialization?

Start the API from the repository root:

```bash
npm run dev --workspace api
```

Check its health from another terminal:

```bash
curl -i http://localhost:3001/health
```

Expected: HTTP `200` and a small JSON response.

## TODO 2: list and filter events

Expected paths:

- `api/src/app.ts` — Express handlers and route mounting
- `api/src/events/repository.ts` — parameterized SQLite queries
- `api/src/events/service.ts` — event business rules
- `api/src/events/schemas.ts` — request validation

Implement the list route using parameterized SQLite queries. Support the starter's date range and category filters. Do not build SQL by concatenating user input.

Try it:

```bash
curl -s "http://localhost:3001/api/v1/categories"
curl -s "http://localhost:3001/api/v1/events"
curl -s "http://localhost:3001/api/v1/events?from=2026-10-26T00:00:00.000Z&to=2026-11-02T00:00:00.000Z"
curl -s "http://localhost:3001/api/v1/events?q=robotics&category=Engineering"
```

Acceptance checks:

- [ ] The response is valid JSON with a stable top-level shape.
- [ ] Results are ordered by start time.
- [ ] A valid date range returns only matching events.
- [ ] Invalid date or category input returns a `400`, not a server error.
- [ ] SQL values are passed as parameters.

## TODO 3: fetch one event

Implement `GET /api/v1/events/:id`.

```bash
curl -i http://localhost:3001/api/v1/events/1
curl -i http://localhost:3001/api/v1/events/999999
```

Acceptance checks:

- [ ] A known ID returns `200` and one event.
- [ ] A missing ID returns `404` with JSON.
- [ ] A malformed ID returns `400`.

## TODO 4: create an event

Implement `POST /api/v1/events`. Validate at the HTTP boundary and rely on database constraints as a second line of defense.

Use the exact fields from the starter schema. A representative request is:

```bash
curl -i \
  -X POST http://localhost:3001/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "McGill Web Dev Meetup",
    "description": "Student talks and project demos.",
    "category": "Technology",
    "location": "Trottier 0100",
    "startsAt": "2026-10-30T22:00:00.000Z",
    "endsAt": "2026-10-30T23:30:00.000Z",
    "capacity": 40
  }'
```

Acceptance checks:

- [ ] A valid event returns `201` and the created record, including its ID.
- [ ] Missing required fields return `400` with useful, non-secret details.
- [ ] End time must be later than start time.
- [ ] Unknown request fields are rejected or deliberately ignored according to the starter contract.
- [ ] Sending the list request again includes the new event.

## TODO 5: connect the React app

Expected path:

- `web/src/api.ts` — REST and chat client

The web app calls `/api/v1` and Vite proxies it to the API (`web/vite.config.ts`), so no frontend change is needed. Open `http://localhost:5173`: the "Not implemented yet" message disappears as soon as your list route works, and search, category, and date filters are sent to your API as query parameters. Create an event with missing fields to see your `400` field errors next to each input.

## Final acceptance

```bash
npm run doctor
npm test --workspace api
```

- [ ] Health, list, detail, and create endpoints work.
- [ ] The browser renders API data.
- [ ] Invalid input never produces an HTML stack trace.
- [ ] The API, not the web app, owns validation and SQLite access.

If you are blocked, save your work and switch to `checkpoint/1-rest`.
