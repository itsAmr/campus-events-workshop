import type { CallToolResult } from "@modelcontextprotocol/server";

// A small client for the REST API you built. The MCP server never opens the
// database; it calls the same routes as the web app.

export interface CampusApiOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
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
      const code = json?.error?.code ?? `HTTP_${response.status}`;
      throw new Error(`${code}: ${json?.error?.message ?? `${method} ${path} failed`}`);
    }
    if (json === undefined || !("data" in json)) {
      throw new Error(`UNEXPECTED_RESPONSE: ${method} ${path} should reply with { data: ... }`);
    }
    return json.data;
  }

  return {
    // Query values that are undefined are left out, so optional filters can be passed as they are.
    get(path: string, query: Record<string, string | undefined> = {}) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) search.set(key, value);
      }
      return call("GET", search.size > 0 ? `${path}?${search}` : path);
    },
    post: (path: string, body: unknown) => call("POST", path, body),
  };
}

// What a tool sends back to the model: its result as JSON text. When a handler
// throws instead, MCP sends the error message, so the model can explain it.
export function reply(result: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}

// Unfinished starter TODOs call this, so the model can tell the user which TODO is left.
export function notImplemented(todo: string): never {
  throw new Error(`NOT_IMPLEMENTED: Finish TODO(part-${todo}) in mcp/src/server.ts`);
}
