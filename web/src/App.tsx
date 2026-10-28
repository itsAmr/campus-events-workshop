import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  ApprovalRequest,
  CampusEvent,
  ChatMessage,
  CreateEventInput,
  Identity,
  ToolTrace,
  cancelRsvp,
  createEvent,
  getErrorMessage,
  getEvents,
  rsvpToEvent,
  sendChat,
} from "./api";

const IDENTITY_KEY = "campus-events.identity";
const DEFAULT_IDENTITY: Identity = { name: "", email: "" };
const DEFAULT_CATEGORIES = ["Academic", "Arts", "Community", "Sports", "Social"];

function loadIdentity(): Identity {
  try {
    const value = JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "");
    if (typeof value?.name === "string" && typeof value?.email === "string") {
      return value;
    }
  } catch {
    // A malformed preference should not prevent the app from loading.
  }
  return DEFAULT_IDENTITY;
}

function formatDate(value: string, withYear = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time to be announced";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dateBadge(value: string): { month: string; day: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { month: "TBA", day: "—" };
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" })
      .format(date)
      .toUpperCase(),
    day: String(date.getDate()),
  };
}

function isThisWeek(value: string): boolean {
  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) return false;
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + 7);
  return eventDate >= now && eventDate <= end;
}

function hasIdentity(identity: Identity): boolean {
  return Boolean(identity.name.trim() && identity.email.trim());
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error-notice" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <strong>We hit a snag</strong>
        <p>{getErrorMessage(error)}</p>
      </div>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

function IdentityCard({
  identity,
  setIdentity,
}: {
  identity: Identity;
  setIdentity: (value: Identity) => void;
}) {
  return (
    <section className="identity-card" aria-labelledby="identity-heading">
      <div>
        <p className="eyebrow">Signed in as</p>
        <h2 id="identity-heading">Your campus identity</h2>
      </div>
      <div className="identity-fields">
        <label>
          Name
          <input
            value={identity.name}
            onChange={(event) =>
              setIdentity({ ...identity, name: event.target.value })
            }
            placeholder="Alex Rivera"
            autoComplete="name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={identity.email}
            onChange={(event) =>
              setIdentity({ ...identity, email: event.target.value })
            }
            placeholder="alex@campus.edu"
            autoComplete="email"
          />
        </label>
      </div>
      <p className="identity-help">
        Saved only in this browser and shared with RSVPs and the assistant.
      </p>
    </section>
  );
}

function EventCard({
  event,
  onOpen,
}: {
  event: CampusEvent;
  onOpen: () => void;
}) {
  const badge = dateBadge(event.startsAt);
  const remaining = Math.max(event.capacity - event.attendeeCount, 0);
  const full = event.capacity > 0 && remaining === 0;

  return (
    <article className="event-card">
      <button className="event-card-button" onClick={onOpen}>
        <span className="date-badge" aria-hidden="true">
          <small>{badge.month}</small>
          <strong>{badge.day}</strong>
        </span>
        <span className="event-main">
          <span className="event-topline">
            <span className="category">{event.category}</span>
            {event.isAttending && <span className="attending">You’re going</span>}
          </span>
          <strong className="event-title">{event.title}</strong>
          <span className="event-meta">
            <span>◷ {formatDate(event.startsAt)}</span>
            <span>⌖ {event.location}</span>
          </span>
        </span>
        <span className="capacity" aria-label={`${event.attendeeCount} attendees`}>
          <strong>{event.attendeeCount}</strong>
          <small>
            {event.capacity
              ? full
                ? "full"
                : `${remaining} spots left`
              : "attending"}
          </small>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </article>
  );
}

function EventDetail({
  event,
  identity,
  onClose,
}: {
  event: CampusEvent;
  identity: Identity;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<unknown>();
  const mutation = useMutation({
    mutationFn: () =>
      event.isAttending
        ? cancelRsvp(event.id, identity)
        : rsvpToEvent(event.id, identity),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
    onError: setActionError,
  });
  const identityReady = hasIdentity(identity);

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="detail-body">
        <span className="category">{event.category}</span>
        <div className="detail-facts">
          <p>
            <span aria-hidden="true">◷</span>
            <span>
              <strong>When</strong>
              {formatDate(event.startsAt, true)}
              {event.endsAt ? ` – ${formatDate(event.endsAt, true)}` : ""}
            </span>
          </p>
          <p>
            <span aria-hidden="true">⌖</span>
            <span>
              <strong>Where</strong>
              {event.location}
            </span>
          </p>
          <p>
            <span aria-hidden="true">◎</span>
            <span>
              <strong>Attendance</strong>
              {event.attendeeCount}
              {event.capacity ? ` of ${event.capacity} seats claimed` : " attending"}
            </span>
          </p>
        </div>
        <div className="capacity-meter" aria-hidden="true">
          <span
            style={{
              width: `${
                event.capacity
                  ? Math.min((event.attendeeCount / event.capacity) * 100, 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="description">
          <h3>About this event</h3>
          <p>{event.description || "More details are coming soon."}</p>
        </div>
        {!identityReady && (
          <p className="inline-warning" role="status">
            Add your name and email before reserving a seat.
          </p>
        )}
        {actionError !== undefined && <ErrorNotice error={actionError} />}
      </div>
      <footer className="modal-actions">
        <button className="secondary-button" onClick={onClose}>
          Close
        </button>
        <button
          className={event.isAttending ? "danger-button" : "primary-button"}
          disabled={!identityReady || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "Saving…"
            : event.isAttending
              ? "Cancel RSVP"
              : "Reserve my seat"}
        </button>
      </footer>
    </Modal>
  );
}

function FieldError({ children }: { children?: string }) {
  return children ? <span className="field-error">{children}</span> : null;
}

function CreateEventModal({
  identity,
  onClose,
}: {
  identity: Identity;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    category: "Academic",
    location: "",
    startsAt: "",
    endsAt: "",
    capacity: "30",
    description: "",
  });
  const mutation = useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input, identity),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
  });
  const fields = mutation.error instanceof ApiError ? mutation.error.fieldErrors : {};
  const errorFor = (name: string) =>
    fields[name] ??
    fields[name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
  const update = (name: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      capacity: Number(form.capacity),
    });
  };

  return (
    <Modal title="Create an event" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="full-field">
            Event title
            <input
              required
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              aria-describedby={errorFor("title") ? "title-error" : undefined}
            />
            <span id="title-error">
              <FieldError>{errorFor("title")}</FieldError>
            </span>
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {DEFAULT_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <FieldError>{errorFor("category")}</FieldError>
          </label>
          <label>
            Capacity
            <input
              required
              min="1"
              type="number"
              value={form.capacity}
              onChange={(event) => update("capacity", event.target.value)}
            />
            <FieldError>{errorFor("capacity")}</FieldError>
          </label>
          <label className="full-field">
            Location
            <input
              required
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
            />
            <FieldError>{errorFor("location")}</FieldError>
          </label>
          <label>
            Starts
            <input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => update("startsAt", event.target.value)}
            />
            <FieldError>{errorFor("startsAt")}</FieldError>
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => update("endsAt", event.target.value)}
            />
            <FieldError>{errorFor("endsAt")}</FieldError>
          </label>
          <label className="full-field">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <FieldError>{errorFor("description")}</FieldError>
          </label>
        </div>
        {!hasIdentity(identity) && (
          <p className="inline-warning">Add your identity before creating an event.</p>
        )}
        {mutation.error && <ErrorNotice error={mutation.error} />}
        <footer className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!hasIdentity(identity) || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create event"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function JsonValue({ value }: { value: unknown }) {
  if (value === undefined) return null;
  return <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
}

function ChatPanel({ identity }: { identity: Identity }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I can help you discover events, check availability, and manage your plans.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [traces, setTraces] = useState<ToolTrace[]>([]);
  const [approval, setApproval] = useState<ApprovalRequest>();
  const [wireMessages, setWireMessages] = useState<unknown[]>([]);
  const [chatError, setChatError] = useState<unknown>();
  const endRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({ mutationFn: sendChat });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, traces, approval]);

  const applyResponse = (
    response: Awaited<ReturnType<typeof sendChat>>,
    baseMessages: ChatMessage[],
  ) => {
    if (response.message) {
      setMessages([
        ...baseMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
        },
      ]);
    } else {
      setMessages(baseMessages);
    }
    setTools(response.tools);
    setTraces(response.traces);
    setApproval(response.approval);
    setWireMessages(response.wireMessages);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || mutation.isPending) return;
    setChatError(undefined);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setApproval(undefined);
    try {
      const response = await mutation.mutateAsync({
        messages: [...wireMessages, { role: "user", content }],
        user: identity,
      });
      applyResponse(response, nextMessages);
    } catch (error) {
      setChatError(error);
    }
  };

  const decideApproval = async (decision: "allow" | "deny") => {
    if (!approval || mutation.isPending) return;
    setChatError(undefined);
    const args =
      approval.args !== null &&
      typeof approval.args === "object" &&
      !Array.isArray(approval.args)
        ? (approval.args as Record<string, unknown>)
        : {};
    try {
      const response = await mutation.mutateAsync({
        messages: wireMessages,
        user: identity,
        approval: {
          callId: approval.id,
          name: approval.tool,
          args,
          allowed: decision === "allow",
        },
      });
      applyResponse(response, messages);
    } catch (error) {
      setChatError(error);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <aside className="chat-panel" aria-labelledby="chat-heading">
      <header className="chat-header">
        <div className="assistant-avatar" aria-hidden="true">
          ✦
        </div>
        <div>
          <p className="eyebrow">Campus copilot</p>
          <h2 id="chat-heading">Ask about events</h2>
        </div>
        <span className="online-indicator">Online</span>
      </header>
      {tools.length > 0 && (
        <div className="tool-strip" aria-label="Discovered tools">
          <span>Tools</span>
          {tools.map((tool) => (
            <span className="tool-chip" key={tool}>
              {tool}
            </span>
          ))}
        </div>
      )}
      <div className="chat-scroll" aria-live="polite">
        {messages.map((message) => (
          <div className={`message ${message.role}`} key={message.id}>
            {message.content}
          </div>
        ))}
        {traces.map((trace) => (
          <details className="trace-card" key={trace.id}>
            <summary>
              <span aria-hidden="true">⌘</span>
              {trace.name}
              <small>{trace.status ?? "complete"}</small>
            </summary>
            {trace.args !== undefined && (
              <div>
                <strong>Arguments</strong>
                <JsonValue value={trace.args} />
              </div>
            )}
            {trace.result !== undefined && (
              <div>
                <strong>Result</strong>
                <JsonValue value={trace.result} />
              </div>
            )}
          </details>
        ))}
        {approval && (
          <section className="approval-card" aria-labelledby="approval-heading">
            <p className="eyebrow">Approval required</p>
            <h3 id="approval-heading">{approval.tool}</h3>
            <p>{approval.message ?? "The assistant needs permission to continue."}</p>
            <JsonValue value={approval.args} />
            <div>
              <button
                className="secondary-button"
                disabled={mutation.isPending}
                onClick={() => void decideApproval("deny")}
              >
                Deny
              </button>
              <button
                className="primary-button"
                disabled={mutation.isPending}
                onClick={() => void decideApproval("allow")}
              >
                Allow
              </button>
            </div>
          </section>
        )}
        {mutation.isPending && (
          <div className="typing" aria-label="Assistant is thinking">
            <i />
            <i />
            <i />
          </div>
        )}
        {chatError !== undefined && <ErrorNotice error={chatError} />}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-message">
          Message the campus assistant
        </label>
        <textarea
          id="chat-message"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Ask what’s happening this week…"
        />
        <button
          className="send-button"
          aria-label="Send message"
          disabled={!draft.trim() || mutation.isPending}
        >
          ↑
        </button>
      </form>
      <p className="chat-hint">Enter to send · Shift + Enter for a new line</p>
    </aside>
  );
}

export default function App() {
  const [identity, setIdentityState] = useState<Identity>(loadIdentity);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [range, setRange] = useState<"week" | "all">("week");
  const [selectedEvent, setSelectedEvent] = useState<CampusEvent>();
  const [showCreate, setShowCreate] = useState(false);
  const eventsQuery = useQuery({
    queryKey: ["events", identity.email],
    queryFn: () => getEvents(identity.email || undefined),
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
  });

  const setIdentity = (value: Identity) => {
    setIdentityState(value);
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
  };

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set((eventsQuery.data ?? []).map((event) => event.category)),
      ).sort(),
    ],
    [eventsQuery.data],
  );

  const visibleEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (eventsQuery.data ?? [])
      .filter((event) => category === "All" || event.category === category)
      .filter((event) => range === "all" || isThisWeek(event.startsAt))
      .filter(
        (event) =>
          !needle ||
          [event.title, event.description, event.location, event.category].some(
            (value) => value.toLowerCase().includes(needle),
          ),
      )
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
  }, [eventsQuery.data, search, category, range]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main">
          <span aria-hidden="true">CE</span>
          <strong>Campus Events</strong>
        </a>
        <div className="topbar-copy">
          <span>Explore.</span> Connect. Belong.
        </div>
        <button className="primary-button compact" onClick={() => setShowCreate(true)}>
          <span aria-hidden="true">＋</span> Create event
        </button>
      </header>

      <main id="main" className="workspace">
        <section className="explorer" aria-labelledby="explorer-heading">
          <div className="hero">
            <div>
              <p className="eyebrow">Your campus, one calendar</p>
              <h1 id="explorer-heading">Find your next <em>thing.</em></h1>
              <p>Discover gatherings, workshops, games, and ideas worth showing up for.</p>
            </div>
            <div className="event-count" aria-label={`${visibleEvents.length} events shown`}>
              <strong>{visibleEvents.length}</strong>
              <span>events</span>
            </div>
          </div>

          <IdentityCard identity={identity} setIdentity={setIdentity} />

          <div className="controls">
            <label className="search-box">
              <span className="sr-only">Search events</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events, locations, or categories"
              />
            </label>
            <div className="range-toggle" aria-label="Date range">
              <button
                aria-pressed={range === "week"}
                onClick={() => setRange("week")}
              >
                This week
              </button>
              <button
                aria-pressed={range === "all"}
                onClick={() => setRange("all")}
              >
                All
              </button>
            </div>
          </div>

          <div className="category-chips" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {eventsQuery.isPending && (
            <div className="event-list" aria-label="Loading events">
              {[1, 2, 3].map((item) => (
                <div className="event-skeleton" key={item} />
              ))}
            </div>
          )}
          {eventsQuery.error && (
            <ErrorNotice error={eventsQuery.error} retry={() => eventsQuery.refetch()} />
          )}
          {!eventsQuery.isPending && !eventsQuery.error && visibleEvents.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">◇</span>
              <h2>No events found</h2>
              <p>Try another filter, search all dates, or create the first one.</p>
              <button className="primary-button" onClick={() => setShowCreate(true)}>
                Create an event
              </button>
            </div>
          )}
          {visibleEvents.length > 0 && (
            <div className="event-list">
              {visibleEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onOpen={() => setSelectedEvent(event)}
                />
              ))}
            </div>
          )}
          <p className="sync-note" role="status">
            <span className={eventsQuery.isFetching ? "sync-dot active" : "sync-dot"} />
            Live updates every 3 seconds
          </p>
        </section>
        <ChatPanel identity={identity} />
      </main>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          identity={identity}
          onClose={() => setSelectedEvent(undefined)}
        />
      )}
      {showCreate && (
        <CreateEventModal identity={identity} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
