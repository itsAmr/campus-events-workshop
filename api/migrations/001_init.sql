CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  location TEXT NOT NULL CHECK (length(trim(location)) > 0),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (ends_at > starts_at)
);

-- TODO(part-0.1): design the rsvps table.
--   Columns: id, event_id, email, created_at. The database should guarantee:
--     1. every RSVP belongs to an event, and that event exists;
--     2. an email RSVPs to the same event at most once;
--     3. deleting an event deletes its RSVPs; and
--     4. every RSVP has an email.
--   Copy the created_at line from the events table above.
--   Check: npm run check:0, then npm run db:reset

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
