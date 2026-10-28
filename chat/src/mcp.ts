import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import { HttpError } from "./errors.js";
import type { JsonObject, McpTool } from "./types.js";

export interface McpSession {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: JsonObject): Promise<unknown>;
  close(): Promise<void>;
}

export async function connectMcp(url: string): Promise<McpSession> {
  const client = new Client({
    name: "campus-events-chat",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(url));

  try {
    await client.connect(transport);
  } catch (error) {
    try {
      await client.close();
    } catch {
      // Preserve the connection error.
    }
    throw new HttpError(
      502,
      "mcp_unavailable",
      "Could not connect to the MCP server.",
      error instanceof Error ? error.message : String(error),
    );
  }

  return {
    async listTools() {
      try {
        const response = await client.listTools();
        return response.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as JsonObject,
          annotations: tool.annotations,
        }));
      } catch (error) {
        throw new HttpError(
          502,
          "mcp_unavailable",
          "Could not list tools from the MCP server.",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    async callTool(name, args) {
      return client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
    },
  };
}
