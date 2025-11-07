"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ModuleCard } from "../module-card";
import {
  addWeeks,
  addMonths,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";

type CalendarEvent = {
  id: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { date?: string | null; dateTime?: string | null }; 
  end?: { date?: string | null; dateTime?: string | null };
  recurrence?: string[] | null;
};

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

type NewEventState = {
  summary: string;
  description: string;
  start: string;
  end: string;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceInterval: number;
};

const recurrenceLabels: Record<Exclude<RecurrenceFrequency, "none">, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const recurrenceUnits: Record<Exclude<RecurrenceFrequency, "none">, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

function createDefaultEvent(): NewEventState {
  const start = nextRoundedDate();
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    summary: "",
    description: "",
    start: toInputValue(start),
    end: toInputValue(end),
    recurrenceFrequency: "none",
    recurrenceInterval: 1,
  };
}

function parseRecurrenceRule(rule?: string | null): { frequency: RecurrenceFrequency; interval: number } {
  if (!rule) return { frequency: "none", interval: 1 };
  const freqMatch = rule.match(/FREQ=([A-Z]+)/);
  const intervalMatch = rule.match(/INTERVAL=(\d+)/);
  const freqValue = freqMatch?.[1];
  const intervalValue = intervalMatch ? Number(intervalMatch[1]) : 1;
  switch (freqValue) {
    case "DAILY":
      return { frequency: "daily", interval: intervalValue || 1 };
    case "WEEKLY":
      return { frequency: "weekly", interval: intervalValue || 1 };
    case "MONTHLY":
      return { frequency: "monthly", interval: intervalValue || 1 };
    default:
      return { frequency: "none", interval: 1 };
  }
}

