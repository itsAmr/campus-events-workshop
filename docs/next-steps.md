# Next steps

You built a database, an API, and an MCP server, and kept each one simple on purpose. Here's how to take it further, roughly in order of difficulty.

## Use your server from other chat apps

Your MCP server isn't tied to this workshop's chat. Claude Desktop, Cursor, VS Code, and ChatGPT can all connect to an MCP server: point one at `http://127.0.0.1:3002/mcp` and ask it about campus events.

## Add more tools

- `cancel_rsvp`, using the route from stretch goal 1.7. Should it be a write? What should the approval card say?
- `update_event`, using stretch goal 1.5.
- A tool that lists the events an email is attending. The API already supports `?email=` on the list route.

## Split the store into layers

`events/store.ts` mixes two jobs: the SQL, and the rules (an RSVP must not exceed capacity, an event must end after it starts). That's fine at this size. As an app grows, teams usually split it into layers:

- **Routes (controllers):** HTTP only. This is `app.ts`.
- **Services:** the business rules, with no SQL and no HTTP.
- **Repositories:** the SQL, with no rules.

Each layer can then be tested and changed on its own, for example swapping SQLite for Postgres without touching any rule. Try moving the rules from `rsvp()` into an `events/service.ts` and keeping only SQL in the store.

## Add real users

Right now anyone can type any email and RSVP as someone else. Add sign-in, so the API knows who is asking and RSVPs use the signed-in user. MCP has its own sign-in flow (OAuth), so a chat app can act for a specific user.

## Use a production database

SQLite is a single file on your laptop. A hosted Postgres database lets several API servers share data. You'd also swap the hand-written migration runner for a migration tool.

## Grow the API

- **Paging:** `?limit=20&cursor=...`, with paging details next to `data` in the response. The `{ data }` envelope already leaves room.
- **A v2 create route** that accepts the new `location` object. Decide what happens to v1 clients that still send a string.
- **Search** across more fields, or by distance from campus.

## Deploy it

Put the API and MCP server on a hosting service so a friend can use your chatbot. You'll need sign-in first, since the server would be public.
