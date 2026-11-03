import { createLogger } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// While the API or chat host is down, Vite would print a long proxy error on
// every request and bury the real error. Print a short line now and then instead.
const logger = createLogger();
const logError = logger.error.bind(logger);
let lastProxyWarning = 0;
logger.error = (message, options) => {
  if (!message.includes("http proxy error")) return logError(message, options);
  if (Date.now() - lastProxyWarning < 30_000) return;
  lastProxyWarning = Date.now();
  logger.warn("Can't reach the API or chat host. Look for its error above.", { timestamp: true });
};

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/chat": "http://127.0.0.1:3003",
    },
  },
});