function describeRecurrence(rule?: string | null) {
  if (!rule) return null;
  const { frequency, interval } = parseRecurrenceRule(rule);
  if (frequency === "none") return null;
  if (interval > 1) {
    const unit = recurrenceUnits[frequency];
    return `Repeats every ${interval} ${unit}${interval > 1 ? "s" : ""}`;
  }
  const label = recurrenceLabels[frequency];
  return `Repeats ${label.toLowerCase()}`;
}

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
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventState>(() => createDefaultEvent());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isComposerModalOpen, setIsComposerModalOpen] = useState(false);

  const weekRange = useMemo(() => {
    const anchor = addWeeks(new Date(), weekOffset);
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }, [weekOffset]);

  const dayRange = useMemo(() => {
    const today = new Date();
    return {
      start: startOfDay(today),
      end: endOfDay(today),
    };
  }, []);

  const monthRange = useMemo(() => {
    const anchor = addMonths(new Date(), monthOffset);
    const monthStartDate = startOfMonth(anchor);
    const monthEndDate = endOfMonth(anchor);
    return {
      start: startOfWeek(monthStartDate, { weekStartsOn: 1 }),
      end: endOfWeek(monthEndDate, { weekStartsOn: 1 }),
      monthStart: monthStartDate,
    };
  }, [monthOffset]);

  const isExpandedMonthView = expanded && viewMode === "month";
  const isExpandedWeekView = expanded && viewMode === "week";
  const isDashboardDayView = !expanded;
  const range = isExpandedMonthView ? monthRange : isExpandedWeekView ? weekRange : dayRange;
  const displayLabel = isExpandedMonthView
    ? format(monthRange.monthStart, "MMMM yyyy")
    : isDashboardDayView
      ? format(dayRange.start, "EEEE, MMM d")
      : `${format(weekRange.start, "MMM d")} – ${format(weekRange.end, "MMM d")}`;

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

  const resetForm = () => {
    setNewEvent(createDefaultEvent());
    setEditingId(null);
  };

  const closeComposer = () => {
    setIsComposerModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const method = editingId ? "PUT" : "POST";
      const recurrencePayload =
        newEvent.recurrenceFrequency === "none"
          ? null
          : {
              frequency: newEvent.recurrenceFrequency,
              interval: newEvent.recurrenceInterval,
            };
      const body = {
        summary: newEvent.summary,
        description: newEvent.description,
        start: newEvent.start,
        end: newEvent.end,
        recurrence: recurrencePayload,
        ...(editingId ? { id: editingId } : {}),
      };
      const response = await fetch("/api/calendar/events", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${editingId ? "update" : "create"} event`);
      resetForm();
      await loadEvents();
      setIsComposerModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    if (!event.id) return;
    const start = getEventDate(event.start) ?? new Date();
    const end = getEventDate(event.end) ?? new Date(start.getTime() + 30 * 60 * 1000);
    const recurrence = parseRecurrenceRule(event.recurrence?.[0]);
    setEditingId(event.id);
    setNewEvent({
      summary: event.summary ?? "",
      description: event.description ?? "",
      start: toInputValue(start),
      end: toInputValue(end),
      recurrenceFrequency: recurrence.frequency,
      recurrenceInterval: recurrence.interval,
    });
    setIsComposerModalOpen(true);
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

  const effectiveViewMode = expanded ? viewMode : "week";
  const visibleEvents = expanded ? events : events;
  const overflow = expanded ? Math.max(events.length - visibleEvents.length, 0) : 0;
  const isEditing = Boolean(editingId);
  const navResetLabel = isExpandedMonthView ? "This Month" : "This Week";

  const handlePrev = () => {
    if (isExpandedMonthView) {
      setMonthOffset((value) => value - 1);
    } else {
      setWeekOffset((value) => value - 1);
    }
  };

  const handleNext = () => {
    if (isExpandedMonthView) {
      setMonthOffset((value) => value + 1);
    } else {
      setWeekOffset((value) => value + 1);
    }
  };

  const handleReset = () => {
    if (isExpandedMonthView) {
      setMonthOffset(0);
    } else {
      setWeekOffset(0);
    }
  };

  return (
    <>
      <ModuleCard
      title="Google Calendar"
      accent="from-sky-500/40 to-blue-500/10"
      className={expanded ? "min-h-0 w-full text-[13px]" : "min-h-0 w-full text-[12px]"}
      contentClassName={expanded ? "gap-4" : "gap-3"}
      actions={
        <div className="flex flex-wrap gap-1.5 text-sm text-white/80">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsComposerModalOpen(true);
            }}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
          >
            Add event
          </button>
          {expanded && (
            <>
              <div className="flex rounded-full border border-white/20 p-0.5">
                {["week", "month"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === mode ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                    }`}
                    onClick={() => setViewMode(mode as "week" | "month")}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {onToggleExpand && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:border-white/60"
                >
                  {expanded ? "Dashboard view" : "Full view"}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs hover:border-white/60"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs hover:border-white/60"
                >
                  {navResetLabel}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs hover:border-white/60"
                >
                  Next →
                </button>
              </div>
            </>
          )}
          {!expanded && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:border-white/60"
            >
              Full view
            </button>
          )}
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-2 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-semibold text-white">{displayLabel}</p>
        {isLoading && <span className="text-xs text-slate-400">Refreshing…</span>}
      </div>

      {needsSetup && (
        <p className="mb-4 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-100">
          Calendar access is not configured yet. Add your Google service account secrets to <code>.env.local</code> (see README) to enable sync.
        </p>
      )}

      {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <EventList
        events={visibleEvents}
        isLoading={isLoading}
        overflow={overflow}
        expanded={expanded}
        range={range}
        viewMode={effectiveViewMode}
        currentMonthStart={monthRange.monthStart}
        onEdit={handleEdit}
        onDelete={handleDelete}
        editingId={editingId}
      />
      </ModuleCard>
      {isComposerModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeComposer();
          }
        }}
      >
        <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-sm text-white shadow-2xl shadow-black/60">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Calendar</p>
              <h3 className="text-2xl font-semibold text-white">{isEditing ? "Edit event" : "Add event"}</h3>
            </div>
            <button
              type="button"
              onClick={closeComposer}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/60 hover:text-white"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
                <input
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                  placeholder="Event title"
                  value={newEvent.summary}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, summary: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Details</label>
                <input
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                  placeholder="Notes or location"
                  value={newEvent.description}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Start</label>
                <input
                  type="datetime-local"
                  className="calendar-field w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                  value={newEvent.start}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, start: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">End</label>
                <input
                  type="datetime-local"
                  className="calendar-field w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                  value={newEvent.end}
                  onChange={(event) => setNewEvent((prev) => ({ ...prev, end: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Repeats</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={newEvent.recurrenceFrequency}
                  onChange={(event) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      recurrenceFrequency: event.target.value as RecurrenceFrequency,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40 sm:w-48"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {newEvent.recurrenceFrequency !== "none" && (
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <span>Every</span>
                    <input
                      type="number"
                      min={1}
                      value={newEvent.recurrenceInterval}
                      onChange={(event) =>
                        setNewEvent((prev) => ({
                          ...prev,
                          recurrenceInterval: Math.max(1, Number(event.target.value) || 1),
                        }))
                      }
                      className="w-20 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    />
                    <span>
                      {recurrenceUnits[newEvent.recurrenceFrequency]}
                      {newEvent.recurrenceInterval > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={closeComposer}
                className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
                disabled={!newEvent.summary || !newEvent.start || !newEvent.end}
              >
                {isEditing ? "Update event" : "Save event"}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </>
  );
}

function EventList({
  events,
  isLoading,
  overflow,
  expanded,
  range,
  viewMode,
  currentMonthStart,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  isLoading: boolean;
  overflow: number;
  expanded: boolean;
  range: { start: Date; end: Date };
  viewMode: "week" | "month";
  currentMonthStart?: Date;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string | undefined) => void;
  editingId: string | null;
}) {
  if (isLoading && !events.length) {
    return <p className="text-sm text-slate-400">Loading events…</p>;
  }

  if (!events.length) {
    return <p className="text-sm text-slate-400">No events scheduled for today.</p>;
  }

  if (expanded && viewMode === "month" && currentMonthStart) {
    return (
      <CalendarMonthGrid
        events={events}
        range={range}
        currentMonthStart={currentMonthStart}
        onEdit={onEdit}
        onDelete={onDelete}
        editingId={editingId}
      />
    );
  }

  if (expanded) {
    return <CalendarWeekGrid events={events} range={range} onEdit={onEdit} onDelete={onDelete} editingId={editingId} />;
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-auto pr-1">
        <ul className="space-y-2.5">
          {events.map((event) => {
            const recurrenceNote = describeRecurrence(event.recurrence?.[0]);
            return (
              <li key={event.id} className="rounded-xl border border-white/5 bg-slate-900/70 p-2.5">
                <p className="text-sm font-semibold text-white">{event.summary || "(untitled)"}</p>
                <p className="text-sm text-slate-300">
                  {formatEventTime(event.start)} – {formatEventTime(event.end)}
                </p>
                {event.description && (
                  <p className="mt-1 overflow-hidden text-ellipsis text-sm text-slate-400">{event.description}</p>
                )}
                {event.location && <p className="text-sm text-slate-500">{event.location}</p>}
                {recurrenceNote && <p className="text-xs text-slate-400">{recurrenceNote}</p>}
                <div className="mt-1.5 flex gap-2 text-xs font-semibold uppercase tracking-wide">
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
            );
          })}
        </ul>
      </div>
      {overflow > 0 && (
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">+{overflow} more this week</p>
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
    <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-2.5">
      <div className="flex-1 overflow-auto pr-1">
        <div className="grid min-h-full grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-7">
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
              <div key={day.toISOString()} className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-slate-950/50 p-1.5">
                <div className="flex items-baseline justify-between border-b border-white/5 pb-0.5">
                  <p className="text-sm font-semibold text-white">{format(day, "EEE")}</p>
                  <p className="text-xs text-slate-400">{format(day, "MMM d")}</p>
                </div>
                <div className="mt-1.5 flex-1 space-y-1.5 overflow-hidden">
                  {dayEvents.length ? (
                    dayEvents.map((event) => {
                      const recurrenceNote = describeRecurrence(event.recurrence?.[0]);
                      return (
                    <div
                      key={event.id}
                      className="space-y-0.5 rounded-lg border border-sky-400/30 bg-sky-400/10 p-1.5 text-xs text-white/90"
                    >
                          <p className="font-semibold">{event.summary || "(untitled)"}</p>
                          <p className="text-[9px] uppercase tracking-wide text-slate-200">{formatEventRange(event)}</p>
                          {event.location && <p className="text-[9px] text-slate-300">{event.location}</p>}
                          {recurrenceNote && <p className="text-[9px] text-slate-200/80">{recurrenceNote}</p>}
                          <div className="flex gap-1.5 text-[9px] font-semibold uppercase">
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
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">— Free —</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarMonthGrid({
  events,
  range,
  currentMonthStart,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  currentMonthStart: Date;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string | undefined) => void;
  editingId: string | null;
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-2.5">
      <div className="grid grid-cols-7 gap-1.5 text-xs uppercase tracking-[0.3em] text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label} className="text-center font-semibold">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex-1 overflow-auto space-y-1.5 pr-1">
        {weeks.map((week, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-1.5">
            {week.map((day) => {
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
              const preview = dayEvents.slice(0, 3);
              const remaining = dayEvents.length - preview.length;
              const inCurrentMonth = isSameMonth(day, currentMonthStart);
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`flex min-h-[95px] flex-col rounded-xl border p-1.5 ${
                    today
                      ? "border-sky-400/70 bg-slate-950/70"
                      : "border-white/5 bg-slate-950/40"
                  } ${inCurrentMonth ? "text-white" : "text-slate-500/80"}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{format(day, "d")}</span>
                    {today && (
                      <span className="rounded-full bg-sky-500/30 px-1.5 py-[2px] text-[9px] text-sky-50">Today</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex-1 space-y-1 overflow-hidden">
                    {preview.length ? (
                      preview.map((event) => {
                        const recurrenceNote = describeRecurrence(event.recurrence?.[0]);
                        return (
                          <div
                            key={event.id}
                            className="space-y-0.5 rounded-lg border border-sky-400/30 bg-sky-400/10 p-1.5 text-xs text-white/90"
                          >
                            <p className="font-semibold">{event.summary || "(untitled)"}</p>
                            <p className="text-[9px] uppercase tracking-wide text-slate-200">
                              {formatEventRange(event)}
                            </p>
                            {recurrenceNote && <p className="text-[9px] text-slate-200/80">{recurrenceNote}</p>}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500">—</p>
                    )}
                  </div>
                  {remaining > 0 && (
                    <p className="pt-1 text-[9px] uppercase tracking-[0.3em] text-slate-500">+{remaining} more</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
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
