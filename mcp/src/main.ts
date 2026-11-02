import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { createCampusMcpServer } from "./server.js";

// Serves the tools from server.ts over HTTP, so chat apps can connect to
// http://127.0.0.1:3002/mcp.
const host = "127.0.0.1";
const port = 3002;
const apiUrl = process.env.CAMPUS_API_URL ?? "http://127.0.0.1:3001";

const app = createMcpExpressApp({ host });
const mcpHandler = toNodeHandler(
  createMcpHandler(() => createCampusMcpServer(apiUrl)),
  { onerror: (error) => console.error("MCP request failed", error) },
);

app.all("/mcp", (request, response) => mcpHandler(request, response, request.body));

app.listen(port, host, (error) => {
  if (error) {
    console.error(
      `Could not start the MCP server on port ${port}: ${error.message}. Another program may be using the port; run "npm run doctor" to check.`,
    );
    process.exit(1);
  }
  console.log(`Campus events MCP server listening at http://${host}:${port}/mcp`);
});
