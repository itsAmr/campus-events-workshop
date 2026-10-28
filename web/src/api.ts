// The web app is a client of the public v1 contract. Vite proxies /api to the
// REST API (port 3001) and /chat to the chat host (port 3003).
export const API_BASE = "/api/v1";

export type CampusEvent = {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  meetingUrl?: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  rsvpCount: number;
  availableSpots: number;
  isAttending?: boolean;
};

export type NewEvent = {
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt?: string;
  endsAt?: string;
  capacity: number;
};

export type EventFilters = {
  q?: string;
  category?: string;
  from?: string;
  to?: string;
  email?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetcher(path, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(`Could not reach ${path}. Is npm run dev running?`, 0);
  }

  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => undefined);
  if (response.ok) {
    return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
  }

  const error = body?.error ?? {};
  const details = error.details ?? {};
  let message: string = error.message ?? `Request failed (${response.status})`;
  if (response.status === 501) {
    message = `Not implemented yet: ${method} ${path.split("?")[0]} — ${message}`;
    if (details.sourcePath) message += ` (${details.sourcePath})`;
  }
  if (Array.isArray(details.missing)) {
    message += ` Missing: ${details.missing.join(", ")}.`;
  }
  throw new ApiError(message, response.status, details.fields ?? {});
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function eventsUrl(filters: EventFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value?.trim()) params.set(key, value.trim());
  }
  const query = params.toString();
  return `${API_BASE}/events${query ? `?${query}` : ""}`;
}

export const listEvents = (filters: EventFilters) =>
  request<CampusEvent[]>(eventsUrl(filters));

export const listCategories = () => request<string[]>(`${API_BASE}/categories`);

export const createEvent = (event: NewEvent) =>
  request<CampusEvent>(`${API_BASE}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });

export const rsvp = (eventId: number, email: string) =>
  request(`${API_BASE}/events/${eventId}/rsvps`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const cancelRsvp = (eventId: number, email: string) =>
  request(`${API_BASE}/events/${eventId}/rsvps/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });

// Chat host contract (chat/src/types.ts). The browser keeps the conversation
// and sends it back on every turn; the host never trusts it for approvals.
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type WireMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

export type PendingApproval = {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  reason: string;
};

export type ChatResult = {
  messages: WireMessage[];
  tools: Array<{ name: string; description: string; readOnly: boolean }>;
  pendingApproval: PendingApproval | null;
};

export type Identity = { name: string; email: string };

export const sendChat = (input: {
  messages: WireMessage[];
  user: Identity;
  approval?: PendingApproval & { allowed: boolean };
}) =>
  request<ChatResult>("/chat", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      approval: input.approval && {
        callId: input.approval.callId,
        name: input.approval.name,
        args: input.approval.args,
        allowed: input.approval.allowed,
      },
    }),
  });
