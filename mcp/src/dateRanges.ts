export const CAMPUS_TIMEZONE = "America/Montreal" as const;

export type EventWhen =
  | "today"
  | "this_week"
  | "this_weekend"
  | "next_7_days"
  | "any";

export interface CampusDateRange {
  startDate: string;
  endDate: string;
  from: string;
  to: string;
  timezone: typeof CAMPUS_TIMEZONE;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function dateInMontreal(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type)?.value;
    if (part === undefined) {
      throw new Error(`Unable to calculate Montreal date: missing ${type}`);
    }
    return Number(part);
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function formatDate(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(
    date.day,
  ).padStart(2, "0")}`;
}

function weekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function montrealMidnight(date: CalendarDate): Date {
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-CA-u-hc-h23", {
    timeZone: CAMPUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value);
    const rendered = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const adjustment = target - rendered;
    instant += adjustment;
    if (adjustment === 0) {
      break;
    }
  }

  return new Date(instant);
}

function range(start: CalendarDate, end: CalendarDate): CampusDateRange {
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
    from: montrealMidnight(start).toISOString(),
    to: new Date(montrealMidnight(end).getTime() - 1).toISOString(),
    timezone: CAMPUS_TIMEZONE,
  };
}

export function resolveCampusDateRange(
  when: EventWhen,
  now = new Date(),
): CampusDateRange | undefined {
  if (when === "any") {
    return undefined;
  }

  const today = dateInMontreal(now);
  let end: CalendarDate;

  switch (when) {
    case "today":
      end = addDays(today, 1);
      break;
    case "next_7_days":
      end = addDays(today, 7);
      break;
    case "this_week": {
      const day = weekday(today);
      const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
      end = addDays(today, daysUntilNextMonday);
      break;
    }
    case "this_weekend": {
      const day = weekday(today);
      const daysUntilSaturday = day === 0 ? 0 : day === 6 ? 0 : 6 - day;
      const start = addDays(today, daysUntilSaturday);
      return range(start, addDays(start, day === 0 ? 1 : 2));
    }
  }

  return range(today, end);
}
