export type JsonObject = Record<string, unknown>;

// Passed along untouched: Gemini adds a hidden extra_content field to each tool
// call and expects it back on the next request.
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  [key: string]: unknown;
};

export type AssistantMessage = { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | AssistantMessage
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

// A tool as the MCP server lists it.
export type Tool = {
  name: string;
  description?: string;
  inputSchema?: JsonObject;
  annotations?: { readOnlyHint?: boolean };
};

// A tool in the format the model's chat completions API expects.
export type ModelTool = {
  type: "function";
  function: { name: string; description: string; parameters: JsonObject };
};

export type Approval = { callId: string; name: string; args: JsonObject; allowed: boolean };

export type PendingApproval = { callId: string; name: string; args: JsonObject; reason: string };

export type ChatRequest = {
  messages: ChatMessage[];
  user: { name?: unknown; email?: unknown };
  approval?: Approval;
};

export type ChatResult = {
  messages: ChatMessage[];
  tools: Array<{ name: string; description: string; readOnly: boolean }>;
  pendingApproval: PendingApproval | null;
};
