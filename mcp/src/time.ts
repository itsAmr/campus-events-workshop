// Montreal date helpers used by search_events. You do not need to read this file.

const TIMEZONE = "America/Montreal";

export type EventWhen = "today" | "this_week" | "this_weekend" | "next_7_days" | "any";

// Turns a named range into the from/to timestamps the REST API expects, using
// Montreal calendar days. Weeks end on Sunday.
export function resolveCampusDateRange(when: EventWhen, now = new Date()) {
  if (when === "any") return undefined;

  const today = montrealDate(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 is Sunday
  let start = today;
  let days = 1;
  if (when === "next_7_days") days = 7;
  if (when === "this_week") days = weekday === 0 ? 1 : 8 - weekday;
  if (when === "this_weekend") {
    start = addDays(today, weekday === 0 || weekday === 6 ? 0 : 6 - weekday);
    days = weekday === 0 ? 1 : 2;
  }

  const end = montrealMidnight(addDays(start, days));
  return {
    from: montrealMidnight(start).toISOString(),
    to: new Date(end.getTime() - 1).toISOString(),
  };
}

// "2026-11-06" for the day it is in Montreal at that instant.
function montrealDate(instant: Date): string {
  return instant.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

// Montreal is 4 or 5 hours behind UTC depending on daylight saving time, so ask
// for the offset in effect that night. Clocks change at 2 AM, after 05:00 UTC.
function montrealMidnight(date: string): Date {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T05:00:00Z`))
    .find((part) => part.type === "timeZoneName")!.value; // like "GMT-05:00"
  return new Date(`${date}T00:00:00${offset.replace("GMT", "")}`);
}

const montrealTime = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// The API speaks UTC, and models are unreliable at timezone math, so every event
// handed to the model carries a ready-to-quote Montreal time.
export function withLocalTime<T extends { startsAt: string; endsAt: string }>(event: T) {
  const range = montrealTime.formatRange(new Date(event.startsAt), new Date(event.endsAt));
  return { ...event, localTime: `${range} (Montreal time)` };
}
