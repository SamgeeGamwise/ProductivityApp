"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ModuleCard } from "../module-card";
import { addWeeks, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

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

interface CalendarModuleProps {
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function CalendarModule({ expanded = false, onToggleExpand }: CalendarModuleProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventState>(() => ({ ...defaultEvent }));
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const resetForm = () => {
    setNewEvent({ ...defaultEvent });
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...newEvent, id: editingId } : newEvent;
      const response = await fetch("/api/calendar/events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${editingId ? "update" : "create"} event`);
      resetForm();
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    if (!event.id) return;
    const start = getEventDate(event.start) ?? new Date();
    const end = getEventDate(event.end) ?? new Date(start.getTime() + 30 * 60 * 1000);
    setEditingId(event.id);
    setNewEvent({
      summary: event.summary ?? "",
      description: event.description ?? "",
      start: toInputValue(start),
      end: toInputValue(end),
    });
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this event?");
      if (!confirmed) return;
    }
    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete event");
      if (editingId === id) {
        resetForm();
      }
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const visibleEvents = expanded ? events : events.slice(0, 6);
  const overflow = expanded ? 0 : Math.max(events.length - visibleEvents.length, 0);
  const isEditing = Boolean(editingId);

  return (
    <ModuleCard
      title="Google Calendar"
      accent="from-sky-500/40 to-blue-500/10"
      className="min-h-0 w-full"
      contentClassName={expanded ? "gap-5" : "gap-4"}
      actions={
        <div className="flex flex-wrap gap-2 text-xs text-white/80">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide hover:border-white/60"
            >
              {expanded ? "Dashboard view" : "Full view"}
            </button>
          )}
          <div className="flex gap-2">
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

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm md:grid-cols-[1.2fr_1fr]"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
              placeholder="Event title"
              value={newEvent.summary}
              onChange={(event) => setNewEvent((prev) => ({ ...prev, summary: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">Details</label>
            <textarea
              className="h-20 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
              placeholder="Notes or location"
              value={newEvent.description}
              onChange={(event) => setNewEvent((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Start</label>
              <input
                type="datetime-local"
                className="calendar-field w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
                value={newEvent.start}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, start: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">End</label>
              <input
                type="datetime-local"
                className="calendar-field w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-white/40"
                value={newEvent.end}
                onChange={(event) => setNewEvent((prev) => ({ ...prev, end: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {isEditing && (
              <button
                type="button"
                className="w-full rounded-xl border border-white/20 px-4 py-3 font-semibold text-white/80 hover:border-white/40"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              disabled={!newEvent.summary || !newEvent.start || !newEvent.end}
            >
              {isEditing ? "Update event" : "Save event"}
            </button>
          </div>
        </div>
      </form>

      <EventList
        events={visibleEvents}
        isLoading={isLoading}
        overflow={overflow}
        expanded={expanded}
        range={range}
        onEdit={handleEdit}
        onDelete={handleDelete}
        editingId={editingId}
      />
    </ModuleCard>
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

function EventList({
  events,
  isLoading,
  overflow,
  expanded,
  range,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  overflow: number;
  expanded: boolean;
  range: { start: Date; end: Date };
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string | undefined) => void;
  editingId: string | null;
}) {
  if (isLoading && !events.length) {
    return <p className="text-sm text-slate-400">Loading events…</p>;
  }

  if (!events.length) {
    return <p className="text-sm text-slate-400">No events scheduled for this window.</p>;
  }

  if (expanded) {
    return <CalendarWeekGrid events={events} range={range} onEdit={onEdit} onDelete={onDelete} editingId={editingId} />;
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
            <div className="mt-2 flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <button
                type="button"
                className="text-sky-300 hover:text-white"
                onClick={() => onEdit(event)}
                disabled={!event.id}
              >
                {editingId === event.id ? "Editing…" : "Edit"}
              </button>
              <button
                type="button"
                className="text-red-300 hover:text-red-200"
                onClick={() => onDelete(event.id)}
                disabled={!event.id}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {overflow > 0 && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">+{overflow} more this week</p>
      )}
    </div>
  );
}

function CalendarWeekGrid({
  events,
  range,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string | undefined) => void;
  editingId: string | null;
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end });

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-3">
      <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const dayEvents = events
            .filter((event) => {
              const start = getEventDate(event.start);
              return start && isSameDay(start, day);
            })
            .sort((a, b) => {
              const first = getEventDate(a.start)?.getTime() ?? 0;
              const second = getEventDate(b.start)?.getTime() ?? 0;
              return first - second;
            });

          return (
            <div key={day.toISOString()} className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-slate-950/50 p-2">
              <div className="flex items-baseline justify-between border-b border-white/5 pb-1">
                <p className="text-xs font-semibold text-white">{format(day, "EEE")}</p>
                <p className="text-[11px] text-slate-400">{format(day, "MMM d")}</p>
              </div>
              <div className="mt-2 flex-1 space-y-2 overflow-hidden">
                {dayEvents.length ? (
                  dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="space-y-1 rounded-lg border border-sky-400/30 bg-sky-400/15 p-2 text-[11px] text-white/90"
                  >
                    <p className="font-semibold">{event.summary || "(untitled)"}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-200">
                      {formatEventRange(event)}
                    </p>
                    {event.location && <p className="text-[10px] text-slate-300">{event.location}</p>}
                    <div className="flex gap-2 text-[9px] font-semibold uppercase">
                      <button
                        type="button"
                        className="text-white hover:text-slate-200"
                        onClick={() => onEdit(event)}
                        disabled={!event.id}
                      >
                        {editingId === event.id ? "Editing…" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="text-red-200 hover:text-red-100"
                        onClick={() => onDelete(event.id)}
                        disabled={!event.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
                ) : (
                  <p className="text-[11px] text-slate-500">— Free —</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatEventTime(value?: { date?: string | null; dateTime?: string | null }) {
  const timestamp = value?.dateTime || value?.date;
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return format(date, value?.date ? "EEE, MMM d" : "EEE h:mma");
}

function getEventDate(value?: { date?: string | null; dateTime?: string | null }) {
  const iso = value?.dateTime || value?.date;
  if (!iso) return null;
  return new Date(iso);
}

function formatEventRange(event: CalendarEvent) {
  const start = getEventDate(event.start);
  const end = getEventDate(event.end);
  if (!start || !end) return "";
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  if (isAllDay) {
    return "All day";
  }
  return `${format(start, "h:mma")} – ${format(end, "h:mma")}`;
}
