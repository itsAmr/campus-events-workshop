import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Identity,
  PendingApproval,
  WireMessage,
  errorMessage,
  sendChat,
} from "./api";

export type TranscriptItem =
  | { kind: "user" | "assistant"; text: string }
  | { kind: "tool"; name: string; args: string; result?: string };

// Rebuilds a readable transcript from the OpenAI-style wire messages, pairing
// each tool call with the tool message that answered it.
export function toTranscript(messages: WireMessage[]): TranscriptItem[] {
  const results = new Map<string, string>();
  for (const message of messages) {
    if (message.role === "tool") results.set(message.tool_call_id, message.content);
  }

  return messages.flatMap((message): TranscriptItem[] => {
    if (message.role === "user") return [{ kind: "user", text: message.content }];
    if (message.role === "tool") return [];
    const text: TranscriptItem[] = message.content
      ? [{ kind: "assistant", text: message.content }]
      : [];
    const calls: TranscriptItem[] = (message.tool_calls ?? []).map((call) => ({
      kind: "tool",
      name: call.function.name,
      args: call.function.arguments,
      result: results.get(call.id),
    }));
    return [...text, ...calls];
  });
}

function pretty(raw: string): string {
  try {
    const value = JSON.parse(raw);
    const shown = value?.structuredContent ?? value;
    return JSON.stringify(shown, null, 2);
  } catch {
    return raw;
  }
}

export function Chat({ identity }: { identity: Identity }) {
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, approval, busy, error]);

  async function run(
    next: WireMessage[],
    decision?: PendingApproval & { allowed: boolean },
  ): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const result = await sendChat({ messages: next, user: identity, approval: decision });
      setMessages(result.messages);
      setTools(result.tools.map((tool) => tool.name));
      setApproval(result.pendingApproval);
      const last = result.messages.at(-1);
      if (last?.role === "assistant" && !last.content?.trim() && !last.tool_calls?.length) {
        setError("The model returned an empty reply. Try asking again.");
      }
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const previous = messages;
    const next: WireMessage[] = [...previous, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    if (!(await run(next))) {
      setMessages(previous);
      setDraft(text);
    }
  }

  async function decide(allowed: boolean) {
    if (!approval) return;
    const pending = approval;
    setApproval(null);
    if (!(await run(messages, { ...pending, allowed }))) setApproval(pending);
  }

  return (
    <aside className="chat">
      <article>
        <header>
          <strong>Campus assistant</strong>
          {tools.length > 0 && (
            <>
              <br />
              <small>MCP tools: {tools.join(", ")}</small>
            </>
          )}
        </header>

        <div className="transcript" ref={transcriptRef} aria-live="polite">
          {messages.length === 0 && (
            <p>
              <small>Try “What tech events are happening this week?”</small>
            </p>
          )}
          {toTranscript(messages).map((item, index) =>
            item.kind === "tool" ? (
              <details key={index}>
                <summary>
                  Tool: {item.name}
                  {item.result === undefined && " (waiting)"}
                </summary>
                <pre>{pretty(item.args)}</pre>
                {item.result !== undefined && <pre>{pretty(item.result)}</pre>}
              </details>
            ) : (
              <p key={index} className={`message ${item.kind}`}>
                {item.text}
              </p>
            ),
          )}
          {approval && (
            <div className="approval">
              <p>
                <strong>Allow {approval.name}?</strong>
                <br />
                <small>{approval.reason}</small>
              </p>
              <pre>{JSON.stringify(approval.args, null, 2)}</pre>
              <div className="grid">
                <button className="secondary" disabled={busy} onClick={() => decide(false)}>
                  Deny
                </button>
                <button disabled={busy} onClick={() => decide(true)}>
                  Allow
                </button>
              </div>
            </div>
          )}
          {busy && <p aria-busy="true">Thinking…</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <form onSubmit={submit}>
          <fieldset role="group">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={approval ? "Allow or deny the request first" : "Ask about events…"}
              aria-label="Message the campus assistant"
              disabled={Boolean(approval)}
            />
            <button disabled={!draft.trim() || busy || Boolean(approval)}>Send</button>
          </fieldset>
        </form>
      </article>
    </aside>
  );
}
