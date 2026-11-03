import express, { type NextFunction, type Request, type Response } from "express";

import { runAgent } from "./agent.js";
import { HttpError } from "./errors.js";
import { connectMcp } from "./mcp.js";
import { createProvider } from "./provider.js";
import type { Approval, ChatMessage, ChatRequest, Tool } from "./types.js";

const isText = (value: unknown): value is string => typeof value === "string";

const isToolCall = (call: any): boolean =>
  isText(call?.id) && isText(call.function?.name) && isText(call.function.arguments);

const isApproval = (approval: any): approval is Approval =>
  isText(approval?.callId) &&
  isText(approval.name) &&
  typeof approval.args === "object" &&
  approval.args !== null &&
  typeof approval.allowed === "boolean";

// The browser sends the whole conversation every time. It may send user,
// assistant, and tool messages, but never a system message: the host writes
// the system prompt itself. Tool calls are kept whole (see ToolCall).
function readMessage(message: any): ChatMessage {
  if (message?.role === "user" && isText(message.content)) {
    return { role: "user", content: message.content };
  }
  if (
    message?.role === "assistant" &&
    (message.content === null || isText(message.content)) &&
    (message.tool_calls === undefined || (Array.isArray(message.tool_calls) && message.tool_calls.every(isToolCall)))
  ) {
    return { role: "assistant", content: message.content, ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) };
  }
  if (message?.role === "tool" && isText(message.tool_call_id) && isText(message.content)) {
    const name = isText(message.name) ? message.name : undefined;
    return { role: "tool", tool_call_id: message.tool_call_id, name, content: message.content };
  }
  throw new HttpError(400, "invalid_request", "Each message must be a valid user, assistant, or tool message.");
}

function readChatRequest(body: any): ChatRequest {
  if (!Array.isArray(body?.messages) || typeof body.user !== "object" || body.user === null) {
    throw new HttpError(400, "invalid_request", "The body needs a messages array and a user object.");
  }
  if (body.approval !== undefined && !isApproval(body.approval)) {
    throw new HttpError(400, "invalid_request", "The approval needs callId, name, args, and allowed.");
  }
  return {
    messages: body.messages.map(readMessage),
    user: { name: body.user.name, email: body.user.email },
    approval: body.approval,
  };
}

const app = express();
// The browser resends every tool result, which can pass the 100kb default.
app.use(express.json({ limit: "1mb" }));

app.post("/chat", async (request, response) => {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(503, "service_not_configured", "Add your key to .env, then restart npm run dev.", {
      missing: ["LLM_API_KEY"],
    });
  }
  const input = readChatRequest(request.body);
  const callModel = createProvider({
    baseUrl: process.env.LLM_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey,
    model: process.env.LLM_MODEL?.trim() || "gemini-3.1-flash-lite",
  });

  const mcp = await connectMcp("http://127.0.0.1:3002/mcp");
  try {
    response.json(
      await runAgent(input, {
        listTools: async () => (await mcp.listTools()).tools as Tool[],
        callTool: (name, args) => mcp.callTool({ name, arguments: args }),
        callModel,
      }),
    );
  } finally {
    await mcp.close().catch(() => {});
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }
  // A bug, not bad input: print it so it shows up in the npm run dev output.
  console.error(error);
  response.status(500).json({
    error: {
      code: "internal_error",
      message: error instanceof Error ? error.message : "Unexpected server error.",
    },
  });
});

app.listen(3003, "127.0.0.1", (error) => {
  if (error) {
    console.error(
      `Could not start the chat service on port 3003: ${error.message}. Another program may be using the port; run "npm run doctor" to check.`,
    );
    process.exit(1);
  }
  console.log("Chat service listening on http://127.0.0.1:3003");
});
