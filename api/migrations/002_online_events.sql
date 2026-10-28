ALTER TABLE events
  ADD COLUMN meeting_url TEXT
  CHECK (meeting_url IS NULL OR length(trim(meeting_url)) > 0);
