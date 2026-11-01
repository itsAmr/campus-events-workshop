import { McpServer } from "@modelcontextprotocol/server";
import { createCampusApi, toToolResult, type CampusApiOptions } from "./api.js";
import { registerExtras } from "./extras.js";
import {
  CreateEventInputSchema,
  CreateEventOutputSchema,
  GetEventInputSchema,
  GetEventOutputSchema,
  ListCategoriesInputSchema,
  ListCategoriesOutputSchema,
  RsvpInputSchema,
  RsvpOutputSchema,
  SearchEventsInputSchema,
  SearchEventsOutputSchema,
  type CampusEvent,
} from "./schemas.js";
import { resolveCampusDateRange, withLocalTime } from "./time.js";

// Every tool has the same parts:
//   - a name and a description: the only documentation the model ever sees
//   - an input schema: the arguments the model must send, checked before your code runs
//   - annotations: whether the tool only reads, so the chat host knows when to ask
//     the user for approval
//   - a handler: calls the REST API and returns the result

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };

export interface CampusMcpServerOptions extends CampusApiOptions {
  now?: () => Date;
}

export function createCampusMcpServer(options: CampusMcpServerOptions = {}): McpServer {
  const api = createCampusApi(options);
  const now = options.now ?? (() => new Date());
  const server = new McpServer(
    { name: "campus-events", version: "1.0.0" },
    {
      instructions:
        "Use these tools to discover campus events, inspect details, RSVP, and create events. Dates are interpreted in America/Montreal.",
    },
  );

  // Worked example: a read-only tool with no arguments.
  server.registerTool(
    "list_categories",
    {
      title: "List event categories",
      description: "List the categories accepted by search_events and create_event.",
      inputSchema: ListCategoriesInputSchema,
      outputSchema: ListCategoriesOutputSchema,
      annotations: readOnly,
    },
    () =>
      toToolResult(async () => {
        const categories = await api.get("/api/v1/categories");
        return { categories };
      }),
  );

  server.registerTool(
    "search_events",
    {
      title: "Search campus events",
      description:
        "Search by text, category, and a Montreal-local date range. `query` is matched as one exact phrase against titles and descriptions, so pass one or two distinctive keywords (for example \"robotics\"), not the full event name or filler words like \"event\". To filter by topic, prefer `category` (see list_categories). If nothing matches, retry with fewer keywords before telling the user an event doesn't exist. When telling the user when an event happens, quote its localTime rather than converting startsAt yourself.",
      inputSchema: SearchEventsInputSchema,
      outputSchema: SearchEventsOutputSchema,
      annotations: readOnly,
    },
    ({ query, category, when }) =>
      toToolResult(async () => {
        const range = resolveCampusDateRange(when, now());
        const search = new URLSearchParams();
        if (query) search.set("q", query);
        if (category) search.set("category", category);
        if (range) {
          search.set("from", range.from);
          search.set("to", range.to);
        }
        const events: CampusEvent[] = await api.get(`/api/v1/events?${search}`);
        return { events: events.map(withLocalTime), ...(range ? { range } : {}) };
      }),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get an event",
      description: "Get one campus event by its ID, including how many spots are left.",
      inputSchema: GetEventInputSchema,
      outputSchema: GetEventOutputSchema,
      annotations: readOnly,
    },
    ({ id }) =>
      toToolResult(async () => {
        const event = await api.get(`/api/v1/events/${id}`);
        return { event: withLocalTime(event) };
      }),
  );

  server.registerTool(
    "rsvp_to_event",
    {
      title: "RSVP to an event",
      description: "RSVP an email address to a campus event. Confirm the email with the user first.",
      inputSchema: RsvpInputSchema,
      outputSchema: RsvpOutputSchema,
      annotations: write,
    },
    ({ eventId, email }) =>
      toToolResult(async () => {
        const rsvp = await api.post(`/api/v1/events/${eventId}/rsvps`, { email });
        return { rsvp };
      }),
  );

  server.registerTool(
    "create_event",
    {
      title: "Create a campus event",
      description:
        "Create an event. startsAt and endsAt must be ISO 8601 timestamps with an offset, and endsAt must be later.",
      inputSchema: CreateEventInputSchema,
      outputSchema: CreateEventOutputSchema,
      annotations: write,
    },
    (input) =>
      toToolResult(async () => {
        const event = await api.post("/api/v1/events", input);
        return { event: withLocalTime(event) };
      }),
  );

  registerExtras(server);
  return server;
}
