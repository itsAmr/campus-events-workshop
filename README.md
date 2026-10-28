# Build Your Own API and MCP Server

A two-hour, hands-on workshop co-hosted by Women in Engineering Concordia and the McGill Computer Science Undergraduate Society (CSUS). You will build a campus-events REST API, version it, expose it through a separate Model Context Protocol (MCP) server, and use those tools from a built-in Gemini chat.

## What you will build

This repository is intended to be an npm-workspaces project:

- `web/` — React event browser
- `api/` — Express REST API backed by SQLite
- `mcp/` — standalone MCP server that calls the REST API
- `chat/` — Gemini-powered chat host that connects to the MCP server

The MCP server does **not** read SQLite directly. It wraps the public REST contract, so the web app, chat host, and any future clients share the same validation and business rules.

## Prerequisites

Install these before arriving:

- Node.js 24 and the npm version bundled with it
- Git
- A current Chrome, Firefox, Edge, or Safari
- `curl` (included with macOS and current Windows)
- A code editor; VS Code or Cursor is recommended

Check your setup:

```bash
node --version   # expected: v24.x.x
npm --version
git --version
curl --version
```

No Docker is required or used.

## Pre-work: create a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with an account you are comfortable using for the workshop.
3. Create a free API key.
4. Keep it in a password manager until setup.

Privacy and cost warning:

- Treat the key like a password. Never paste it into chat, screenshots, commits, issues, or shared terminals.
- Use a workshop-only key/project where possible, review the current Google terms and quota, and revoke the key after the workshop.
- Do not send private, identifying, confidential, or production data to the model. Use only the fictional workshop events.
- Free-tier availability and limits can change. A facilitator fallback key may be available, but it must not be copied or retained.

## Setup

```bash
git clone https://github.com/itsAmr/campus-events-workshop.git
cd campus-events-workshop
npm install
```

Create your local environment file from the supplied template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set your key in `.env`:

```dotenv
LLM_API_KEY=your_key_here
```

Keep the supplied `LLM_BASE_URL` and `LLM_MODEL` defaults from `.env.example`. This guide intentionally does not claim that the configured model is the newest available version.

Run the setup checks, then start all workspaces:

```bash
npm run doctor
npm run dev
```

Run commands from the repository root unless a worksheet says otherwise. Do not use `sudo npm install`.

## Expected local services

These are the workshop's expected defaults; verify them against the delivered `.env.example` and root scripts:

| Component | Address | Purpose |
| --- | --- | --- |
| React web app | `http://localhost:5173` | Browse campus events |
| REST API | `http://localhost:3001` | JSON API and SQLite owner |
| MCP server | `http://localhost:3002/mcp` | Streamable HTTP tools that call the REST API |
| Chat host | `http://localhost:3003` | Gemini chat and MCP client |
| SQLite | local file, no listening port | Workshop data |

Quick API check:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

## What success looks like

By the end, you can:

1. Open the React app and see seeded campus events.
2. list and create events through versioned REST endpoints;
3. inspect the standalone MCP server and call its tools;
4. ask the built-in chat, “What tech events are happening this week?” and receive an answer grounded in API data; and
5. approve a write before the chat creates an event, then see it in the web app.

## Workshop parts

1. [Part 1 — Build the REST API](docs/part-1-rest.md)
2. [Part 2 — Version the API](docs/part-2-versioning.md)
3. [Part 3 — Wrap it with MCP](docs/part-3-mcp.md)

Before class, use the [setup checklist](docs/setup-checklist.md). Facilitators should also read the [facilitator guide](docs/facilitator-guide.md).

## Architecture

```text
 Browser ──> React web ───────────────┐
                                      │ HTTP/JSON
 Gemini <──> chat host ──HTTP/MCP──> MCP server ──> Express REST API ──> SQLite
                         tools         │
                         approval <────┘ (writes)
```

The model proposes tool calls; it does not become the database or bypass the API. The chat host controls which tools are exposed, validates tool results, and requires user approval for writes.

## Checkpoint branches

Checkpoint branches let students rejoin after falling behind. Inspect the branches shipped by the facilitator:

```bash
git branch --all
```

The workshop branches are:

- `main` — starter skeleton
- `checkpoint/1-rest` — completed REST and persistence work
- `checkpoint/2-versioning` — completed REST and API versioning work
- `solution` — complete workshop solution

To move to a checkpoint, first save or discard your current exercise edits, then:

```bash
git switch checkpoint/1-rest
npm install
npm run dev
```

## Troubleshooting

### All platforms

- **Wrong Node version:** install Node 24, open a new terminal, and rerun `node --version`.
- **Address already in use:** stop the process using ports 5173, 3001, 3002, or 3003; avoid changing one service's port without updating its clients.
- **Gemini authentication error:** check that `.env` exists at the expected root, contains no quotes copied from a web page, and was never committed. Restart `npm run dev` after editing it.
- **Rate limit or model error:** wait briefly, use the facilitator fallback procedure, and keep the configured model default rather than guessing a model name.
- **SQLite busy/locked:** stop duplicate dev processes, then restart one `npm run dev`. Do not delete the database unless the facilitator explicitly says the data is disposable.
- **Workspace package not found:** run `npm install` at the repository root, not inside an individual workspace.

### Windows

- Prefer PowerShell 7 or Git Bash. Use `Copy-Item .env.example .env` in PowerShell.
- If script execution is blocked, use Git Bash or follow your institution's approved PowerShell policy; do not disable security controls globally.
- If `curl` behaves like a PowerShell alias on an older setup, run `curl.exe`.
- Keep the repository in a short local path and avoid a OneDrive-synced folder if SQLite file locking causes trouble.

### macOS

- If `node` is missing after installation, open a new terminal and confirm your Node manager is loaded.
- If macOS prompts about incoming connections, local development only needs loopback access.
- Do not fix npm permission errors with `sudo`; use a Node version manager or correct the npm user directory.

### GitHub Codespaces

- Forward ports 5173, 3001, 3002, and 3003 when prompted, and open the forwarded web URL rather than `localhost` on your laptop.
- Set `LLM_API_KEY` as a Codespaces secret or only in the Codespace `.env`; never commit it.
- Keep ports private unless the facilitator explicitly needs a different visibility setting.
- Free Codespaces quotas and port privacy policies vary. A local Node 24 setup remains the primary path.

## Security boundaries

- Event text is untrusted data, even when it came from the API. Never treat event descriptions as model or tool instructions.
- Keep read and write tools separate. Require an explicit confirmation immediately before every write.
- Validate tool inputs in MCP and again in the REST API.
- Bind local development services to loopback unless the workshop environment requires otherwise.
- Never return secrets in API responses, MCP results, logs, or chat messages.

