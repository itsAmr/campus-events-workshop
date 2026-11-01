# Part 2 — Design responses that can grow

**Time:** 20 minutes  
**Goal:** change what the API sends without breaking anyone who already uses it.

## Your response is a promise

The moment a client reads your JSON, every field name, type, and format becomes something their code depends on. The web app in `web/src/api.ts` expects `location` to be a string. The MCP server you'll meet in Part 3 expects timestamps like `2026-11-06T17:00:00.000Z`.

**Hyrum's law:** with enough users, every behavior they can observe will be depended on by somebody, whether you promised it or not.

A real example from this repo: nobody documented the timestamp format, but `mcp/src/schemas.ts` checks it. That's why Part 0 asked you to copy the `created_at` line. A database default of `CURRENT_TIMESTAMP` gives `2026-11-06 17:00:00`, which looks harmless and would have broken the MCP server's RSVP tool.

## Discuss: breaking or not?

Your facilitator will run a quick vote. Would each change break an existing client?

1. Add a new optional field, `imageUrl`.
2. Rename `startsAt` to `startTime`.
3. Change `location` from a string to an object.
4. Return events newest first instead of soonest first.
5. Change timestamps from `2026-11-06T17:00:00.000Z` to `2026-11-06 17:00:00`.
6. Add a new category, `Gaming`.

<details>
<summary>Answers</summary>

1. Usually safe. Adding is the safest change there is, though a client that rejects unknown fields would still break.
2. Breaking. Every client reading `startsAt` now gets nothing.
3. Breaking. Code that prints `location` now prints `[object Object]` or crashes.
4. Breaking for someone. The order was never promised, but a client showing "the next event" takes the first item. Hyrum's law.
5. Breaking. The meaning is the same, but parsers expect the exact format. Hyrum's law again.
6. Usually safe, unless a client has a hardcoded list of categories.

</details>

## The change we need

Online events need a meeting link. In v1, `location` is a string and online events get an extra `meetingUrl` field. A better design groups them:

```json
"location": { "name": "Online", "online": true, "url": "https://events.mcgill.ca/meet/6" }
```

That's change 3 from the vote: breaking. So v1 stays exactly as it is, and the new shape ships as **v2** at `/api/v2`. Old clients keep working, and new clients opt in when they're ready.

Look at what doesn't change: the database, `store.ts`, and every rule. Only the response is versioned. On the database side, `api/migrations/002_online_events.sql` added the `meeting_url` column as a new migration file. Adding an optional column changes nothing for existing queries, so the database could evolve without a version.

## 2.1 Build the v2 response

Open `api/src/events/responses.ts` and find `TODO(part-2.1)`. `toV1Event` is right above it as an example. Run `npm run check:2`: the three `2.1` tests should pass before you move on.

## 2.2 Serve v2

Add the two v2 routes in `api/src/app.ts`. Compare an online event in both versions:

- <http://localhost:3001/api/v1/events/6>
- <http://localhost:3001/api/v2/events/6>

## See why v1 has to stay

In `web/src/api.ts`, change `API_BASE` to `"/api/v2"` and look at the web app: it crashes, because it tries to show the `location` object as text. That's the client you would have broken by changing v1 in place. Change it back.

v1 also now tells clients it's on its way out. Open your browser's developer tools, go to the Network tab, and reload a v1 URL: the response has `Deprecation: true` and a `Sunset` date.

## Decisions that made v2 cheap

These were made on day one, before anyone needed them:

- **Responses are wrapped in `{ data: ... }`.** Adding `meta` or paging info later is just a new field next to `data`.
- **The version is in the URL from the start.** `/api/v1` looked unnecessary with one version; now v2 is just another prefix.
- **Errors have machine-readable codes.** Clients check `ALREADY_RSVPED`, not the wording of a message.
- **Response functions are separate from database rows.** Renaming a column changes `responses.ts`, not every client.

And the one v1 got wrong: `location` was a plain string. When something is likely to grow more details, make it an object from the start.

## Done when

```bash
npm run check:2
```

- [ ] Every Part 2 test passes.
- [ ] v1 still returns `location` as a string; v2 returns the object.

Stuck? Run `git stash`, then `git switch checkpoint/2-versioning` and `npm run db:reset`.
