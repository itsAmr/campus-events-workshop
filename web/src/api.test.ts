import { describe, expect, it, vi } from "vitest";
import { ApiError, eventsUrl, request } from "./api";
import { toTranscript } from "./Chat";

const json = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

describe("request", () => {
  it("unwraps the REST data envelope", async () => {
    await expect(
      request("/api/v1/events/1", {}, json({ data: { id: 1 } })),
    ).resolves.toEqual({ id: 1 });
  });

  it("returns unenveloped bodies such as chat results", async () => {
    await expect(
      request("/chat", { method: "POST" }, json({ messages: [] })),
    ).resolves.toEqual({ messages: [] });
  });

  it("exposes validation field errors", async () => {
    const fetcher = json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { fields: { title: ["Required"] } },
        },
      },
      400,
    );
    const error = await request("/api/v1/events", { method: "POST" }, fetcher).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fields).toEqual({ title: ["Required"] });
  });

  it("explains 501 starter routes", async () => {
    const fetcher = json(
      {
        error: {
          code: "NOT_IMPLEMENTED",
          message: "Implement event listing in Part 1",
          details: { sourcePath: "api/src/app.ts" },
        },
      },
      501,
    );

    await expect(request("/api/v1/events", {}, fetcher)).rejects.toThrow(
      "Not implemented yet: GET /api/v1/events — Implement event listing in Part 1 (api/src/app.ts)",
    );
  });
});

describe("eventsUrl", () => {
  it("sends only non-empty filters", () => {
    expect(eventsUrl({ q: " robotics ", category: "", email: undefined })).toBe(
      "/api/v1/events?q=robotics",
    );
  });
});

describe("toTranscript", () => {
  it("pairs tool calls with their results", () => {
    expect(
      toTranscript([
        { role: "user", content: "Tech events?" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "search_events", arguments: "{}" },
            },
          ],
        },
        { role: "tool", tool_call_id: "call-1", content: "[]" },
        { role: "assistant", content: "Nothing this week." },
      ]),
    ).toEqual([
      { kind: "user", text: "Tech events?" },
      { kind: "tool", name: "search_events", args: "{}", result: "[]" },
      { kind: "assistant", text: "Nothing this week." },
    ]);
  });
});
