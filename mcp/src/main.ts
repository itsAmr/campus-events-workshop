import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { createCampusMcpServer } from "./server.js";

const host = "127.0.0.1";
const port = 3002;
const apiUrl = process.env.CAMPUS_API_URL ?? "http://127.0.0.1:3001";

const app = createMcpExpressApp({ host });
app.get("/health", (_request, response) => {
  response.json({ data: { status: "ok" } });
});
const mcpHandler = createMcpHandler(() =>
  createCampusMcpServer({ baseUrl: apiUrl }),
);
const nodeHandler = toNodeHandler(mcpHandler, {
  onerror: (error) => console.error("MCP HTTP adapter error", error),
});

app.all("/mcp", async (request, response, next) => {
  try {
    await nodeHandler(request, response, request.body);
  } catch (error) {
    next(error);
  }
});

const httpServer = app.listen(port, host, () => {
  console.log(`Campus events MCP server listening at http://${host}:${port}/mcp`);
});

async function shutdown(): Promise<void> {
  await mcpHandler.close();
  httpServer.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
