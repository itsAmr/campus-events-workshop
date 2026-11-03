# Chat host

The AI host behind the web app's chat panel. It talks to the model (Gemini by
default) and to the MCP server, and it decides which tool calls actually run.
The API key stays here, on the server; the browser and the model never see it.

It starts with everything else when you run `npm run dev` from the repo root,
and reads its settings from the root `.env` (see `.env.example`).

## What happens to one message

1. The browser POSTs the whole conversation to `/chat`. The host keeps nothing
   between requests.
2. The host connects to the MCP server, lists its tools, and sends the
   conversation and the tool list to the model.
3. If the model asks for a tool, the host checks it:
   - a tool that isn't on the list is refused;
   - a tool marked `readOnlyHint: true` runs right away;
   - any other tool pauses, and the host returns `pendingApproval` for the
     user to Allow or Deny. The browser sends that exact call back with the
     decision, and the host refuses an approval that doesn't match.
4. Tool results go back to the model, and steps 3 and 4 repeat until it answers
   in words, or for at most 6 rounds.
5. The host returns `{ messages, tools, pendingApproval }`, and the browser
   keeps `messages` for the next turn.

`src/agent.ts` has steps 3 and 4, `src/server.ts` has the route, and
`test/agent.test.ts` checks each rule above.
