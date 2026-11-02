import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createCampusApi, notImplemented, reply, type CampusApiOptions } from "./api.js";
import { registerExtras } from "./extras.js";
import { resolveCampusDateRange, withLocalTime } from "./time.js";

// An MCP server turns an API into tools a chatbot can use. Each tool below
// wraps one REST route you wrote in Part 1:
//   list_categories   GET  /api/v1/categories
//   search_events     GET  /api/v1/events?q=...&category=...
//   get_event         GET  /api/v1/events/:id
//   rsvp_to_event     POST /api/v1/events/:id/rsvps
//   create_event      POST /api/v1/events
//
// Every tool has four parts:
//   1. a description: the only documentation the model ever reads
//   2. an input schema: the arguments the model must send, each with its own
//      description. MCP checks them before your handler runs.
//   3. annotations: readOnlyHint: true means the tool only reads, so the chat
//      runs it without asking. Anything else waits for the user to click Allow.
//   4. a handler: calls the REST route and replies with the result

export interface CampusMcpServerOptions extends CampusApiOptions {
  now?: () => Date;
}

export function createCampusMcpServer(options: CampusMcpServerOptions = {}): McpServer {
  const api = createCampusApi(options);
  const now = options.now ?? (() => new Date());
  const server = new McpServer({ name: "campus-events", version: "1.0.0" });

  // Worked example: a read-only tool with no arguments.
  server.registerTool(
    "list_categories",
    {
      description: "List the event categories that search_events and create_event accept.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const categories = await api.get("/api/v1/categories");
      return reply({ categories });
    },
  );

  // TODO(part-3.1): describe search_events for the model.
  //   Each argument below has a short description, but the model also needs
  //   to know how to use them together. Replace "Search campus events." with
  //   a few sentences that say:
  //     - it can search by text (query), category, and dates (when)
  //     - query is matched as one exact phrase, so send one or two keywords
  //       like "robotics", not a full event name
  //     - use category for topics (list_categories has the names)
  // Try it: ask the chat "Is there a robotics event coming up?"
  server.registerTool(
    "search_events",
    {
      description: "Search campus events.",
      inputSchema: {
        query: z.string().min(1).optional().describe('One or two keywords, like "robotics"'),
        category: z.string().min(1).optional().describe("A category name from list_categories"),
        when: z
          .enum(["today", "this_week", "this_weekend", "next_7_days", "any"])
          .default("any")
          .describe("Which dates to search, in Montreal time"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, category, when }) => {
      const range = resolveCampusDateRange(when, now());
      const events = await api.get("/api/v1/events", { q: query, category, from: range?.from, to: range?.to });
      return reply({ events: events.map(withLocalTime), range });
    },
  );

  // TODO(part-3.2): finish get_event.
  //   1. Add  annotations: { readOnlyHint: true },  under inputSchema. Without
  //      it, the chat plays safe and asks for approval every time the model
  //      looks an event up.
  //   2. In the handler, call the REST route you wrote in 1.2:
  //        const event = await api.get(`/api/v1/events/${id}`);
  //      then reply with it:  return reply({ event: withLocalTime(event) });
  //      withLocalTime adds the Montreal time, so the model skips timezone math.
  // Try it in MCP Inspector: call get_event with id 1.
  server.registerTool(
    "get_event",
    {
      description: "Get one campus event by its id, including how many spots are left.",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }) => {
      return notImplemented("3.2");
    },
  );

  // TODO(part-3.3): finish rsvp_to_event.
  //   Call the REST route you wrote in 1.4:
  //     const rsvp = await api.post(`/api/v1/events/${eventId}/rsvps`, { email });
  //   then reply with it like 3.2:  return reply({ rsvp });
  //   It isn't read-only, so the chat asks the user to click Allow first.
  // Try it: ask the chat to RSVP you to an event, then click Allow.
  server.registerTool(
    "rsvp_to_event",
    {
      description: "RSVP an email address to a campus event. Confirm the email with the user first.",
      inputSchema: {
        eventId: z.number().int().positive(),
        email: z.email(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ eventId, email }) => {
      return notImplemented("3.3");
    },
  );

  server.registerTool(
    "create_event",
    {
      description: "Create a campus event. Confirm every field with the user first.",
      inputSchema: {
        title: z.string().min(1),
        description: z.string().min(1),
        category: z.string().min(1).describe("A category name from list_categories"),
        startsAt: z.iso.datetime({ offset: true }).describe("ISO 8601 with an offset, like 2026-11-06T18:00:00-05:00"),
        endsAt: z.iso.datetime({ offset: true }).describe("ISO 8601 with an offset, after startsAt"),
        location: z.string().min(1),
        capacity: z.number().int().positive(),
        meetingUrl: z.url().optional().describe("Only for online events"),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const event = await api.post("/api/v1/events", input);
      return reply({ event: withLocalTime(event) });
    },
  );

  registerExtras(server);
  return server;
}
