import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { pathToFileURL } from "node:url";

import { runAgent } from "./agent.js";
import { AgentInputError, HttpError } from "./errors.js";
import { connectMcp, type McpSession } from "./mcp.js";
import { createProvider } from "./provider.js";
import type {
  AgentRequest,
  ApprovalDecision,
  ChatMessage,
  JsonObject,
  ToolCall,
  UserIdentity,
} from "./types.js";

const DEFAULT_MCP_URL = "http://127.0.0.1:3002/mcp";

function objectValue(value: unknown): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === "object";
}

function parseToolCall(value: unknown): ToolCall {
  if (!objectValue(value) || !objectValue(value.function)) {
    throw new HttpError(400, "invalid_request", "Invalid assistant tool call.");
  }
  if (
    typeof value.id !== "string" ||
    value.type !== "function" ||
    typeof value.function.name !== "string" ||
    typeof value.function.arguments !== "string"
  ) {
    throw new HttpError(400, "invalid_request", "Invalid assistant tool call.");
  }
  return value as unknown as ToolCall;
}

function parseMessage(value: unknown): ChatMessage {
  if (!objectValue(value) || typeof value.role !== "string") {
    throw new HttpError(400, "invalid_request", "Each message needs a role.");
  }

  if (value.role === "user") {
    if (typeof value.content !== "string") {
      throw new HttpError(
        400,
        "invalid_request",
        "User message content must be a string.",
      );
    }
    return { role: "user", content: value.content };
  }

  if (value.role === "assistant") {
    if (value.content !== null && typeof value.content !== "string") {
      throw new HttpError(
        400,
        "invalid_request",
        "Assistant content must be a string or null.",
      );
    }
    const toolCalls =
      value.tool_calls === undefined
        ? undefined
        : Array.isArray(value.tool_calls)
          ? value.tool_calls.map(parseToolCall)
          : null;
    if (toolCalls === null) {
      throw new HttpError(
        400,
        "invalid_request",
        "Assistant tool_calls must be an array.",
      );
    }
    return {
      role: "assistant",
      content: value.content,
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    };
  }

  if (value.role === "tool") {
    if (
      typeof value.tool_call_id !== "string" ||
      typeof value.content !== "string" ||
      (value.name !== undefined && typeof value.name !== "string")
    ) {
      throw new HttpError(400, "invalid_request", "Invalid tool message.");
    }
    return {
      role: "tool",
      tool_call_id: value.tool_call_id,
      content: value.content,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
    };
  }

  throw new HttpError(
    400,
    "invalid_request",
    "Only user, assistant, and tool messages are accepted.",
  );
}

function parseApproval(value: unknown): ApprovalDecision | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    !objectValue(value) ||
    typeof value.callId !== "string" ||
    typeof value.name !== "string" ||
    !objectValue(value.args) ||
    typeof value.allowed !== "boolean"
  ) {
    throw new HttpError(400, "invalid_request", "Invalid approval decision.");
  }
  return value as unknown as ApprovalDecision;
}

function parseRequestBody(value: unknown): AgentRequest {
  if (
    !objectValue(value) ||
    !Array.isArray(value.messages) ||
    !objectValue(value.user)
  ) {
    throw new HttpError(
      400,
      "invalid_request",
      "Body must contain messages[] and a user identity object.",
    );
  }

  return {
    messages: value.messages.map(parseMessage),
    user: value.user as UserIdentity,
    approval: parseApproval(value.approval),
  };
}

export interface AppDependencies {
  connectMcp?: (url: string) => Promise<McpSession>;
  fetch?: typeof fetch;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const env = dependencies.env ?? process.env;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  const chatHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    let mcp: McpSession | undefined;
    try {
      const missing = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"].filter(
        (name) => !env[name]?.trim(),
      );
      if (missing.length) {
        throw new HttpError(
          503,
          "service_not_configured",
          "Required LLM configuration is missing.",
          { missing },
        );
      }

      const input = parseRequestBody(request.body);
      const connect = dependencies.connectMcp ?? connectMcp;
      mcp = await connect(env.MCP_URL?.trim() || DEFAULT_MCP_URL);
      const callModel = createProvider(
        {
          baseUrl: env.LLM_BASE_URL!,
          apiKey: env.LLM_API_KEY!,
          model: env.LLM_MODEL!,
        },
        dependencies.fetch,
      );

      const result = await runAgent(input, {
        listTools: () => mcp!.listTools(),
        callTool: (name, args) => mcp!.callTool(name, args),
        callModel,
        now: dependencies.now,
      });
      response.json(result);
    } catch (error) {
      next(error);
    } finally {
      if (mcp) {
        try {
          await mcp.close();
        } catch {
          // The response should not fail because connection cleanup failed.
        }
      }
    }
  };

  app.post("/api/chat", chatHandler);
  app.post("/chat", chatHandler);

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      if (error instanceof HttpError) {
        response.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined
              ? {}
              : { details: error.details }),
          },
        });
        return;
      }

      if (error instanceof AgentInputError) {
        response.status(400).json({
          error: {
            code: "invalid_approval",
            message: error.message,
          },
        });
        return;
      }

      if (
        error instanceof SyntaxError &&
        "status" in error &&
        error.status === 400
      ) {
        response.status(400).json({
          error: {
            code: "invalid_json",
            message: "Request body is not valid JSON.",
          },
        });
        return;
      }

      response.status(500).json({
        error: {
          code: "internal_error",
          message:
            error instanceof Error ? error.message : "Unexpected server error.",
        },
      });
    },
  );

  return app;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  createApp().listen(3003, "127.0.0.1", (error) => {
    if (error) {
      console.error(
        `Could not start the chat service on port 3003: ${error.message}. Another program may be using the port; run "npm run doctor" to check.`,
      );
      process.exit(1);
    }
    console.log("Chat service listening on http://127.0.0.1:3003");
  });
}
