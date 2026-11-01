import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, type CallToolResult, type McpServer } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createCampusMcpServer } from "../src/server.js";
import { resolveCampusDateRange } from "../src/time.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const structured = <T>(result: CallToolResult) => result.structuredContent as T;
const errorText = (result: CallToolResult) =>
  JSON.parse(result.content[0]?.type === "text" ? result.content[0].text : "{}");

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

describe("Part 3: MCP server", () => {
  let server: McpServer;
  let client: Client;
  let fetchMock: Mock<typeof fetch>;

  beforeEach(async () => {
    fetchMock = vi.fn<typeof fetch>();
    server = createCampusMcpServer({
      fetch: fetchMock,
      now: () => new Date("2026-10-28T02:00:00.000Z"),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "campus-mcp-test", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  const toolNamed = async (name: string) =>
    (await client.listTools()).tools.find((tool) => tool.name === name);

  it("lists categories (worked example)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: ["Arts"] }));
    const result = await client.callTool({ name: "list_categories", arguments: {} });
    expect(structured(result)).toEqual({ categories: ["Arts"] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3001/api/v1/categories");
  });

  it("3.1 get_event calls GET /api/v1/events/:id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ...eventFixture, title: "Robotics demo" } }));
    const result = await client.callTool({ name: "get_event", arguments: { id: 1 } });

    expect(result.isError).not.toBe(true);
    expect(structured(result)).toMatchObject({
      event: {
        id: 1,
        title: "Robotics demo",
        localTime: expect.stringMatching(/^Tue, Oct 27, 6:00\s*–\s*9:00\sPM \(Montreal time\)$/),
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3001/api/v1/events/1");
  });

  it("3.1 get_event is marked read-only, so the chat doesn't ask for approval", async () => {
    expect((await toolNamed("get_event"))?.annotations?.readOnlyHint).toBe(true);
  });

  it("3.2 search_events has a description that tells the model how to search", async () => {
    const description = (await toolNamed("search_events"))?.description ?? "";
    expect(description.length, "Explain what to search by and how to write query").toBeGreaterThan(80);
  });

  it("search_events sends a Montreal-local date range to the API", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [eventFixture] }));
    const result = await client.callTool({
      name: "search_events",
      arguments: { query: "market", category: "social", when: "today" },
    });

    expect(structured<{ range: unknown }>(result).range).toEqual({
      startDate: "2026-10-27",
      endDate: "2026-10-28",
      from: "2026-10-27T04:00:00.000Z",
      to: "2026-10-28T03:59:59.999Z",
      timezone: "America/Montreal",
    });
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/v1/events");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "market",
      category: "social",
      from: "2026-10-27T04:00:00.000Z",
      to: "2026-10-28T03:59:59.999Z",
    });
  });

  it("3.3 rsvp_to_event calls POST /api/v1/events/:id/rsvps with the email", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { data: { id: 1, eventId: 1, email: "ada@example.com", createdAt: "2026-10-27T12:00:00.000Z" } },
        201,
      ),
    );
    const result = await client.callTool({
      name: "rsvp_to_event",
      arguments: { eventId: 1, email: "ada@example.com" },
    });

    expect(result.isError).not.toBe(true);
    expect(structured(result)).toMatchObject({ rsvp: { eventId: 1, email: "ada@example.com" } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3001/api/v1/events/1/rsvps");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ email: "ada@example.com" });
  });

  it("marks writes as writes, so the chat asks for approval", async () => {
    expect((await toolNamed("rsvp_to_event"))?.annotations?.readOnlyHint).toBe(false);
    expect((await toolNamed("create_event"))?.annotations?.readOnlyHint).toBe(false);
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
      jsonResponse({ data: { ...eventFixture, ...input, id: 2, rsvpCount: 0, availableSpots: 20 } }, 201),
    );
    const result = await client.callTool({ name: "create_event", arguments: input });

    expect(structured<{ event: { id: number } }>(result).event.id).toBe(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3001/api/v1/events");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(input);
  });

  it("rejects invalid tool arguments before calling the API", async () => {
    const missingId = await client.callTool({ name: "get_event", arguments: {} });
    const badEmail = await client.callTool({
      name: "rsvp_to_event",
      arguments: { eventId: 1, email: "not-an-email" },
    });
    expect(missingId.isError).toBe(true);
    expect(badEmail.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the API's error code and message back to the model", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "NOT_FOUND", message: "Event not found" } }, 404),
    );
    const result = await client.callTool({ name: "get_event", arguments: { id: 999 } });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toEqual({ code: "NOT_FOUND", message: "Event not found" });
  });

  it("explains which response shape it expected when the API breaks its contract", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([eventFixture]));
    const result = await client.callTool({ name: "search_events", arguments: {} });
    expect(result.isError).toBe(true);
    expect(errorText(result).message).toContain("should reply with { data: ... }");
  });

  it("calculates every named range as Montreal calendar dates", () => {
    const now = new Date("2026-10-28T02:00:00.000Z");
    expect(resolveCampusDateRange("today", now)).toMatchObject({ startDate: "2026-10-27", endDate: "2026-10-28" });
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

  it("serves the guide resource and planning prompt from extras.ts", async () => {
    const resource = await client.readResource({ uri: "campus://guide" });
    const guide = resource.contents[0];
    expect(guide && "text" in guide ? guide.text : "").toContain("list_categories");

    const prompt = await client.getPrompt({ name: "plan-campus-week" });
    expect(prompt.messages[0]?.content).toMatchObject({ type: "text" });
  });
});
