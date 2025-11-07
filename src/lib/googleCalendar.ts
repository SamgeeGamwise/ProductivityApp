import { google } from "googleapis";

type ListEventsParams = {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
};

type CalendarDateValue = {
  dateTime?: string;
  date?: string;
};

type CreateEventInput = {
  summary: string;
  description?: string;
  start: CalendarDateValue;
  end: CalendarDateValue;
  recurrenceRule?: string | null;
};

type UpdateEventInput = CreateEventInput & { id: string };

const calendarId = process.env.GOOGLE_CALENDAR_ID;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const scopes = ["https://www.googleapis.com/auth/calendar"];
let authClient: ReturnType<typeof google.auth.JWT> | null = null;

function getAuthClient() {
  if (!calendarIsConfigured()) {
    throw new Error("Google Calendar credentials are missing");
  }

  if (!authClient) {
    authClient = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes,
    });
  }

  return authClient;
}

async function getCalendar() {
  const auth = getAuthClient();
  if (!auth.credentials) {
    await auth.authorize();
  }
  return google.calendar({ version: "v3", auth });
}

export async function listEvents(params: ListEventsParams) {
  const calendar = await getCalendar();
  const response = await calendar.events.list({
    calendarId: calendarId!,
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: params.maxResults ?? 25,
  });

  return response.data.items ?? [];
}

export async function createEvent(input: CreateEventInput) {
  const calendar = await getCalendar();
  const response = await calendar.events.insert({
    calendarId: calendarId!,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: input.start,
      end: input.end,
      recurrence: input.recurrenceRule ? [input.recurrenceRule] : undefined,
    },
  });

  return response.data;
}

export async function updateEvent(input: UpdateEventInput) {
  const calendar = await getCalendar();
  const response = await calendar.events.patch({
    calendarId: calendarId!,
    eventId: input.id,
    requestBody: {
      summary: input.summary,
      description: input.description,
      start: input.start,
      end: input.end,
      recurrence: input.recurrenceRule ? [input.recurrenceRule] : null,
    },
  });

  return response.data;
}

export async function deleteEvent(id: string) {
  const calendar = await getCalendar();
  await calendar.events.delete({
    calendarId: calendarId!,
    eventId: id,
  });
}

export function calendarIsConfigured() {
  return Boolean(calendarId && clientEmail && privateKey);
}
