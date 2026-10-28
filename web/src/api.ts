export const API_BASE = "/api/v1";

export type Identity = {
  name: string;
  email: string;
};

export type CampusEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  capacity: number;
  attendeeCount: number;
  isAttending: boolean;
};

export type CreateEventInput = {
  title: string;
  description: string;
  category: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  capacity: number;
};

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;
  details: unknown;

  constructor(
    message: string,
    status: number,
    fieldErrors: FieldErrors = {},
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(
  record: UnknownRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) {
      return record[key] as string;
    }
  }
  return undefined;
}

function firstNumber(record: UnknownRecord, ...keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function firstBoolean(record: UnknownRecord, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function normalizeFieldErrors(body: unknown): FieldErrors {
  if (!isRecord(body)) return {};
  const candidate = body.fieldErrors ?? body.errors;
  if (!isRecord(candidate)) return {};

  return Object.fromEntries(
    Object.entries(candidate).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, value]];
      if (Array.isArray(value)) {
        const message = value.find((item) => typeof item === "string");
        return message ? [[key, message]] : [];
      }
      if (isRecord(value) && typeof value.message === "string") {
        return [[key, value.message]];
      }
      return [];
    }),
  );
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(
  endpoint: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetcher(endpoint, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await readBody(response);

  if (!response.ok) {
    const errorBody =
      isRecord(body) && isRecord(body.error)
        ? body.error
        : isRecord(body) && isRecord(body.data)
          ? body.data
          : body;
    const record = isRecord(errorBody) ? errorBody : {};
    const details = isRecord(record.details) ? record.details : {};
    const sourceRecord = isRecord(record.source) ? record.source : {};
    const source =
      firstString(record, "sourcePath", "source_path", "path") ||
      firstString(sourceRecord, "path", "file", "sourcePath", "source_path") ||
      (typeof record.source === "string" ? record.source : undefined);
    const message =
      response.status === 501
        ? `Not implemented yet: ${method} ${endpoint}${source ? ` (${source})` : ""}`
        : firstString(record, "message", "error", "detail") ||
          (typeof body === "string" && body) ||
          `Request failed (${response.status})`;
    throw new ApiError(
      message,
      response.status,
      normalizeFieldErrors({
        ...record,
        errors: details.fields ?? record.errors,
      }),
      body,
    );
  }

  if (isRecord(body) && "data" in body) return body.data as T;
  return body as T;
}

export function normalizeEvent(value: unknown): CampusEvent {
  const event = isRecord(value) ? value : {};
  const attendees = Array.isArray(event.attendees) ? event.attendees.length : 0;
  return {
    id: String(event.id ?? event.eventId ?? event.event_id ?? ""),
    title: firstString(event, "title", "name") ?? "Untitled event",
    description: firstString(event, "description", "details") ?? "",
    category: firstString(event, "category", "type") ?? "Other",
    location: firstString(event, "location", "venue") ?? "Location TBA",
    startsAt:
      firstString(event, "startsAt", "starts_at", "startTime", "start_time") ?? "",
    endsAt: firstString(event, "endsAt", "ends_at", "endTime", "end_time"),
    capacity: firstNumber(event, "capacity", "maxAttendees", "max_attendees"),
    attendeeCount:
      firstNumber(
        event,
        "attendeeCount",
        "attendee_count",
        "rsvpCount",
        "rsvp_count",
      ) || attendees,
    isAttending: firstBoolean(
      event,
      "isAttending",
      "is_attending",
      "rsvped",
      "isRsvped",
    ),
  };
}

export async function getEvents(email?: string): Promise<CampusEvent[]> {
  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  const payload = await request<unknown>(`${API_BASE}/events${query}`);
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.events)
      ? payload.events
      : [];
  return list.map(normalizeEvent);
}

