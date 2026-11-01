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

-- TODO(part-0): create the rsvps table with columns id, event_id, email,
-- and created_at. The database should guarantee that:
--   1. every RSVP belongs to an event that exists;
--   2. an email RSVPs to the same event at most once;
--   3. deleting an event deletes its RSVPs; and
--   4. every RSVP has an email.
-- Check your design with: npm test --workspace api -- schema

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
