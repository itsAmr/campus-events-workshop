import type { CallToolResult, JSONValue } from "@modelcontextprotocol/server";

// A tiny client for the REST API from Parts 1 and 2. The MCP server never opens
// the database; it only calls the same endpoints the web app uses.

export interface CampusApiOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class CampusApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createCampusApi(options: CampusApiOptions = {}) {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:3001";
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function call(method: string, path: string, body?: unknown): Promise<any> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { accept: "application/json", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new CampusApiError(
        json?.error?.code ?? `HTTP_${response.status}`,
        json?.error?.message ?? `${method} ${path} failed with HTTP ${response.status}`,
      );
    }
    if (json === undefined || !("data" in json)) {
      throw new CampusApiError("UNEXPECTED_RESPONSE", `${method} ${path} should reply with { data: ... }`);
    }
    return json.data;
  }

  return {
    get: (path: string) => call("GET", path),
    post: (path: string, body: unknown) => call("POST", path, body),
  };
}

// Turns the result of an API call into what MCP sends back to the model: the
// data as JSON, or an error the model can read and explain to the user.
export async function toToolResult(work: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const result = await work();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result as Record<string, JSONValue>,
    };
  } catch (error) {
    const reason =
      error instanceof CampusApiError
        ? { code: error.code, message: error.message }
        : { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(reason) }] };
  }
}
