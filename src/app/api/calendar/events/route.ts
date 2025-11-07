import { NextRequest, NextResponse } from "next/server";
import { calendarIsConfigured, createEvent, deleteEvent, listEvents, updateEvent } from "@/lib/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  if (!calendarIsConfigured()) {
    return NextResponse.json({ events: [], needsSetup: true });
  }

  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
  }

  try {
    const events = await listEvents({ timeMin, timeMax });
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Google Calendar GET error", error);
    return NextResponse.json({ error: "Failed to load Google Calendar events" }, { status: 502 });
  }
}

type RecurrencePayload = {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
} | null;

function buildRecurrenceRule(recurrence: RecurrencePayload) {
  if (!recurrence) return null;
  const freq = recurrence.frequency?.toUpperCase();
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) {
    return null;
  }
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  return `RRULE:FREQ=${freq};INTERVAL=${interval}`;
}

function buildEventTiming(
  startValue: string,
  endValue: string,
  allDay: boolean
): { start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } } {
  if (allDay) {
    const startDate = ensureDateInput(startValue, "start");
    const inclusiveEnd = ensureDateInput(endValue, "end");
    const exclusiveEnd = shiftDateString(inclusiveEnd, 1);
    return {
      start: { date: startDate },
      end: { date: exclusiveEnd },
    };
  }

  return {
    start: { dateTime: parseDateTime(startValue) },
    end: { dateTime: parseDateTime(endValue) },
  };
}

export async function POST(request: NextRequest) {
  if (!calendarIsConfigured()) {
    return NextResponse.json({ error: "Calendar credentials missing", needsSetup: true }, { status: 400 });
  }

  const { summary, description, start, end, recurrence, allDay } = await request.json();

  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start, and end are required" }, { status: 400 });
  }

  try {
    const timing = buildEventTiming(start, end, Boolean(allDay));
    const recurrenceRule = buildRecurrenceRule(recurrence);
    const event = await createEvent({
      summary,
      description,
      start: timing.start,
      end: timing.end,
      recurrenceRule,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Invalid date") ? 400 : 502;
    if (status === 502) {
      console.error("Google Calendar POST error", error);
    }
    return NextResponse.json({ error: status === 400 ? message : "Failed to create Google Calendar event" }, { status });
  }
}

export async function PUT(request: NextRequest) {
  if (!calendarIsConfigured()) {
    return NextResponse.json({ error: "Calendar credentials missing", needsSetup: true }, { status: 400 });
  }

  const { id, summary, description, start, end, recurrence, allDay } = await request.json();

  if (!id || !summary || !start || !end) {
    return NextResponse.json({ error: "id, summary, start, and end are required" }, { status: 400 });
  }

  try {
    const timing = buildEventTiming(start, end, Boolean(allDay));
    const recurrenceRule = buildRecurrenceRule(recurrence);
    const event = await updateEvent({
      id,
      summary,
      description,
      start: timing.start,
      end: timing.end,
      recurrenceRule,
    });
    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Invalid date") ? 400 : 502;
    if (status === 502) {
      console.error("Google Calendar PUT error", error);
    }
    return NextResponse.json({ error: status === 400 ? message : "Failed to update Google Calendar event" }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  if (!calendarIsConfigured()) {
    return NextResponse.json({ error: "Calendar credentials missing", needsSetup: true }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Google Calendar DELETE error", error);
    return NextResponse.json({ error: "Failed to delete Google Calendar event" }, { status: 502 });
  }
}

function parseDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date.toISOString();
}

function ensureDateInput(value: string, label: string) {
  if (!value) {
    throw new Error(`Invalid ${label} date`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label} date`);
  }
  return value.slice(0, 10);
}

function shiftDateString(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
