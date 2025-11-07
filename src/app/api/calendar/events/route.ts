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

export async function POST(request: NextRequest) {
  if (!calendarIsConfigured()) {
    return NextResponse.json({ error: "Calendar credentials missing", needsSetup: true }, { status: 400 });
  }

  const { summary, description, start, end, recurrence } = await request.json();

  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start, and end are required" }, { status: 400 });
  }

  const recurrenceRule = buildRecurrenceRule(recurrence);

  try {
    const event = await createEvent({
      summary,
      description,
      start: parseDateTime(start),
      end: parseDateTime(end),
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

  const { id, summary, description, start, end, recurrence } = await request.json();

  if (!id || !summary || !start || !end) {
    return NextResponse.json({ error: "id, summary, start, and end are required" }, { status: 400 });
  }

  const recurrenceRule = buildRecurrenceRule(recurrence);

  try {
    const event = await updateEvent({
      id,
      summary,
      description,
      start: parseDateTime(start),
      end: parseDateTime(end),
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
