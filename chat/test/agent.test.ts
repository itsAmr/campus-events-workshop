import { describe, expect, it, vi } from "vitest";

import { runAgent } from "../src/agent.js";
import type {
  AgentDependencies,
  ChatMessage,
  ProviderResponse,
} from "../src/types.js";

const fixedDate = new Date("2026-10-28T16:00:00.000Z");

function assistant(
  message: ProviderResponse["message"],
): Promise<ProviderResponse> {
  return Promise.resolve({ message });
}

describe("runAgent", () => {
  it("executes read-only tools and exposes their trace", async () => {
    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Found it" }],
    });
    const callModel = vi
      .fn<AgentDependencies["callModel"]>()
      .mockImplementationOnce(({ messages }) => {
        expect(messages[0]).toMatchObject({
          role: "system",
          content: expect.stringContaining('"name":"Ada"'),
        });
        return assistant({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "read-1",
              type: "function",
              function: {
                name: "lookup",
                arguments: '{"id":"event-7"}',
              },
            },
          ],
        });
      })
      .mockImplementationOnce(() =>
        assistant({ role: "assistant", content: "The event is tonight." }),
      );

    const result = await runAgent(
      {
        messages: [{ role: "user", content: "When is the event?" }],
        user: { id: "u-1", name: "Ada" },
      },
      {
        listTools: async () => [
          {
            name: "lookup",
            inputSchema: { type: "object" },
            annotations: { readOnlyHint: true },
          },
        ],
        callTool,
        callModel,
        now: () => fixedDate,
      },
    );

    expect(callTool).toHaveBeenCalledWith("lookup", { id: "event-7" });
    expect(result.pendingApproval).toBeNull();
    expect(result.toolTrace).toEqual([
      expect.objectContaining({
        callId: "read-1",
        name: "lookup",
        status: "success",
      }),
    ]);
    expect(result.assistantMessages.at(-1)?.content).toBe(
      "The event is tonight.",
    );
  });

  it("pauses before a write and executes only after matching approval", async () => {
    const firstModel = vi.fn().mockImplementation(() =>
      assistant({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "write-1",
            type: "function",
            function: {
              name: "create_event",
              arguments: '{"title":"Workshop"}',
            },
          },
        ],
      }),
    );
    const callTool = vi.fn().mockResolvedValue({ content: "created" });
    const tools = async () => [
      {
        name: "create_event",
        inputSchema: { type: "object" },
        annotations: { readOnlyHint: false },
      },
    ];

    const pending = await runAgent(
      {
        messages: [{ role: "user", content: "Create a workshop." }],
        user: { id: "u-2" },
      },
      {
        listTools: tools,
        callTool,
        callModel: firstModel,
        now: () => fixedDate,
      },
    );

    expect(callTool).not.toHaveBeenCalled();
    expect(pending.pendingApproval).toEqual({
      callId: "write-1",
      name: "create_event",
      args: { title: "Workshop" },
      reason: "This tool is not annotated as read-only.",
    });

    const finalModel = vi.fn().mockImplementation(() =>
      assistant({ role: "assistant", content: "Created the workshop." }),
    );
    const resumed = await runAgent(
      {
        messages: pending.messages as ChatMessage[],
        user: { id: "u-2" },
        approval: {
          callId: "write-1",
          name: "create_event",
          args: { title: "Workshop" },
          allowed: true,
        },
      },
      {
        listTools: tools,
        callTool,
        callModel: finalModel,
        now: () => fixedDate,
      },
    );

    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledWith("create_event", {
      title: "Workshop",
    });
    expect(resumed.pendingApproval).toBeNull();
    expect(resumed.toolTrace[0]).toMatchObject({
      callId: "write-1",
      status: "success",
    });
  });

  it("records a denied write without calling MCP", async () => {
    const callTool = vi.fn();
    const messages: ChatMessage[] = [
      { role: "user", content: "Delete it." },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "write-2",
            type: "function",
            function: { name: "delete_event", arguments: '{"id":"e-1"}' },
          },
        ],
      },
    ];

    const result = await runAgent(
      {
        messages,
        user: { id: "u-3" },
        approval: {
          callId: "write-2",
          name: "delete_event",
          args: { id: "e-1" },
          allowed: false,
        },
      },
      {
        listTools: async () => [
          {
            name: "delete_event",
            annotations: { readOnlyHint: false },
          },
        ],
        callTool,
        callModel: async () =>
          assistant({ role: "assistant", content: "I did not delete it." }),
      },
    );

    expect(callTool).not.toHaveBeenCalled();
    expect(result.toolTrace[0]).toMatchObject({
      callId: "write-2",
      status: "denied",
    });
  });
});
