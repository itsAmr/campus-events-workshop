import { HttpError } from "./errors.js";
import type {
  ChatMessage,
  ProviderRequest,
  ProviderResponse,
  ToolCall,
} from "./types.js";

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function completionUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function parseAssistantMessage(value: unknown): ProviderResponse["message"] {
  if (value === null || typeof value !== "object") {
    throw new HttpError(
      502,
      "invalid_provider_response",
      "The LLM provider returned an invalid assistant message.",
    );
  }

  const candidate = value as {
    role?: unknown;
    content?: unknown;
    tool_calls?: unknown;
  };
  if (
    candidate.content !== null &&
    typeof candidate.content !== "string" &&
    candidate.content !== undefined
  ) {
    throw new HttpError(
      502,
      "invalid_provider_response",
      "The LLM provider returned invalid assistant content.",
    );
  }

  let toolCalls: ToolCall[] | undefined;
  if (candidate.tool_calls !== undefined) {
    if (!Array.isArray(candidate.tool_calls)) {
      throw new HttpError(
        502,
        "invalid_provider_response",
        "The LLM provider returned invalid tool calls.",
      );
    }
    toolCalls = candidate.tool_calls.map((item) => {
      const call = item as Partial<ToolCall>;
      if (
        typeof call.id !== "string" ||
        call.type !== "function" ||
        typeof call.function?.name !== "string" ||
        typeof call.function.arguments !== "string"
      ) {
        throw new HttpError(
          502,
          "invalid_provider_response",
          "The LLM provider returned a malformed tool call.",
        );
      }
      return call as ToolCall;
    });
  }

  return {
    role: "assistant",
    content: typeof candidate.content === "string" ? candidate.content : null,
    ...(toolCalls ? { tool_calls: toolCalls } : {}),
  };
}

export function createProvider(
  config: ProviderConfig,
  fetchImplementation: typeof fetch = fetch,
): (request: ProviderRequest) => Promise<ProviderResponse> {
  return async (request) => {
    let response: Response;
    try {
      response = await fetchImplementation(completionUrl(config.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: request.messages,
          ...(request.tools.length
            ? { tools: request.tools, tool_choice: "auto" }
            : {}),
        }),
      });
    } catch (error) {
      throw new HttpError(
        502,
        "provider_unavailable",
        "Could not reach the LLM provider.",
      );
    }

    const bodyText = await response.text();
    let body: unknown;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = bodyText;
    }

    if (!response.ok) {
      // Gemini wraps errors in an array; OpenAI-style providers use an object.
      const detail = (
        (Array.isArray(body) ? body[0] : body) as
          | { error?: { message?: unknown } }
          | null
      )?.error?.message;
      throw new HttpError(
        502,
        "provider_error",
        `The LLM provider returned HTTP ${response.status}${
          typeof detail === "string" ? `: ${detail}` : "."
        }`,
      );
    }

    const message = (
      body as { choices?: Array<{ message?: ChatMessage }> } | null
    )?.choices?.[0]?.message;
    return { message: parseAssistantMessage(message) };
  };
}
