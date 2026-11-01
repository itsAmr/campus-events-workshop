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

An MCP server can offer three things: **tools** (actions the model can ask for), **resources** (read-only content), and **prompts** (reusable message templates). This workshop uses tools; `mcp/src/extras.ts` shows the other two.

## Read the worked example

Open `mcp/src/server.ts` and read `list_categories`. Every tool has the same parts:

- a **name** and **description**: the only documentation the model ever gets;
- an **input schema**: the arguments the model must send, checked before your code runs;
- **annotations**: whether the tool only reads, so the host knows when to ask you for approval;
- a **handler**: calls the REST API and returns the result.

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

This tool changes data, so it's annotated as a write. The chat will show you exactly what it's about to do and wait for **Allow**. Ask the chat to RSVP you to an event and try both **Deny** and **Allow**.

## Done when

```bash
npm run check:3
```

- [ ] Every Part 3 test passes.
- [ ] Inspector can run `list_categories`, `search_events`, and `get_event`.
- [ ] The chat finds events and asks before RSVPing.

Stuck? Run `git stash`, then `git switch solution` and `npm run db:reset`.
