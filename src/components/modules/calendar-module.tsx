"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ModuleCard } from "../module-card";
import { addWeeks, format, startOfWeek, endOfWeek } from "date-fns";

type CalendarEvent = {
  id: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { date?: string | null; dateTime?: string | null }; 
  end?: { date?: string | null; dateTime?: string | null };
};

type NewEventState = {
  summary: string;
  description: string;
  start: string;
  end: string;
};

const defaultEvent: NewEventState = {
  summary: "",
  description: "",
  start: "",
  end: "",
};

const quickTemplates = [
  { label: "Family Sync", duration: 45 },
  { label: "Meal Prep", duration: 30 },
  { label: "Workout", duration: 60 },
  { label: "Focus Sprint", duration: 90 },
];

function nextRoundedDate(minutesAhead = 0) {
  const now = new Date();
  const rounded = new Date(now);
  const minutes = now.getMinutes();
  const remainder = minutes % 30 === 0 ? 0 : 30 - (minutes % 30);
  rounded.setMinutes(minutes + remainder + minutesAhead);
  rounded.setSeconds(0, 0);
  return rounded;
}

function toInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function CalendarModule() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventState>(() => ({ ...defaultEvent }));

  const range = useMemo(() => {
    const anchor = addWeeks(new Date(), weekOffset);
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }, [weekOffset]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
      });
      const response = await fetch(`/api/calendar/events?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load events");
      setNeedsSetup(Boolean(payload.needsSetup));
      setEvents(payload.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  }, [range.end, range.start]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setNewEvent((prev) => {
      if (prev.start) return prev;
      const start = nextRoundedDate();
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return { ...prev, start: toInputValue(start), end: toInputValue(end) };
    });
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create event");
      setNewEvent({ ...defaultEvent });
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  return (
    <ModuleCard
      title="Google Calendar"
      accent="from-sky-500/40 to-blue-500/10"
      className="min-h-0"
      contentClassName="gap-4"
      actions={
        <div className="flex gap-2 text-xs text-white/80">
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value - 1)}
            className="rounded-full border border-white/20 px-3 py-1 hover:border-white/60"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="rounded-full border border-white/20 px-3 py-1 hover:border-white/60"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((value) => value + 1)}
            className="rounded-full border border-white/20 px-3 py-1 hover:border-white/60"
          >
            Next →
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-2 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-semibold text-white">
          {format(range.start, "MMM d")} – {format(range.end, "MMM d")}
        </p>
        {isLoading && <span className="text-xs text-slate-400">Refreshing…</span>}
      </div>

      {needsSetup && (
        <p className="mb-4 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-100">
          Calendar access is not configured yet. Add your Google service account secrets to <code>.env.local</code> (see README) to enable sync.
        </p>
      )}

      {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <QuickEventTemplates onApply={(template) => applyTemplate(template, setNewEvent)} />

      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3 text-sm lg:grid-cols-2">
        <div className="space-y-3">
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
            placeholder="Event title"
            value={newEvent.summary}
            onChange={(event) => setNewEvent((prev) => ({ ...prev, summary: event.target.value }))}
            required
          />
          <textarea
            className="h-16 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
            placeholder="Notes (optional)"
            value={newEvent.description}
            onChange={(event) => setNewEvent((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs text-slate-400">
            Start
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
              value={newEvent.start}
              onChange={(event) => setNewEvent((prev) => ({ ...prev, start: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-400">
            End
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
              value={newEvent.end}
              onChange={(event) => setNewEvent((prev) => ({ ...prev, end: event.target.value }))}
              required
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            disabled={!newEvent.summary || !newEvent.start || !newEvent.end}
          >
            Create event
          </button>
        </div>
      </form>

      <EventList events={events.slice(0, 6)} isLoading={isLoading} overflow={events.length > 6 ? events.length - 6 : 0} />
    </ModuleCard>
  );
}

function QuickEventTemplates({
  onApply,
}: {
  onApply: (template: { label: string; duration: number }) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-white/5 bg-slate-900/60 p-3 text-xs text-slate-200">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tap to schedule</p>
      <div className="flex flex-wrap gap-2">
        {quickTemplates.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => onApply(template)}
            className="rounded-full border border-sky-400/40 px-3 py-1 text-xs font-semibold text-white transition hover:border-sky-300 hover:text-sky-200"
          >
            {template.label} · {template.duration}m
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onApply({ label: "Open slot", duration: 30 })
          }
          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/70 hover:border-white/50"
        >
          Next free half-hour
        </button>
      </div>
    </div>
  );
}

function applyTemplate(
  template: { label: string; duration: number },
  setNewEvent: React.Dispatch<React.SetStateAction<NewEventState>>
) {
  const start = nextRoundedDate();
  const end = new Date(start.getTime() + template.duration * 60 * 1000);
  setNewEvent({
    summary: template.label === "Open slot" ? "" : template.label,
    description: "",
    start: toInputValue(start),
    end: toInputValue(end),
  });
}

function EventList({ events, isLoading, overflow }: { events: CalendarEvent[]; isLoading: boolean; overflow: number }) {
  if (isLoading && !events.length) {
    return <p className="text-sm text-slate-400">Loading events…</p>;
  }

  if (!events.length) {
    return <p className="text-sm text-slate-400">No events scheduled for this window.</p>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-xl border border-white/5 bg-slate-900/70 p-3">
            <p className="text-sm font-semibold text-white">{event.summary || "(untitled)"}</p>
            <p className="text-xs text-slate-300">
              {formatEventTime(event.start)} – {formatEventTime(event.end)}
          </p>
          {event.description && (
            <p className="mt-1 overflow-hidden text-ellipsis text-xs text-slate-400">{event.description}</p>
          )}
          {event.location && <p className="text-xs text-slate-500">{event.location}</p>}
        </li>
      ))}
      </ul>
      {overflow > 0 && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">+{overflow} more this week</p>
      )}
    </div>
  );
}

function formatEventTime(value?: { date?: string | null; dateTime?: string | null }) {
  const timestamp = value?.dateTime || value?.date;
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return format(date, value?.date ? "EEE, MMM d" : "EEE h:mma");
}