export async function createEvent(
  input: CreateEventInput,
  _identity: Identity,
): Promise<CampusEvent> {
  const payload = await request<unknown>(`${API_BASE}/events`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeEvent(payload);
}

export async function rsvpToEvent(
  eventId: string,
  identity: Identity,
): Promise<void> {
  await request(`${API_BASE}/events/${encodeURIComponent(eventId)}/rsvps`, {
    method: "POST",
    body: JSON.stringify({ email: identity.email }),
  });
}

export async function cancelRsvp(
  eventId: string,
  identity: Identity,
): Promise<void> {
  await request(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/rsvps/${encodeURIComponent(identity.email)}`,
    {
    method: "DELETE",
    },
  );
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ToolTrace = {
  id: string;
  name: string;
  status?: string;
  args?: unknown;
  result?: unknown;
};

export type ApprovalRequest = {
  id: string;
  tool: string;
  args?: unknown;
  message?: string;
};

export type ChatResponse = {
  message: string;
  tools: string[];
  traces: ToolTrace[];
  approval?: ApprovalRequest;
  wireMessages: unknown[];
};

export type ChatRequest = {
  messages: unknown[];
  user: Identity;
  approval?: {
    callId: string;
    name: string;
    args: Record<string, unknown>;
    allowed: boolean;
  };
};

function normalizeTrace(value: unknown, index: number): ToolTrace {
  const trace = isRecord(value) ? value : {};
  return {
    id: String(trace.id ?? trace.callId ?? trace.call_id ?? index),
    name: firstString(trace, "name", "tool", "toolName", "tool_name") ?? "Tool",
    status: firstString(trace, "status", "state"),
    args: trace.args ?? trace.arguments ?? trace.input,
    result: trace.result ?? trace.output ?? trace.response,
  };
}

export async function sendChat(input: ChatRequest): Promise<ChatResponse> {
  const payload = await request<unknown>("/chat", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = isRecord(payload) ? payload : {};
  const assistantMessages = Array.isArray(data.assistantMessages)
    ? data.assistantMessages
    : [];
  const lastAssistant = assistantMessages.at(-1);
  const rawMessage =
    data.message ??
    data.assistant ??
    data.content ??
    (isRecord(lastAssistant) ? lastAssistant.content : undefined);
  const message =
    typeof rawMessage === "string"
      ? rawMessage
      : isRecord(rawMessage) && typeof rawMessage.content === "string"
        ? rawMessage.content
        : "";
  const rawTools = data.tools ?? data.discoveredTools ?? data.discovered_tools;
  const rawTraces =
    data.traces ?? data.toolTrace ?? data.toolTraces ?? data.tool_calls;
  const rawApproval =
    data.pendingApproval ?? data.pending_approval ?? data.approval;
  const approval = isRecord(rawApproval)
    ? {
        id: String(rawApproval.id ?? rawApproval.callId ?? rawApproval.call_id ?? ""),
        tool:
          firstString(rawApproval, "tool", "name", "toolName", "tool_name") ??
          "requested action",
        args: rawApproval.args ?? rawApproval.arguments ?? rawApproval.input,
        message: firstString(rawApproval, "message", "reason", "description"),
      }
    : undefined;

  return {
    message,
    tools: Array.isArray(rawTools)
      ? rawTools.map((tool) =>
          typeof tool === "string"
            ? tool
            : isRecord(tool)
              ? firstString(tool, "name", "tool") ?? "Tool"
              : "Tool",
        )
      : [],
    traces: Array.isArray(rawTraces)
      ? rawTraces.map(normalizeTrace)
      : [],
    approval,
    wireMessages: Array.isArray(data.messages) ? data.messages : input.messages,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const lowerMessage = error.message.toLowerCase();
    if (error.status === 401 || error.status === 403) {
      return "The assistant could not authenticate. Check the API key for the chat service and try again.";
    }
    if (
      error.status === 502 ||
      error.status === 503 ||
      lowerMessage.includes("mcp") ||
      lowerMessage.includes("tool server")
    ) {
      return "The assistant cannot reach its MCP tools right now. Make sure the MCP services are running, then retry.";
    }
    if (lowerMessage.includes("api key") || lowerMessage.includes("authentication")) {
      return "The assistant is missing a valid API key. Configure the chat service key and try again.";
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Could not reach the service. Check that the local API is running.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
