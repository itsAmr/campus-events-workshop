# Part 1 — Build the REST API

**Time:** 25 minutes  
**Goal:** serve campus events from the database as JSON, so any client (the web app now, a chatbot later) can use them.

## What is a REST API?

A REST API exposes your data as **resources** at URLs, and clients act on them with standard HTTP **methods**:

| Request | Means |
| --- | --- |
| `GET /api/v1/events` | list events |
| `GET /api/v1/events/7` | get event 7 |
| `POST /api/v1/events` | create an event |
| `POST /api/v1/events/7/rsvps` | RSVP to event 7 |

The reply's **status code** says what happened: `200` OK, `201` Created, `400` bad input, `404` not found, `409` conflict (like a duplicate RSVP). Every reply in this API is JSON in the same shape, `{ "data": ... }` on success and `{ "error": { "code", "message" } }` on failure, so clients never have to guess.

## The three-step pattern

Open `api/src/app.ts`. Every route does the same three things:

1. **Check the request** with a schema from `events/requests.ts`. Bad input stops here with a `400`.
2. **Read or write the database** with a function from `events/store.ts`. This is where the SQL and the rules live.
3. **Reply** with `{ data: ... }`, built by a function from `events/responses.ts`.

Each TODO tells you exactly which function to call for each step. Run `npm run todos` any time to see what's left.

## 1.1 List events (together)

Your facilitator writes this one with you. Then open <http://localhost:3001/api/v1/events?category=Technology> in your browser. The web app at <http://localhost:5173> fills in at the same moment, because it calls this route.

## 1.2 Get one event

Try <http://localhost:3001/api/v1/events/1>, then `/api/v1/events/999` to see the `404`.

## 1.3 Create an event

Use **Create event** in the web app. Submit it once with a field left empty: the `400` reply's messages appear next to each field. The web app does no checking of its own; your API owns the rules.

## 1.4 RSVP to an event

Enter a name and email at the top of the web app and click **RSVP** on an event. Click it on "Tiny Climate Action Workshop" too: it's full, so you get a `409`.

## Stretch goals

TODOs 1.5 to 1.7 add updating and deleting events and cancelling an RSVP. **Cancel RSVP** in the web app uses 1.7.

## Done when

```bash
npm run check:1
```

- [ ] Every Part 1 test passes.
- [ ] The web app lists events, creates them, and RSVPs.

Stuck? Run `git stash`, then `git switch checkpoint/1-rest` and `npm run db:reset`.
