import { HttpError } from "./errors.js";
import type { AssistantMessage, ChatMessage, ModelTool } from "./types.js";

type ProviderConfig = { baseUrl: string; apiKey: string; model: string };

// Calls the model through an OpenAI-compatible chat completions API. Gemini
// offers one, so any provider with that API works by changing .env.
export function createProvider(config: ProviderConfig) {
  return async (messages: ChatMessage[], tools: ModelTool[]): Promise<AssistantMessage> => {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: config.model, messages, ...(tools.length ? { tools } : {}) }),
      // Without a limit, a stuck provider would leave the chat on "Thinking" forever.
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {
      throw new HttpError(502, "provider_unavailable", "The LLM provider didn't answer. Try again in a moment.");
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      // Gemini wraps errors in an array; OpenAI-style providers use an object.
      const detail = (Array.isArray(body) ? body[0] : body)?.error?.message;
      throw new HttpError(
        502,
        "provider_error",
        `The LLM provider returned HTTP ${response.status}${typeof detail === "string" ? `: ${detail}` : "."}`,
      );
    }

    const message = body?.choices?.[0]?.message;
    if (!message) {
      throw new HttpError(502, "invalid_provider_response", "The LLM provider returned no message.");
    }
    return {
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
      ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
    };
  };
}
