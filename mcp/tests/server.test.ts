import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  type CallToolResult,
  type McpServer,
} from "@modelcontextprotocol/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { createCampusMcpServer } from "../src/server.js";
import { resolveCampusDateRange } from "../src/dateRanges.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function structured<T>(result: CallToolResult): T {
  return result.structuredContent as T;
}

const eventFixture = {
  id: 1,
  title: "Night market",
  description: "Food and music on campus.",
  category: "Social",
  startsAt: "2026-10-27T22:00:00.000Z",
  endsAt: "2026-10-28T01:00:00.000Z",
  location: "Main quad",
  capacity: 100,
  rsvpCount: 10,
  availableSpots: 90,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
};

describe("campus events MCP server", () => {
  let server: McpServer;
  let client: Client;
  let fetchMock: Mock<typeof fetch>;

  beforeEach(async () => {
    fetchMock = vi.fn<typeof fetch>();
    server = createCampusMcpServer({
      fetch: fetchMock,
      now: () => new Date("2026-10-28T02:00:00.000Z"),
    });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "campus-mcp-test", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("advertises every tool with its safety annotations", async () => {
    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "list_categories",
      "search_events",
      "get_event",
      "rsvp_to_event",
      "create_event",
    ]);
    expect(tools.find(({ name }) => name === "list_categories")?.annotations).toMatchObject(
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    );
    expect(tools.find(({ name }) => name === "create_event")?.annotations).toMatchObject(
      {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    );
  });

  it("lists categories", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: ["Arts"],
      }),
    );

    const result = await client.callTool({
      name: "list_categories",
      arguments: {},
    });

    expect(result.isError).not.toBe(true);
    expect(structured(result)).toMatchObject({
      categories: ["Arts"],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/categories",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("searches with a Montreal-local date range", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [eventFixture] }),
    );

    const result = await client.callTool({
      name: "search_events",
      arguments: {
        query: "market",
        category: "social",
        when: "today",
      },
    });
    expect(result.isError).not.toBe(true);

    const payload = structured<{
      events: unknown[];
      range: {
        startDate: string;
        endDate: string;
        from: string;
        to: string;
        timezone: string;
      };
    }>(result);
    expect(payload.range).toEqual({
      startDate: "2026-10-27",
      endDate: "2026-10-28",
      from: "2026-10-27T04:00:00.000Z",
      to: "2026-10-28T03:59:59.999Z",
      timezone: "America/Montreal",
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/api/v1/events");
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      q: "market",
      category: "social",
      from: "2026-10-27T04:00:00.000Z",
      to: "2026-10-28T03:59:59.999Z",
    });
  });

  it("calculates every named range as Montreal calendar dates", () => {
    const now = new Date("2026-10-28T02:00:00.000Z");

    expect(resolveCampusDateRange("today", now)).toMatchObject({
      startDate: "2026-10-27",
      endDate: "2026-10-28",
    });
    expect(resolveCampusDateRange("this_week", now)).toMatchObject({
      startDate: "2026-10-27",
      endDate: "2026-11-02",
      from: "2026-10-27T04:00:00.000Z",
      to: "2026-11-02T04:59:59.999Z",
    });
    expect(resolveCampusDateRange("this_weekend", now)).toMatchObject({
      startDate: "2026-10-31",
      endDate: "2026-11-02",
    });
    expect(resolveCampusDateRange("next_7_days", now)).toMatchObject({
      startDate: "2026-10-27",
      endDate: "2026-11-03",
    });
    expect(resolveCampusDateRange("any", now)).toBeUndefined();
  });

  it("gets an event", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: { ...eventFixture, title: "Robotics demo" },
      }),
    );

    const result = await client.callTool({
      name: "get_event",
      arguments: { id: 1 },
    });

    expect(structured(result)).toMatchObject({
      event: { id: 1, title: "Robotics demo" },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:3001/api/v1/events/1",
    );
  });

  it("creates an RSVP", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            id: 1,
            eventId: 1,
            email: "ada@example.com",
            createdAt: "2026-10-27T12:00:00.000Z",
          },
        },
        201,
      ),
    );

    const result = await client.callTool({
      name: "rsvp_to_event",
      arguments: {
        eventId: 1,
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    });

    expect(structured(result)).toMatchObject({
      rsvp: {
        eventId: 1,
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      email: "ada@example.com",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:3001/api/v1/events/1/rsvps",
    );
  });

  it("creates an event", async () => {
    const input = {
      title: "Study jam",
      description: "A quiet study session",
      category: "academic",
      startsAt: "2026-11-03T18:00:00-05:00",
      endsAt: "2026-11-03T20:00:00-05:00",
      location: "Library 2",
      capacity: 20,
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            ...eventFixture,
            ...input,
            id: 2,
            rsvpCount: 0,
            availableSpots: input.capacity,
          },
        },
        201,
      ),
    );

    const result = await client.callTool({
      name: "create_event",
      arguments: input,
    });

    expect(structured<{ event: { id: number } }>(result).event.id).toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:3001/api/v1/events",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(
      input,
    );
  });

  it("rejects invalid tool inputs before calling the API", async () => {
    const missingId = await client.callTool({
      name: "get_event",
      arguments: {},
    });
    const invalidEmail = await client.callTool({
      name: "rsvp_to_event",
      arguments: {
        eventId: 1,
        name: "Ada",
        email: "not-an-email",
      },
    });
    expect(missingId.isError).toBe(true);
    expect(invalidEmail.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves REST API error code and message in an MCP error result", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "Event not found",
          },
        },
        404,
      ),
    );

    const result = await client.callTool({
      name: "get_event",
      arguments: { id: 999 },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "")).toEqual(
      {
        code: "NOT_FOUND",
        message: "Event not found",
      },
    );
  });

  it("serves the guide resource and planning prompt", async () => {
    const resource = await client.readResource({ uri: "campus://guide" });
    const guide = resource.contents[0];
    expect(guide && "text" in guide ? guide.text : "").toContain(
      "list_categories",
    );

    const prompt = await client.getPrompt({ name: "plan-campus-week" });
    expect(prompt.messages[0]?.content).toMatchObject({
      type: "text",
    });
  });
});
