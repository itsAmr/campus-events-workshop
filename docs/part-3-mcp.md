# Part 3 — Wrap the API with MCP

**Time:** 27 minutes  
**Goal:** let a chatbot use your API, without changing the API at all.

## What is MCP?

You have an API. You want people to just ask, "Is there a robotics event this week?" and have a chatbot answer from your real data, or RSVP them when they say so.

The **Model Context Protocol (MCP)** is a standard way to describe what your system can do so that an AI model can use it. You write a small **MCP server** that wraps an existing API. Any chat app that speaks MCP can then use it: this workshop's chat, Claude, Cursor, ChatGPT, and others. That works for any existing API, not just this one.

```text
You ──> chat app (host) ──MCP──> MCP server ──HTTP──> REST API ──> database
             │                     (this part)          (Parts 1-2)  (Part 0)
             └── asks the model which tool to call, and asks you before any write
```

Three roles to know:

- **Host:** the chat app. It talks to the model and decides what actually runs.
- **Server:** your code in `mcp/`. It lists **tools** and runs them by calling the REST API. It never opens the database.
- **Model:** reads the tool descriptions and asks the host to call one. It never calls your API directly.

## Read the server

Open `mcp/src/server.ts`. The comment at the top lists the five tools and the REST route each one wraps. Then read `list_categories`, the worked example. Every tool has four parts:

1. a **description**: the only documentation the model ever reads;
2. an **input schema**: the arguments the model must send, checked before your code runs;
3. **annotations**: `readOnlyHint: true` means the tool only reads, so the chat runs it without asking. Anything else waits for you to click **Allow**;
4. a **handler**: calls the REST route and replies with the result.

When a handler throws, for example because the API said `EVENT_FULL`, MCP sends the error message to the model instead, so it can explain what went wrong.

That file is most of the server. The others are short, and you don't need to change them:

| File | What it does |
| --- | --- |
| `api.ts` | `api.get` and `api.post` call your REST API; `reply` wraps a result for the model |
| `time.ts` | turns "this weekend" into Montreal dates, and adds a ready-to-quote `localTime` to each event, because models are bad at timezone math |
| `extras.ts` | the two other things an MCP server can offer: a **resource** (read-only content) and a **prompt** (a reusable message template) |
| `main.ts` | serves it all over HTTP at <http://localhost:3002/mcp> |

Start MCP Inspector, a tool for calling MCP servers by hand:

```bash
npm run inspector
```

Open the URL it prints, connect, list the tools, and run `list_categories`. It's already pointed at your server on port 3002.

## 3.1 Describe `search_events`

The model decides which tool to use, and with which arguments, by reading descriptions. A vague description gives vague searches. Follow `TODO(part-3.1)`, then ask the chat at <http://localhost:5173>: "Is there a robotics event coming up?"

## 3.2 Finish `get_event`

One annotation and one API call: the route you wrote in 1.2. In Inspector, run `get_event` with `id` 1.

## 3.3 Finish `rsvp_to_event`

One API call: the route you wrote in 1.4. This tool changes data, so the chat shows you exactly what it's about to do and waits for **Allow**. Ask the chat to RSVP you to an event and try both **Deny** and **Allow**.

## Done when

```bash
npm run check:3
```

- [ ] Every Part 3 test passes, and the Part 3 TODO comments are deleted.
- [ ] Inspector can run `list_categories`, `search_events`, and `get_event`.
- [ ] The chat finds events and asks before RSVPing.

Stuck? Run `git stash`, then `git switch solution` and `npm run db:reset`.
