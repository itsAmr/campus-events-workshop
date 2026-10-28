# Setup Checklist

Complete this before the workshop. Bring a screenshot or copy of any error you cannot resolve, but never include your API key.

## 1. Install prerequisites

- [ ] Node.js reports version 24: `node --version`
- [ ] npm runs: `npm --version`
- [ ] Git runs: `git --version`
- [ ] curl runs: `curl --version` (`curl.exe --version` if needed on Windows)
- [ ] A current browser and editor are installed
- [ ] Docker is **not** required

## 2. Prepare a Gemini key

- [ ] Create a free key in [Google AI Studio](https://aistudio.google.com/app/apikey)
- [ ] Prefer a workshop-only key/project
- [ ] Store it privately; do not paste it into Slack, email, screenshots, issues, or commits
- [ ] Agree to use only fictional workshop data, never personal or confidential data
- [ ] Know how to return to AI Studio and revoke the key after class

Free-tier limits and provider terms may change. The workshop cannot guarantee free quota.

## 3. Get the repository

```bash
git clone <workshop-repository-url>
cd campus-events-workshop
git branch --all
npm install
```

- [ ] Clone completes without authentication errors
- [ ] `npm install` is run once from the repository root
- [ ] Expected `web/`, `api/`, `mcp/`, and `chat/` workspaces exist
- [ ] Checkpoint branches announced by the facilitator appear

Do not use `sudo npm install`.

## 4. Configure the environment

macOS, Linux, or Git Bash:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your key to `.env`:

```dotenv
LLM_API_KEY=your_key_here
```

- [ ] Keep every other supplied default, including the configured Gemini model
- [ ] Confirm `.env` is ignored by Git: `git status --short`
- [ ] If `.env` appears as an untracked file, stop and tell the facilitator before continuing

## 5. Run diagnostics

```bash
npm run doctor
```

- [ ] Node 24 passes
- [ ] Workspace checks pass
- [ ] Required environment variables pass
- [ ] Local ports are available
- [ ] SQLite can initialize

The expected workshop defaults are React `5173`, REST API `3001`, MCP Streamable HTTP `3002`, and chat `3003`. Verify these against the final starter output.

## 6. Start the workshop

```bash
npm run dev
```

In another terminal:

```bash
curl -i http://localhost:3001/health
```

- [ ] Health returns HTTP `200`
- [ ] `http://localhost:5173` opens and shows campus events
- [ ] The chat UI loads without exposing your key
- [ ] Stopping the root command stops all local services

## Platform notes

### Windows

- [ ] Use PowerShell 7 or Git Bash
- [ ] Try `curl.exe` if `curl` invokes a PowerShell alias
- [ ] Keep the clone outside OneDrive if SQLite locking occurs
- [ ] Do not globally disable PowerShell security policy to run the workshop

### macOS

- [ ] Open a fresh terminal after installing Node
- [ ] Use a Node version manager if npm reports permissions errors; do not use `sudo`
- [ ] Local services only need loopback access

### GitHub Codespaces

- [ ] Create the Codespace early enough to finish `npm install`
- [ ] Put `LLM_API_KEY` in Codespaces secrets or only in the Codespace `.env`
- [ ] Forward ports 5173, 3001, 3002, and 3003
- [ ] Open the forwarded web URL and keep service ports private
- [ ] Confirm account quota and institution policy allow Codespaces and Gemini

## If setup fails

Capture these **without secrets**:

```bash
node --version
npm --version
git status --short
npm run doctor
```

Send the facilitator:

- operating system and terminal;
- the failing command;
- complete error text with keys/tokens removed; and
- whether local setup or Codespaces is being used.

Do not delete the SQLite database, change ports, switch checkpoint branches, or rotate package versions unless the facilitator asks. These changes can hide the original problem.
