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
  addDays,
} from "date-fns";
import { useWeather, WeatherDay } from "@/hooks/useWeather";

type CalendarEvent = {
  id: string;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { date?: string | null; dateTime?: string | null }; 
  end?: { date?: string | null; dateTime?: string | null };
  recurrence?: string[] | null;
  recurringEventId?: string | null;
};

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";

type NewEventState = {
  summary: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
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

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];
const MERIDIEMS: Array<"AM" | "PM"> = ["AM", "PM"];

function createDefaultEvent(): NewEventState {
  const start = nextRoundedDate();
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    summary: "",
    description: "",
    start: toInputValue(start),
    end: toInputValue(end),
    allDay: false,
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

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function dateStringToDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
}

function ensureDateInputFormat(value: string, fallback: Date) {
  if (!value) return toDateInputValue(fallback);
  if (value.length > 10) {
    return toDateInputValue(new Date(value));
  }
  return value;
}

function ensureDateTimeInputFormat(value: string, fallback: Date) {
  if (!value) return toInputValue(fallback);
  if (value.length <= 10) {
    const parsed = dateStringToDate(value) ?? fallback;
    return toInputValue(parsed);
  }
  return value;
}

function exclusiveDateToInput(value?: string | null) {
  if (!value) return "";
  const date = dateStringToDate(value);
  if (!date) return "";
  const inclusive = addDays(date, -1);
  return format(inclusive, "yyyy-MM-dd");
}

function inclusiveDateToExclusive(value: string) {
  const date = dateStringToDate(value);
  if (!date) throw new Error(`Invalid date: ${value}`);
  const exclusive = addDays(date, 1);
  return format(exclusive, "yyyy-MM-dd");
}

function getWeatherForDate(map: Map<string, WeatherDay>, date: Date) {
  return map.get(format(date, "yyyy-MM-dd"));
}

