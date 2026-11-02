import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// Tools are one of three things an MCP server can offer. This file shows the
// other two, which the workshop chat does not use but MCP Inspector can:
//   - a resource: read-only content a host can show or attach, like a file
//   - a prompt: a reusable message template a user picks from a menu

export function registerExtras(server: McpServer): void {
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
            "4. Use `rsvp_to_event` only after confirming the attendee's email.",
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
      description: "Build a balanced week plan from upcoming campus events and the user's interests.",
      argsSchema: {
        interests: z.string().min(1).optional(),
        availability: z.string().min(1).optional(),
      },
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
}
