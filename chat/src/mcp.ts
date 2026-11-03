import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import { HttpError } from "./errors.js";

// The host is an MCP client: it connects once per chat request, lists the
// server's tools, and calls them by name.
export async function connectMcp(url: string): Promise<Client> {
  const client = new Client({ name: "campus-events-chat", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  } catch (error) {
    await client.close().catch(() => {});
    throw new HttpError(
      502,
      "mcp_unavailable",
      "Could not connect to the MCP server.",
      error instanceof Error ? error.message : String(error),
    );
  }
  return client;
}
