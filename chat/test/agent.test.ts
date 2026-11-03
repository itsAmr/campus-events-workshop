import { describe, expect, it, vi } from "vitest";

import { runAgent, type AgentDependencies } from "../src/agent.js";
import type { AssistantMessage, ChatMessage, Tool, ToolCall } from "../src/types.js";

const tools: Tool[] = [
  { name: "lookup", inputSchema: { $schema: "draft", type: "object" }, annotations: { readOnlyHint: true } },
  { name: "rsvp", inputSchema: { type: "object" } },
];

function call(id: string, name: string, args: object): ToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function asks(...calls: ToolCall[]): AssistantMessage {
  return { role: "assistant", content: null, tool_calls: calls };
}

function says(content: string): AssistantMessage {
  return { role: "assistant", content };
}

function host(replies: AssistantMessage[]) {
  const callTool = vi.fn<AgentDependencies["callTool"]>().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
  const callModel = vi.fn<AgentDependencies["callModel"]>();
  for (const reply of replies) callModel.mockResolvedValueOnce(reply);
  callModel.mockResolvedValue(says("done"));
  return { callTool, callModel, listTools: async () => tools };
}

const question: ChatMessage[] = [{ role: "user", content: "Help me" }];
const user = { name: "Ada", email: "ada@mcgill.ca" };

describe("runAgent", () => {
  it("runs read-only tools without asking", async () => {
    const dependencies = host([asks(call("c1", "lookup", { id: 7 })), says("The event is tonight.")]);

    const result = await runAgent({ messages: question, user }, dependencies);

    expect(dependencies.callTool).toHaveBeenCalledWith("lookup", { id: 7 });
    expect(result.pendingApproval).toBeNull();
    expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(result.messages.at(-1)).toEqual(says("The event is tonight."));
    expect(result.tools).toEqual([
      { name: "lookup", description: "", readOnly: true },
      { name: "rsvp", description: "", readOnly: false },
    ]);

    const [sent, modelTools] = dependencies.callModel.mock.calls[0];
    expect(sent[0]).toMatchObject({ role: "system", content: expect.stringContaining('"name":"Ada"') });
    expect(modelTools[0].function.parameters).toEqual({ type: "object" });
  });

  it("pauses a write until the user approves that exact call", async () => {
    const first = host([asks(call("w1", "rsvp", { eventId: 7 }))]);
    const paused = await runAgent({ messages: question, user }, first);

    expect(first.callTool).not.toHaveBeenCalled();
    expect(paused.pendingApproval).toMatchObject({ callId: "w1", name: "rsvp", args: { eventId: 7 } });

    const second = host([says("You're going.")]);
    const approved = await runAgent(
      { messages: paused.messages, user, approval: { callId: "w1", name: "rsvp", args: { eventId: 7 }, allowed: true } },
      second,
    );

    expect(second.callTool).toHaveBeenCalledWith("rsvp", { eventId: 7 });
    expect(approved.messages.at(-1)).toEqual(says("You're going."));
  });

  it("tells the model when the user denies a write", async () => {
    const paused = await runAgent({ messages: question, user }, host([asks(call("w1", "rsvp", { eventId: 7 }))]));
    const dependencies = host([says("Okay, I won't.")]);

    const result = await runAgent(
      { messages: paused.messages, user, approval: { callId: "w1", name: "rsvp", args: { eventId: 7 }, allowed: false } },
      dependencies,
    );

    expect(dependencies.callTool).not.toHaveBeenCalled();
    expect(result.messages).toContainEqual(
      expect.objectContaining({ role: "tool", tool_call_id: "w1", content: "The user denied this tool call." }),
    );
  });

  it.each([
    ["different arguments", { callId: "w1", name: "rsvp", args: { eventId: 8 } }],
    ["a different tool", { callId: "w1", name: "lookup", args: { eventId: 7 } }],
    ["a call that isn't waiting", { callId: "nope", name: "rsvp", args: { eventId: 7 } }],
  ])("refuses an approval for %s", async (_label, approval) => {
    const paused = await runAgent({ messages: question, user }, host([asks(call("w1", "rsvp", { eventId: 7 }))]));
    const dependencies = host([]);

    await expect(
      runAgent({ messages: paused.messages, user, approval: { ...approval, allowed: true } }, dependencies),
    ).rejects.toMatchObject({ status: 400, code: "invalid_approval" });
    expect(dependencies.callTool).not.toHaveBeenCalled();
  });

  it("refuses tools the MCP server doesn't list", async () => {
    const dependencies = host([asks(call("x1", "delete_everything", {}))]);

    const result = await runAgent({ messages: question, user }, dependencies);

    expect(dependencies.callTool).not.toHaveBeenCalled();
    expect(result.messages).toContainEqual(
      expect.objectContaining({ role: "tool", tool_call_id: "x1", content: "Unknown tool: delete_everything" }),
    );
  });

  it("stops after six rounds of tool calls", async () => {
    const dependencies = host([]);
    dependencies.callModel.mockReset();
    let round = 0;
    dependencies.callModel.mockImplementation(async () => asks(call(`r${(round += 1)}`, "lookup", {})));

    const result = await runAgent({ messages: question, user }, dependencies);

    expect(dependencies.callModel).toHaveBeenCalledTimes(6);
    expect(result.messages.at(-1)).toEqual(says(expect.stringContaining("I stopped after 6 rounds")));
  });

  it("sends tool calls back to the model with every field it added", async () => {
    const signed = { ...call("c1", "lookup", {}), extra_content: { google: { thought_signature: "abc" } } };
    const dependencies = host([asks(signed)]);

    await runAgent({ messages: question, user }, dependencies);

    const [sent] = dependencies.callModel.mock.calls[1];
    expect(sent).toContainEqual(asks(signed));
  });
});