function splitDateTime(value: string) {
  const date = value ? format(new Date(value), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  const jsDate = new Date(value || date);
  let hours = jsDate.getHours();
  const meridiem: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hour = String(hours).padStart(2, "0");
  const minute = String(jsDate.getMinutes()).padStart(2, "0").replace(/^(\d)$/, "0$1");
  return { date, hour, minute: minute.padStart(2, "0"), meridiem };
}

function buildDateTime(date: string, hour: string, minute: string, meridiem: "AM" | "PM") {
  let hours = Number(hour);
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const base = date ? new Date(`${date}T00:00:00`) : new Date();
  base.setHours(hours, Number(minute) || 0, 0, 0);
  return toInputValue(base);
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
  const { daily: weatherDaily } = useWeather(14);
  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherDay>();
    weatherDaily.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [weatherDaily]);

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
        allDay: newEvent.allDay,
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
    const isAllDayEvent = Boolean(event.start?.date && !event.start?.dateTime);
    let targetId = event.id;
    if (event.recurringEventId && typeof window !== "undefined") {
      const editSeries = window.confirm(
        "Edit entire series? Select OK for the entire series, Cancel for just this event."
      );
      if (editSeries) {
        targetId = event.recurringEventId;
      }
    }
    setEditingId(targetId);
    setNewEvent({
      summary: event.summary ?? "",
      description: event.description ?? "",
      start: isAllDayEvent ? event.start?.date ?? "" : toInputValue(start),
      end: isAllDayEvent
        ? (exclusiveDateToInput(event.end?.date ?? event.start?.date ?? "") ?? event.start?.date ?? "")
        : toInputValue(end),
      allDay: isAllDayEvent,
      recurrenceFrequency: recurrence.frequency,
      recurrenceInterval: recurrence.interval,
    });
    setIsComposerModalOpen(true);
  };

  const handleDelete = async (event: CalendarEvent) => {
    const baseId = event.id;
    if (!baseId) return;
    let targetId = baseId;
    if (event.recurringEventId && typeof window !== "undefined") {
      const deleteSeries = window.confirm(
        "Delete entire series? Click OK for entire series, Cancel for just this event."
      );
      if (deleteSeries) {
        targetId = event.recurringEventId;
      }
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete ${targetId === event.recurringEventId ? "the entire series" : "this event"}?`
      );
      if (!confirmed) return;
    }
    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete event");
      if (editingId === targetId) {
        resetForm();
      }
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const effectiveViewMode = expanded ? viewMode : "week";
  const visibleEvents = events;
  const overflow = 0;
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

  const handleAllDayToggle = (checked: boolean) => {
    setNewEvent((prev) => {
      if (checked) {
        const baseStart = ensureDateInputFormat(prev.start, new Date());
        const baseEnd = ensureDateInputFormat(prev.end, new Date());
        return {
          ...prev,
          allDay: true,
          start: baseStart,
          end: baseEnd || baseStart,
        };
      }
      const fallbackStart = nextRoundedDate();
      const fallbackEnd = new Date(fallbackStart.getTime() + 30 * 60 * 1000);
      return {
        ...prev,
        allDay: false,
        start: ensureDateTimeInputFormat(prev.start, fallbackStart),
        end: ensureDateTimeInputFormat(prev.end, fallbackEnd),
      };
    });
  };

  const dashboardWeather = !expanded ? getWeatherForDate(weatherByDate, range.start) : null;
  const startTimeParts = splitDateTime(newEvent.start || toInputValue(new Date()));
  const endTimeParts = splitDateTime(newEvent.end || toInputValue(new Date()));
  const startDateValue = ensureDateInputFormat(newEvent.start, new Date());
  const endDateValue = ensureDateInputFormat(newEvent.end, new Date());

  const updateDateControl = (
    field: "start" | "end",
    updates: Partial<{ date: string; hour: string; minute: string; meridiem: "AM" | "PM" }>
  ) => {
    setNewEvent((prev) => {
      if (prev.allDay) {
        if (!updates.date) return prev;
        return field === "start" ? { ...prev, start: updates.date } : { ...prev, end: updates.date };
      }
      const currentValue = field === "start" ? prev.start : prev.end;
      const parts = splitDateTime(currentValue);
      const nextParts = {
        date: updates.date ?? parts.date,
        hour: updates.hour ?? parts.hour,
        minute: updates.minute ?? parts.minute,
        meridiem: updates.meridiem ?? parts.meridiem,
      };
      const nextValue = buildDateTime(nextParts.date, nextParts.hour, nextParts.minute, nextParts.meridiem);
      return field === "start" ? { ...prev, start: nextValue } : { ...prev, end: nextValue };
    });
  };

  return (
    <>
      <ModuleCard
      title="Calendar"
      accent="from-sky-500/40 to-blue-500/10"
      className={expanded ? "min-h-0 w-full text-sm" : "min-h-0 w-full text-xs"}
      contentClassName={expanded ? "gap-4" : "gap-3"}
      actions={
        <div className="flex w-full flex-col gap-3 text-sm text-white/80 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsComposerModalOpen(true);
              }}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
            >
              Add event
            </button>
            {onToggleExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="rounded-full border border-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
              >
                {expanded ? "Dashboard view" : "Calendar view"}
              </button>
            )}
          </div>

          {expanded && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-full border border-white/20 p-0.5">
                {(["week", "month"] as Array<"week" | "month">).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === mode ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                    }`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === "week" ? "Week" : "Month"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/20 px-2 py-1 text-xs uppercase tracking-wide text-white/70">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/30"
                  aria-label="Previous period"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full bg-white/5 px-3 py-1 text-white transition hover:bg-white/20"
                >
                  Jump to today
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/30"
                  aria-label="Next period"
                >
                  ›
                </button>
              </div>
            </div>
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
        weatherByDate={weatherByDate}
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
                <div className="space-y-2">
                  <input
                    type="date"
                    className="calendar-field w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                    value={newEvent.allDay ? startDateValue : startTimeParts.date}
                    onChange={(event) => updateDateControl("start", { date: event.target.value })}
                    required
                  />
                  {!newEvent.allDay && (
                    <div className="grid grid-cols-3 gap-2 sm:max-w-xs">
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={startTimeParts.hour}
                        onChange={(event) => updateDateControl("start", { hour: event.target.value })}
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={startTimeParts.minute}
                        onChange={(event) => updateDateControl("start", { minute: event.target.value })}
                      >
                        {MINUTE_OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            :{minute}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={startTimeParts.meridiem}
                        onChange={(event) => updateDateControl("start", { meridiem: event.target.value as "AM" | "PM" })}
                      >
                        {MERIDIEMS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">End</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    className="calendar-field w-full rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-2 text-white outline-none focus:border-white/40"
                    value={newEvent.allDay ? endDateValue : endTimeParts.date}
                    onChange={(event) => updateDateControl("end", { date: event.target.value })}
                    required
                  />
                  {!newEvent.allDay && (
                    <div className="grid grid-cols-3 gap-2 sm:max-w-xs">
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={endTimeParts.hour}
                        onChange={(event) => updateDateControl("end", { hour: event.target.value })}
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={endTimeParts.minute}
                        onChange={(event) => updateDateControl("end", { minute: event.target.value })}
                      >
                        {MINUTE_OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            :{minute}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-2xl border border-white/15 bg-slate-900/60 px-2 py-2 text-white outline-none focus:border-white/40"
                        value={endTimeParts.meridiem}
                        onChange={(event) => updateDateControl("end", { meridiem: event.target.value as "AM" | "PM" })}
                      >
                        {MERIDIEMS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-white">
              <input
                type="checkbox"
                checked={newEvent.allDay}
                onChange={(event) => handleAllDayToggle(event.target.checked)}
                className="h-4 w-4 rounded border border-white/40 bg-transparent text-sky-400 focus:ring-sky-500"
              />
              <span>All day event</span>
            </label>

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
  weatherByDate,
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
  weatherByDate: Map<string, WeatherDay>;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
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
        weatherByDate={weatherByDate}
        onEdit={onEdit}
        onDelete={onDelete}
        editingId={editingId}
      />
    );
  }

  if (expanded) {
    return (
      <CalendarWeekGrid
        events={events}
        range={range}
        weatherByDate={weatherByDate}
        onEdit={onEdit}
        onDelete={onDelete}
        editingId={editingId}
      />
    );
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
                  onClick={() => onDelete(event)}
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
  weatherByDate,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  weatherByDate: Map<string, WeatherDay>;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
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
            const weather = getWeatherForDate(weatherByDate, day);

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
                      <p className="text-[0.6rem] uppercase tracking-wide text-slate-200">{formatEventRange(event)}</p>
                      {event.location && <p className="text-[0.6rem] text-slate-300">{event.location}</p>}
                      {recurrenceNote && <p className="text-[0.6rem] text-slate-200/80">{recurrenceNote}</p>}
                      <div className="flex gap-1.5 text-[0.6rem] font-semibold uppercase">
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
                          onClick={() => onDelete(event)}
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
                  {weather && (
                    <div className="mt-1 text-[0.7rem] text-white/70">
                      <p>
                        {weather.max}°F / {weather.min}°F
                      </p>
                      {typeof weather.precipitation === "number" && weather.precipitation > 0 && (
                        <p>{weather.precipitation}% rain</p>
                      )}
                    </div>
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
  weatherByDate,
  onEdit,
  onDelete,
  editingId,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  currentMonthStart: Date;
  weatherByDate: Map<string, WeatherDay>;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
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
              const weather = getWeatherForDate(weatherByDate, day);

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
                      <span className="rounded-full bg-sky-500/30 px-1.5 py-0.5 text-[0.6rem] text-sky-50">Today</span>
                    )}
                  </div>
                  {weather && (
                    <div className="mt-1 text-[0.65rem] text-white/70">
                      <p>
                        {weather.max}°F / {weather.min}°F
                      </p>
                      {typeof weather.precipitation === "number" && weather.precipitation > 0 && (
                        <p>{weather.precipitation}% rain</p>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                    {preview.length ? (
                      preview.map((event) => {
                        const recurrenceNote = describeRecurrence(event.recurrence?.[0]);
                        return (
                          <div
                            key={event.id}
                            className="space-y-0.5 rounded-lg border border-sky-400/30 bg-sky-400/10 p-1.5 text-xs text-white/90"
                          >
                            <p className="font-semibold">{event.summary || "(untitled)"}</p>
                            <p className="text-[0.6rem] uppercase tracking-wide text-slate-200">
                              {formatEventRange(event)}
                            </p>
                            {recurrenceNote && <p className="text-[0.6rem] text-slate-200/80">{recurrenceNote}</p>}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500">—</p>
                    )}
                  </div>
                  {remaining > 0 && (
                    <p className="pt-1 text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">+{remaining} more</p>
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
