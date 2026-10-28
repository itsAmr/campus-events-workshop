# Part 2 — Version the API

**Target time:** 20 minutes  
**Goal:** evolve `/api/v1` to `/api/v2` without duplicating event logic or surprising existing clients.

> Path check: this worksheet expects the paths below, but they may need verification against the final starter scaffold. The worked change makes `location` a structured object in v2.

## Why version?

URLs are contracts. A web app and an MCP server can upgrade at different times, so incompatible API changes need an explicit boundary. Version routing, not the database schema or service layer.

## TODO 1: identify the breaking change

Expected paths:

- `api/src/app.ts` — mounts v1 and v2 routers
- `api/src/events/mappers.ts` — maps one domain row to each API version
- `api/src/events/service.ts` — version-independent operations
- `api/src/events/repository.ts` — version-independent persistence
- `api/migrations/002_online_events.sql` — adds optional online-event data

In v1, `location` is a string and an online URL may appear separately as `meetingUrl`. In v2, `location` becomes:

```json
{
  "name": "Online",
  "online": true,
  "url": "https://…"
}
```

That shape change would break a v1 client, so it needs a new representation version. Database rows and business rules do not need versions.

Compare the same seeded event:

```bash
curl -s "http://localhost:3001/api/v1/events?q=AI%20Ethics"
curl -s "http://localhost:3001/api/v2/events?q=AI%20Ethics"
```

Acceptance checks:

- [ ] You can describe exactly which response field is incompatible.
- [ ] The database and service layer remain shared.
- [ ] Each version has an explicit response mapper.

## TODO 2: mount the v2 read routes

Implement and mount:

- `GET /api/v2/events`
- `GET /api/v2/events/:id`

```bash
curl -i http://localhost:3001/api/v2/events
curl -i "http://localhost:3001/api/v2/events?category=Technology"
curl -i http://localhost:3001/api/v2/events/1
```

Keep the Part 1 write contract on v1 for this exercise:

```bash
curl -i \
  -X POST http://localhost:3001/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Design Study Group",
    "description": "Practice stable contracts and useful errors.",
    "category": "Technology",
    "location": "McConnell 103",
    "startsAt": "2026-10-31T18:00:00.000Z",
    "endsAt": "2026-10-31T19:00:00.000Z",
    "capacity": 24
  }'
```

Acceptance checks:

- [ ] v1 list, detail, and create routes preserve Part 1 behavior.
- [ ] v2 list and detail return structured `location` objects.
- [ ] Both versions call the same service methods.
- [ ] Unknown versioned routes return JSON `404`.
- [ ] Errors do not expose stack traces or SQLite details.

## TODO 3: publish the v1 lifecycle

Expected path:

- `api/src/app.ts`

Add the workshop's `Deprecation` and `Sunset` headers to v1 responses. Keep v1 behavior working; a deprecation signal is not permission to break it.

Compare:

```bash
curl -i http://localhost:3001/api/v1/events
curl -i http://localhost:3001/api/v2/events
```

Acceptance checks:

- [ ] v1 includes `Deprecation: true`.
- [ ] v1 includes the configured HTTP-date `Sunset` value.
- [ ] v2 does not advertise itself as deprecated.
- [ ] The retirement date is documented and can be changed in one place.

## TODO 4: prove clients can migrate independently

Expected paths:

- `web/src/api.ts`
- `api/tests/app.test.ts`

The web app may remain on v1 during this exercise. Inspect its normalization boundary and explain what would need to change before switching its single `API_BASE` constant to v2. Add API tests that compare both representations of the same event.

Acceptance checks:

- [ ] API tests exercise both `/api/v1` and `/api/v2`.
- [ ] A test proves v1 `location` is a string.
- [ ] A test proves v2 `location` is an object.
- [ ] The React app continues to work on v1 while v2 is introduced.

## Stretch: additive evolution

Design a v2 create endpoint. Decide whether it accepts the v2 location object, the v1 fields, or both. Write the contract before implementing anything.

## Final acceptance

```bash
npm test --workspace api
npm run doctor
```

- [ ] v1 remains usable and advertises its lifecycle.
- [ ] v2 returns the documented location shape.
- [ ] No SQL or business logic was duplicated to create v2.
- [ ] Version-specific code is limited to HTTP routing and mapping.

If you are blocked, save your work and switch to `checkpoint/2-versioning`.
