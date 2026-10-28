# Chat service

TypeScript Express host for an OpenAI-compatible chat-completions provider and
an MCP v2 Streamable HTTP server.

## Run

Set `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. `MCP_URL` defaults to
`http://127.0.0.1:3002/mcp`.

```sh
npm install
npm run dev
```

The service binds to `127.0.0.1:3003`. POST to `/api/chat` (or `/chat`):

```json
{
  "messages": [{ "role": "user", "content": "What events are today?" }],
  "user": { "id": "u-123", "name": "Ada", "email": "ada@example.com" }
}
```

Responses contain the full browser-resubmittable `messages`,
`assistantMessages`, `toolTrace`, discovered `tools`, and `pendingApproval`.
When `pendingApproval` is non-null, show it to the user and resubmit the
returned `messages` with the exact decision:

```json
{
  "messages": ["the response messages go here"],
  "user": { "id": "u-123", "name": "Ada" },
  "approval": {
    "callId": "call_123",
    "name": "create_event",
    "args": { "title": "Workshop" },
    "allowed": true
  }
}
```

The API key remains server-side. Tools without an explicit
`annotations.readOnlyHint: true` require approval.
