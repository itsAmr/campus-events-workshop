import net from "node:net";

const requiredNode = [22, 19, 0];
const ports = [3001, 3002, 3003, 5173];
let failed = false;

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

function versionAtLeast(current, required) {
  const parts = current.split(".").map(Number);
  for (const [index, value] of required.entries()) {
    if (parts[index] > value) {
      return true;
    }
    if (parts[index] < value) {
      return false;
    }
  }
  return true;
}

async function check(label, operation) {
  try {
    await operation();
    console.log(`✓ ${label}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${label}: ${error.message}`);
  }
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

await check(`Node.js >= ${requiredNode.slice(0, 2).join(".")}`, () => {
  if (!versionAtLeast(process.versions.node, requiredNode)) {
    throw new Error(`found ${process.versions.node}`);
  }
});

await check("node:sqlite is available", async () => {
  await import("node:sqlite");
});

for (const port of ports) {
  await check(`port ${port} is available`, () => assertPortAvailable(port));
}

if (process.env.LLM_API_KEY) {
  await check("LLM responds to a tiny request", async () => {
    const baseUrl = (
      process.env.LLM_BASE_URL
      ?? "https://generativelanguage.googleapis.com/v1beta/openai"
    ).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? "gemini-3.1-flash-lite",
        messages: [{ role: "user", content: "Reply OK." }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Gemini wraps errors in an array; OpenAI-style providers use an object.
      const body = await response.json().catch(() => null);
      const detail = (Array.isArray(body) ? body[0] : body)?.error?.message;
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
  });
} else {
  console.log("− LLM check skipped (LLM_API_KEY is not set)");
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Doctor checks passed.");
}
