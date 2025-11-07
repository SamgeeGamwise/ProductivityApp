import { NextRequest, NextResponse } from "next/server";
import { calendarIsConfigured, createEvent, listEvents } from "@/lib/googleCalendar";

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

export async function POST(request: NextRequest) {
  if (!calendarIsConfigured()) {
    return NextResponse.json({ error: "Calendar credentials missing", needsSetup: true }, { status: 400 });
  }

  const { summary, description, start, end } = await request.json();

  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start, and end are required" }, { status: 400 });
  }

  try {
    const event = await createEvent({
      summary,
      description,
      start: parseDateTime(start),
      end: parseDateTime(end),
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

function parseDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date.toISOString();
}
