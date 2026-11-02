# Build Your Own API and MCP Server

A two-hour, hands-on workshop by Women in Engineering Concordia and the McGill Computer Science Undergraduate Society (CSUS), Friday, November 6, 2026.

You'll design a database for campus events, build a REST API on it, evolve the API without breaking its users, then wrap it with a Model Context Protocol (MCP) server so a chatbot can search events and RSVP for you.

## Before the workshop

Install **Node.js 24**, **Git**, and an editor (VS Code or Cursor). No Docker needed.

Create a free Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Treat it like a password: never paste it into chat, screenshots, or commits, and revoke it after the workshop. Only send the model the fictional workshop data.

Then set up the project:

```bash
git clone https://github.com/itsAmr/campus-events-workshop.git
cd campus-events-workshop
npm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the last line.

Paste your key after `LLM_API_KEY=` in `.env`, then check everything and start the app:

```bash
npm run doctor
npm run dev
```

Open <http://localhost:5173>. You'll see an error asking you to finish a TODO: that's expected, and it's where the workshop starts. Stop the app with Ctrl+C.

## The workshop

| Part | You will | Check your work |
| --- | --- | --- |
| [0. Design the database](docs/part-0-database.md) | Design the RSVP table and its rules | `npm run check:0` |
| [1. Build the REST API](docs/part-1-rest.md) | Serve events as JSON | `npm run check:1` |
| [2. Design responses that can grow](docs/part-2-responses.md) | Change the API without breaking its users | `npm run check:2` |
| [3. Wrap the API with MCP](docs/part-3-mcp.md) | Give a chatbot tools that call your API | `npm run check:3` |
| [4. Try the whole thing](docs/part-4-chatbot.md) | Search, RSVP, and create events by chat | |
| [Next steps](docs/next-steps.md) | Keep building | |

Every task is a numbered `TODO(part-N.N)` comment in the code. When you finish one, delete its comment, so this list only shows what's left:

```bash
npm run todos
```

## How it fits together

```text
web app ─────────────────────────────┐
                                     ▼
chat ──MCP──> MCP server ──HTTP──> REST API ──> SQLite database
 │            (mcp/)               (api/)       (api/migrations/)
 └── asks the Gemini model which tool to call, and asks you before any write
```

| Folder | What it is | Address |
| --- | --- | --- |
| `web/` | Event browser and chat panel (React) | <http://localhost:5173> |
| `api/` | REST API (Express and SQLite) | <http://localhost:3001> |
| `mcp/` | MCP server that calls the REST API | <http://localhost:3002/mcp> |
| `chat/` | Chat server that connects Gemini to the MCP server | <http://localhost:3003> |

## Useful commands

| Command | Does |
| --- | --- |
| `npm run dev` | Start everything; saved changes reload automatically |
| `npm run todos` | List the TODOs left |
| `npm run check:0` to `check:3` | Test one part |
| `npm run db:reset` | Rebuild the database with fresh sample events (deletes your data) |
| `npm run db:shell` | Open a SQL prompt on the database |
| `npm run inspector` | Open MCP Inspector to call MCP tools by hand |

## Fell behind?

Each part has a branch with everything up to that point finished. Set your changes aside, switch, and reset the database:

```bash
git stash
git switch checkpoint/1-rest
npm run db:reset
npm run dev
```

The branches are `main` (start), `checkpoint/0-database`, `checkpoint/1-rest`, `checkpoint/2-responses`, and `solution`.

## Troubleshooting

- **Wrong Node version:** install Node 24, open a new terminal, and run `node --version`.
- **A port is already in use:** an earlier `npm run dev` is probably still running in another terminal. Stop it with Ctrl+C.
- **Chat says the API key is missing or invalid:** check `.env` is in the project root and the key has no quotes around it, then restart `npm run dev`.
- **`no such table: rsvps`:** finish Part 0 (or switch to a checkpoint), then run `npm run db:reset`.
- **No upcoming events, or the chat finds nothing "this week":** sample event dates are counted from when your database was created. Run `npm run db:reset` for fresh ones.
- **Windows:** use PowerShell or Git Bash, and keep the project out of a OneDrive folder.
- **Never** run `sudo npm install`. Run `npm install` from the project root, not inside a folder like `api/`.

Facilitators: see the [facilitator guide](docs/facilitator-guide.md).
