import { McpServer } from "@modelcontextprotocol/server";

import {
  createCampusApiClient,
  toToolResult,
  type CampusApiClientOptions,
} from "./api.js";
import { resolveCampusDateRange } from "./dateRanges.js";
import {
  CreateEventInputSchema,
  CreateEventOutputSchema,
  EventSchema,
  GetEventInputSchema,
  GetEventOutputSchema,
  ListCategoriesInputSchema,
  ListCategoriesOutputSchema,
  PlanCampusWeekArgsSchema,
  RsvpInputSchema,
  RsvpOutputSchema,
  SearchEventsInputSchema,
  SearchEventsOutputSchema,
  type CampusEvent,
  type Category,
  type Rsvp,
} from "./schemas.js";

export interface CampusMcpServerOptions extends CampusApiClientOptions {
  now?: () => Date;
}

const API_PREFIX = "/api/v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapList<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) {
    return body as T[];
  }
  if (isRecord(body) && Array.isArray(body[key])) {
    return body[key] as T[];
  }
  if (isRecord(body) && Array.isArray(body.data)) {
    return body.data as T[];
  }
  return [];
}

function unwrapObject<T>(body: unknown, key: string): T {
  if (isRecord(body) && body[key] !== undefined) {
    return body[key] as T;
  }
  if (isRecord(body) && body.data !== undefined) {
    return body.data as T;
  }
  return body as T;
}

export function createCampusMcpServer(
  options: CampusMcpServerOptions = {},
): McpServer {
  const api = createCampusApiClient(options);
  const now = options.now ?? (() => new Date());
  const server = new McpServer(
    {
      name: "campus-events",
      version: "1.0.0",
    },
    {
      instructions:
        "Use these tools to discover campus events, inspect details, RSVP, and create events. Dates are interpreted in America/Montreal.",
    },
  );

  server.registerTool(
    "list_categories",
    {
      title: "List event categories",
      description:
        "Worked example: call with no arguments to list the categories accepted by search_events and create_event.",
      inputSchema: ListCategoriesInputSchema,
      outputSchema: ListCategoriesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    () =>
      toToolResult(async () => {
        const body = await api.request<unknown>(`${API_PREFIX}/categories`);
        return { categories: unwrapList<Category>(body, "categories") };
      }),
  );

  // TODO(part-3): register search_events, get_event, rsvp_to_event, and
  // create_event below. Remove this early return when you begin Part 3.
  return server;

  server.registerTool(
    "search_events",
    {
      title: "Search campus events",
      description:
        "Search by text, category, and a Montreal-local date range. Range end dates are exclusive.",
      inputSchema: SearchEventsInputSchema,
      outputSchema: SearchEventsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    ({ query, category, when }) =>
      toToolResult(async () => {
        const range = resolveCampusDateRange(when, now());
        const search = new URLSearchParams();
        if (query !== undefined) {
          search.set("q", query);
        }
        if (category !== undefined) {
          search.set("category", category);
        }
        if (range !== undefined) {
          search.set("from", range.from);
          search.set("to", range.to);
        }

        const suffix = search.size > 0 ? `?${search.toString()}` : "";
        const body = await api.request<unknown>(
          `${API_PREFIX}/events${suffix}`,
        );
        return {
          events: unwrapList<CampusEvent>(body, "events"),
          ...(range === undefined ? {} : { range }),
        };
      }),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get an event",
      description: "Get one campus event by ID.",
      inputSchema: GetEventInputSchema,
      outputSchema: GetEventOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    ({ id }) =>
      toToolResult(async () => {
        const body = await api.request<unknown>(
          `${API_PREFIX}/events/${encodeURIComponent(id)}`,
        );
        return { event: unwrapObject<CampusEvent>(body, "event") };
      }),
  );

  server.registerTool(
    "rsvp_to_event",
    {
      title: "RSVP to an event",
      description: "Create an RSVP for a campus event.",
      inputSchema: RsvpInputSchema,
      outputSchema: RsvpOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    ({ eventId, name, email }) =>
      toToolResult(async () => {
        const body = await api.request<unknown>(
          `${API_PREFIX}/events/${encodeURIComponent(eventId)}/rsvps`,
          {
            method: "POST",
            body: { email },
          },
        );
        const response = unwrapObject<Partial<Rsvp>>(body, "rsvp");
        return {
          rsvp: {
            ...response,
            eventId: response.eventId ?? eventId,
            name: response.name ?? name,
            email: response.email ?? email,
          },
        };
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
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    (input) =>
      toToolResult(async () => {
        const body = await api.request<unknown>(`${API_PREFIX}/events`, {
          method: "POST",
          body: input,
        });
        return { event: EventSchema.parse(unwrapObject(body, "event")) };
      }),
  );

  server.registerResource(
    "campus-guide",
    "campus://guide",
    {
      title: "Campus events guide",
      description: "How to use the campus events MCP tools.",
      mimeType: "text/markdown",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# Campus events guide",
            "",
            "1. Call `list_categories` to discover valid categories.",
            "2. Call `search_events` with `when` to search Montreal-local dates.",
            "3. Call `get_event` before making an RSVP.",
            "4. Use `rsvp_to_event` only after confirming the attendee details.",
            "5. Use `create_event` after confirming all event fields and timestamps.",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan-campus-week",
    {
      title: "Plan a campus week",
      description:
        "Build a balanced week plan from upcoming campus events and the user's interests.",
      argsSchema: PlanCampusWeekArgsSchema,
    },
    ({ interests, availability }) => ({
      description: "Plan a week of campus events.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Plan my campus week in America/Montreal.",
              interests === undefined
                ? "Use a varied mix of categories."
                : `Prioritize these interests: ${interests}.`,
              availability === undefined
                ? "Ask about availability if timing choices are ambiguous."
                : `Respect this availability: ${availability}.`,
              "First list categories, then search this_week and inspect promising events.",
              "Return a conflict-free schedule with event IDs, times, locations, and brief reasons.",
              "Do not RSVP or create events without explicit confirmation.",
            ].join(" "),
          },
        },
      ],
    }),
  );

  return server;
}
