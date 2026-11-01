import { McpServer } from "@modelcontextprotocol/server";
import { createCampusApi, notImplemented, toToolResult, type CampusApiOptions } from "./api.js";
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

  // TODO(part-3.1): describe search_events for the model.
  //   The description is the only documentation the model ever reads. Tell it:
  //     - what it can search by: text (`query`), `category`, and dates (`when`)
  //     - that `query` is matched as one exact phrase, so send one or two
  //       keywords like "robotics", not a full event name
  //     - to use `category` for topics (list_categories has the names)
  // Try it: ask the chat "Is there a robotics event coming up?"
  server.registerTool(
    "search_events",
    {
      title: "Search campus events",
      description: "Search campus events.",
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

  // TODO(part-3.2): finish get_event.
  //   1. Add  annotations: readOnly,  under outputSchema. Without it, the chat
  //      plays safe and asks for approval every time the model looks an event up.
  //   2. In the handler, call the REST route you wrote in 1.2:
  //        const event = await api.get(`/api/v1/events/${id}`);
  //      then return { event: withLocalTime(event) };
  // Try it in MCP Inspector: call get_event with id 1.
  server.registerTool(
    "get_event",
    {
      title: "Get an event",
      description: "Get one campus event by its ID, including how many spots are left.",
      inputSchema: GetEventInputSchema,
      outputSchema: GetEventOutputSchema,
    },
    ({ id }) =>
      toToolResult(async () => {
        return notImplemented("3.2");
      }),
  );

  // TODO(part-3.3): finish rsvp_to_event.
  //   Call the REST route you wrote in 1.4:
  //     const rsvp = await api.post(`/api/v1/events/${eventId}/rsvps`, { email });
  //   then return { rsvp }. It is annotated as a write, so the chat asks the
  //   user to approve before this code runs.
  // Try it: ask the chat to RSVP you to an event, then click Allow.
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
        return notImplemented("3.3");
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
