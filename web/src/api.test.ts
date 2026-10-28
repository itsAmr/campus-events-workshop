import { describe, expect, it, vi } from "vitest";
import { ApiError, normalizeEvent, request } from "./api";

describe("request", () => {
  it("unwraps API data envelopes", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "event-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      request<{ id: string }>("/api/v1/events/event-1", {}, fetcher),
    ).resolves.toEqual({ id: "event-1" });
  });

  it("preserves server field errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Please correct the highlighted fields",
          errors: { title: ["A title is required"], capacity: "Must be positive" },
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const error: unknown = await request(
      "/api/v1/events",
      { method: "POST" },
      fetcher,
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({
      title: "A title is required",
      capacity: "Must be positive",
    });
  });

  it("formats 501 responses as actionable implementation errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sourcePath: "src/routes/events.ts" }), {
        status: 501,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      request("/api/v1/events/42/rsvp", { method: "DELETE" }, fetcher),
    ).rejects.toThrow(
      "Not implemented yet: DELETE /api/v1/events/42/rsvp (src/routes/events.ts)",
    );
  });
});

describe("normalizeEvent", () => {
  it("accepts snake_case API fields", () => {
    expect(
      normalizeEvent({
        event_id: 7,
        name: "Robotics Night",
        type: "Academic",
        venue: "Engineering Hall",
        starts_at: "2026-10-28T22:00:00Z",
        max_attendees: 40,
        attendee_count: 18,
        is_attending: true,
      }),
    ).toMatchObject({
      id: "7",
      title: "Robotics Night",
      category: "Academic",
      location: "Engineering Hall",
      capacity: 40,
      attendeeCount: 18,
      isAttending: true,
    });
  });
});
