import { useEffect, useState } from "react";
import {
  CampusEvent,
  Identity,
  cancelRsvp,
  errorMessage,
  listCategories,
  listEvents,
  rsvp,
} from "./api";
import { Chat } from "./Chat";
import { CreateEventDialog } from "./CreateEventDialog";

const IDENTITY_KEY = "campus-events.identity";
const POLL_MS = 3_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

function loadIdentity(): Identity {
  try {
    return { name: "", email: "", ...JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "{}") };
  } catch {
    return { name: "", email: "" };
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Polls the REST API so changes made elsewhere (curl, MCP, the assistant)
// show up without a page refresh.
function useEvents(q: string, category: string, thisWeek: boolean, email: string) {
  const [events, setEvents] = useState<CampusEvent[]>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      const now = Date.now();
      const range = thisWeek
        ? { from: new Date(now).toISOString(), to: new Date(now + WEEK_MS).toISOString() }
        : {};
      listEvents({ q, category, email, ...range }).then(
        (data) => {
          if (!active) return;
          setEvents(data);
          setError(undefined);
        },
        (reason) => active && setError(errorMessage(reason)),
      );
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [q, category, thisWeek, email, version]);

  return { events, error, reload: () => setVersion((value) => value + 1) };
}

export default function App() {
  const [identity, setIdentity] = useState(loadIdentity);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [thisWeek, setThisWeek] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number>();
  const [actionError, setActionError] = useState<string>();

  const email = isEmail(identity.email) ? identity.email.trim() : "";
  const { events, error, reload } = useEvents(q, category, thisWeek, email);

  useEffect(() => {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  }, [identity]);

  useEffect(() => {
    listCategories().then(setCategories, () => setCategories([]));
  }, []);

  async function toggleRsvp(event: CampusEvent) {
    setBusyId(event.id);
    setActionError(undefined);
    try {
      await (event.isAttending ? cancelRsvp(event.id, email) : rsvp(event.id, email));
      reload();
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <header className="container">
        <nav>
          <ul>
            <li>
              <strong>Campus Events</strong>
            </li>
          </ul>
          <ul>
            <li>
              <button onClick={() => setCreating(true)}>Create event</button>
            </li>
          </ul>
        </nav>
      </header>

      <main className="container layout">
        <section>
          <fieldset className="grid">
            <label>
              Name
              <input
                value={identity.name}
                onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                placeholder="Alex Rivera"
                autoComplete="name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={identity.email}
                onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                placeholder="alex@mcgill.ca"
                autoComplete="email"
              />
              <small>{email ? "Used for RSVPs and by the assistant." : "Enter an email to RSVP."}</small>
            </label>
          </fieldset>

          <div className="grid filters">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events"
              aria-label="Search events"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Category"
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <select
              value={thisWeek ? "week" : "all"}
              onChange={(e) => setThisWeek(e.target.value === "week")}
              aria-label="Date range"
            >
              <option value="week">Next 7 days</option>
              <option value="all">All dates</option>
            </select>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          {actionError && <p className="error" role="alert">{actionError}</p>}
          {!events && !error && <p aria-busy="true">Loading events…</p>}
          {events?.length === 0 && <p>No events match these filters.</p>}

          {events?.map((event) => (
            <article key={event.id} className="event">
              <div>
                <strong>{event.title}</strong> {event.isAttending && <mark>Going</mark>}
                <br />
                <small>
                  {formatDate(event.startsAt)} · {event.location} · {event.category}
                </small>
                <p>{event.description}</p>
              </div>
              <div className="event-actions">
                <small>
                  {event.availableSpots === 0
                    ? "Full"
                    : `${event.availableSpots} of ${event.capacity} spots left`}
                </small>
                <button
                  className={event.isAttending ? "secondary outline" : undefined}
                  disabled={
                    !email ||
                    busyId === event.id ||
                    (!event.isAttending && event.availableSpots === 0)
                  }
                  onClick={() => toggleRsvp(event)}
                >
                  {event.isAttending ? "Cancel RSVP" : "RSVP"}
                </button>
              </div>
            </article>
          ))}
        </section>

        <Chat identity={identity} />
      </main>

      {creating && (
        <CreateEventDialog
          categories={categories}
          onCreated={reload}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
