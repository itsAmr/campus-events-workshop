export type JsonObject = Record<string, unknown>;

export interface UserIdentity {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: FunctionCall;
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    }
  | {
      role: "tool";
      tool_call_id: string;
      name?: string;
      content: string;
    };

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonObject;
  annotations?: {
    readOnlyHint?: boolean;
    [key: string]: unknown;
  };
}

export interface ToolTrace {
  callId: string;
  name: string;
  args: JsonObject;
  status: "success" | "error" | "denied";
  result?: unknown;
  error?: string;
}

export interface ApprovalDecision {
  callId: string;
  name: string;
  args: JsonObject;
  allowed: boolean;
}

export interface PendingApproval {
  callId: string;
  name: string;
  args: JsonObject;
  reason: string;
}

export interface ProviderRequest {
  messages: ChatMessage[];
  tools: OpenAiToolDefinition[];
}

export interface ProviderResponse {
  message: Extract<ChatMessage, { role: "assistant" }>;
}

export interface OpenAiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonObject;
  };
}

export interface AgentDependencies {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: JsonObject): Promise<unknown>;
  callModel(request: ProviderRequest): Promise<ProviderResponse>;
  now?: () => Date;
}

export interface AgentRequest {
  messages: ChatMessage[];
  user: UserIdentity;
  approval?: ApprovalDecision;
}

export interface AgentResult {
  messages: ChatMessage[];
  assistantMessages: Array<
    Extract<ChatMessage, { role: "assistant" }>
  >;
  toolTrace: ToolTrace[];
  tools: Array<{
    name: string;
    description: string;
    readOnly: boolean;
  }>;
  pendingApproval: PendingApproval | null;
}
