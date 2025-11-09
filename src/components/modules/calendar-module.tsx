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
  differenceInCalendarDays,
  differenceInCalendarMonths,
} from "date-fns";
import { useWeather, WeatherDay } from "@/hooks/useWeather";
import { ListItem, usePersistentList } from "@/hooks/usePersistentList";

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
const AUTO_EVENT_DURATION_MS = 60 * 60 * 1000;
const DEFAULT_EVENT_START_HOUR = 9;

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
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deleteScope, setDeleteScope] = useState<"single" | "future" | "series">("single");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeEditEvent, setActiveEditEvent] = useState<CalendarEvent | null>(null);
  const [activeDayDetail, setActiveDayDetail] = useState<Date | null>(null);
  const { daily: weatherDaily } = useWeather(14);
  const { items: todoItems } = usePersistentList("todo-items");
  const { items: choreItems } = usePersistentList("chore-items");
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
    const tomorrow = addDays(today, 1);
    return {
      start: startOfDay(today),
      end: endOfDay(tomorrow),
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
  const dashboardLabel = `${format(dayRange.start, "EEE, MMM d")} – ${format(dayRange.end, "EEE, MMM d")}`;
  const displayLabel = isExpandedMonthView
    ? format(monthRange.monthStart, "MMMM yyyy")
    : isDashboardDayView
      ? dashboardLabel
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
    setActiveEditEvent(null);
  };

  const openComposerForDate = useCallback((targetDate: Date) => {
    const start = new Date(targetDate);
    start.setHours(DEFAULT_EVENT_START_HOUR, 0, 0, 0);
    const end = new Date(start.getTime() + AUTO_EVENT_DURATION_MS);
    const template = createDefaultEvent();
    setEditingId(null);
    setActiveEditEvent(null);
    setNewEvent({
      ...template,
      start: toInputValue(start),
      end: toInputValue(end),
      allDay: false,
    });
    setIsComposerModalOpen(true);
  }, []);

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

  const openEditComposer = (event: CalendarEvent, targetId: string) => {
    const start = getEventDate(event.start) ?? new Date();
    const end = getEventDate(event.end) ?? new Date(start.getTime() + 30 * 60 * 1000);
    const recurrence = parseRecurrenceRule(event.recurrence?.[0]);
    const isAllDayEvent = Boolean(event.start?.date && !event.start?.dateTime);
    setActiveEditEvent(event);
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

  const handleEdit = (event: CalendarEvent) => {
    if (!event.id) return;
    const targetId = event.recurringEventId ?? event.id;
    openEditComposer(event, targetId);
  };

  const handleComposerDelete = () => {
    if (!activeEditEvent) return;
    const target = activeEditEvent;
    closeComposer();
    requestDelete(target);
  };


  const requestDelete = (event: CalendarEvent) => {
    setDeleteTarget(event);
    setDeleteScope("single");
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteScope("single");
    setDeleteError(null);
    setIsDeleting(false);
  };

  const onShowDayDetail = useCallback((date: Date) => {
    setActiveDayDetail(date);
  }, []);

  const closeDayDetail = useCallback(() => {
    setActiveDayDetail(null);
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    const body: Record<string, unknown> = { scope: deleteScope };
    if (deleteScope === "single") {
      body.id = deleteTarget.id;
    } else if (deleteScope === "series") {
      body.id = deleteTarget.recurringEventId ?? deleteTarget.id;
    } else {
      body.recurringEventId = deleteTarget.recurringEventId ?? deleteTarget.id;
      body.start = deleteTarget.start?.dateTime || deleteTarget.start?.date;
    }

    if ((deleteScope === "single" || deleteScope === "series") && !body.id) {
      setDeleteError("Missing event identifier");
      return;
    }
    if (deleteScope === "future" && (!body.recurringEventId || !body.start)) {
      setDeleteError("Missing recurring event details");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete event");
      const boundaryDate = deleteScope === "future" ? getEventDate(deleteTarget.start) : null;
      applyOptimisticDeletion(deleteScope, deleteTarget, boundaryDate);
      if (deleteTarget && editingId === deleteTarget.id) {
        resetForm();
      }
      closeDeleteModal();
      loadEvents();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsDeleting(false);
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
  const pendingTodos = useMemo(() => todoItems.filter((item) => !item.done), [todoItems]);
  const pendingChores = useMemo(() => choreItems.filter((item) => !item.done), [choreItems]);
  const dayDetailEvents = useMemo(() => {
    if (!activeDayDetail) return [];
    return events
      .filter((event) => {
        const start = getEventDate(event.start);
        return start && isSameDay(start, activeDayDetail);
      })
      .sort((a, b) => {
        const first = getEventDate(a.start)?.getTime() ?? 0;
        const second = getEventDate(b.start)?.getTime() ?? 0;
        return first - second;
      });
  }, [activeDayDetail, events]);
  const dayDetailLabel = activeDayDetail ? format(activeDayDetail, "EEEE, MMM d") : "";

  const handleAddFromDetail = useCallback(() => {
    if (!activeDayDetail) return;
    openComposerForDate(activeDayDetail);
    setActiveDayDetail(null);
  }, [activeDayDetail, openComposerForDate]);
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
        if (field === "start") {
          return { ...prev, start: updates.date, end: updates.date };
        }
        return { ...prev, end: updates.date };
      }
      const fallback = toInputValue(new Date());
      const currentValue = field === "start" ? prev.start || fallback : prev.end || fallback;
      const parts = splitDateTime(currentValue);
      const nextParts = {
        date: updates.date ?? parts.date,
        hour: updates.hour ?? parts.hour,
        minute: updates.minute ?? parts.minute,
        meridiem: updates.meridiem ?? parts.meridiem,
      };
      const nextValue = buildDateTime(nextParts.date, nextParts.hour, nextParts.minute, nextParts.meridiem);
      if (field === "start") {
        const shouldAutoAdjustEnd = Boolean(updates.date || updates.hour || updates.minute || updates.meridiem);
        let nextEndValue = prev.end;
        if (shouldAutoAdjustEnd) {
          const nextStartDate = new Date(nextValue);
          if (!Number.isNaN(nextStartDate.getTime())) {
            const autoEnd = new Date(nextStartDate.getTime() + AUTO_EVENT_DURATION_MS);
            nextEndValue = toInputValue(autoEnd);
          }
        }
        return { ...prev, start: nextValue, end: nextEndValue };
      }
      return { ...prev, end: nextValue };
    });
  };

  useEffect(() => {
    if (!deleteTarget?.recurringEventId && deleteScope !== "single") {
      setDeleteScope("single");
    }
  }, [deleteTarget, deleteScope]);

  const applyOptimisticDeletion = (
    scope: "single" | "future" | "series",
    target: CalendarEvent,
    boundaryDate?: Date | null
  ) => {
    setEvents((prev) =>
      prev.filter((event) => {
        if (scope === "single") {
          return event.id !== target.id;
        }
        if (scope === "series") {
          const seriesId = target.recurringEventId;
          if (!seriesId) return event.id !== target.id;
          return event.recurringEventId !== seriesId && event.id !== seriesId;
        }
        if (scope === "future") {
          const seriesId = target.recurringEventId;
          if (!seriesId) return event.id !== target.id;
          if (event.recurringEventId !== seriesId) return true;
          if (!boundaryDate) return event.id !== target.id;
          const eventDate = getEventDate(event.start);
          if (!eventDate) return true;
          return eventDate < boundaryDate;
        }
        return true;
      })
    );
  };

  return (
    <>
      <ModuleCard
      title="Calendar"
      accent="from-sky-500/40 to-blue-500/10"
      className={expanded ? "min-h-0 w-full text-sm" : "min-h-0 w-full text-xs"}
      contentClassName={expanded ? "gap-4 overflow-hidden" : "gap-3"}
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
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[0.65rem] font-bold leading-none text-white"
                >
                  +
                </span>
                <span>Add</span>
              </span>
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
            <p className="text-sm font-semibold text-white/80">{displayLabel}</p>
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
      {isLoading && <span className="mb-2 text-xs text-slate-400">Refreshing…</span>}

      {needsSetup && (
        <p className="mb-4 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-xs text-yellow-100">
          Calendar access is not configured yet. Add your Google service account secrets to <code>.env.local</code> (see README) to enable sync.
        </p>
      )}

      {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
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
            editingId={editingId}
            onCreateFromDate={openComposerForDate}
            todos={pendingTodos}
            chores={pendingChores}
            onShowDayDetail={onShowDayDetail}
          />
        </div>
      </div>
      </ModuleCard>
      {activeDayDetail && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDayDetail();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-sm text-white shadow-2xl shadow-black/60">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Day details</p>
                <h3 className="text-2xl font-semibold text-white">{dayDetailLabel}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddFromDetail}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/60"
                >
                  Add event
                </button>
                <button
                  type="button"
                  onClick={closeDayDetail}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/60 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto pr-2">
              {dayDetailEvents.length ? (
                <ul className="space-y-3">
                  {dayDetailEvents.map((event) => {
                    const recurrenceNote = describeRecurrence(event.recurrence?.[0]);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => handleEdit(event)}
                          disabled={!event.id}
                          className="w-full rounded-2xl border border-white/15 bg-slate-900/70 p-4 text-left transition hover:border-white/40 disabled:opacity-60"
                        >
                          <p className="text-base font-semibold">{event.summary || "(untitled)"}</p>
                          <p className="text-sm text-slate-300">{formatEventRange(event)}</p>
                          {event.description && <p className="mt-1 text-sm text-slate-400">{event.description}</p>}
                          {event.location && <p className="text-sm text-slate-500">{event.location}</p>}
                          {recurrenceNote && (
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{recurrenceNote}</p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No events scheduled for this day.</p>
              )}
            </div>
          </div>
        </div>
      )}
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
              <h3 className="text-2xl font-semibold text-white">
                {isEditing ? (
                  "Edit"
                ) : (
                  <span className="inline-flex items-center gap-3">
                    <span>Add</span>
                  </span>
                )}
              </h3>
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

            {!isEditing && (
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
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {isEditing && activeEditEvent && (
                <button
                  type="button"
                  onClick={handleComposerDelete}
                  className="w-full rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
                >
                  Delete
                </button>
              )}
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

    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/90 p-5 text-sm text-white shadow-2xl shadow-black/60">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Delete event</p>
            <h3 className="text-2xl font-semibold text-white">{deleteTarget.summary || "(untitled)"}</h3>
            <p className="text-xs text-white/60">
              {formatEventTime(deleteTarget.start)} – {formatEventTime(deleteTarget.end)}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Apply to</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  deleteScope === "single" ? "border-red-300 bg-red-300/20 text-white" : "border-white/20 text-white/70 hover:border-white/50"
                }`}
                onClick={() => setDeleteScope("single")}
              >
                This event
              </button>
              <button
                type="button"
                disabled={!deleteTarget.recurringEventId}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  deleteScope === "future" ? "border-red-300 bg-red-300/20 text-white" : "border-white/20 text-white/70 hover:border-white/50"
                } ${!deleteTarget.recurringEventId ? "cursor-not-allowed opacity-40" : ""}`}
                onClick={() => deleteTarget.recurringEventId && setDeleteScope("future")}
              >
                This & future
              </button>
              <button
                type="button"
                disabled={!deleteTarget.recurringEventId}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  deleteScope === "series" ? "border-red-300 bg-red-300/20 text-white" : "border-white/20 text-white/70 hover:border-white/50"
                } ${!deleteTarget.recurringEventId ? "cursor-not-allowed opacity-40" : ""}`}
                onClick={() => deleteTarget.recurringEventId && setDeleteScope("series")}
              >
                Entire series
              </button>
            </div>
          </div>
          {deleteError && <p className="mt-3 text-xs text-red-300">{deleteError}</p>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="w-full rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="w-full rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
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
  editingId,
  onCreateFromDate,
  todos,
  chores,
  onShowDayDetail,
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
  editingId: string | null;
  onCreateFromDate?: (date: Date) => void;
  todos: ListItem[];
  chores: ListItem[];
  onShowDayDetail?: (date: Date) => void;
}) {
  if (isLoading && !events.length) {
    return <p className="text-sm text-slate-400">Loading events…</p>;
  }

  if (expanded && !events.length) {
    return <p className="text-sm text-slate-400">No events scheduled for this period.</p>;
  }

  if (expanded && viewMode === "month" && currentMonthStart) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CalendarMonthGrid
          events={events}
          range={range}
          currentMonthStart={currentMonthStart}
          onEdit={onEdit}
          editingId={editingId}
          onCreateFromDate={onCreateFromDate}
          onShowDayDetail={onShowDayDetail}
        />
      </div>
    );
  }

  if (expanded) {
    return (
      <CalendarWeekGrid
        events={events}
        range={range}
        weatherByDate={weatherByDate}
        onEdit={onEdit}
        editingId={editingId}
        onCreateFromDate={onCreateFromDate}
      />
    );
  }

  const dashboardDays = [
    { label: "Today", date: startOfDay(range.start) },
    { label: "Tomorrow", date: startOfDay(addDays(range.start, 1)) },
  ];

  return (
    <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-2">
      {dashboardDays.map(({ label, date }) => {
        const dayEventEntries = events
          .filter((event) => {
            const start = getEventDate(event.start);
            return start && isSameDay(start, date);
          })
          .map((event) => ({
            type: "event" as const,
            event,
            timestamp: getEventDate(event.start)?.getTime() ?? 0,
          }));

        const todoEntries = todos
          .filter((todo) => isTodoDueOnDate(todo, date))
          .map((todo) => {
            const dueDate = getTodoDueDate(todo);
            return {
              type: "todo" as const,
              todo,
              dueDate,
              timestamp: dueDate?.getTime() ?? date.getTime() + 1,
            };
          });

        const choreEntries = chores
          .filter((chore) => isChoreDueOnDate(chore, date))
          .map((chore) => ({
            type: "chore" as const,
            chore,
            timestamp: date.getTime() + 2,
          }));

        const combinedEntries = [...dayEventEntries, ...todoEntries, ...choreEntries]
          .filter((entry) => entry.timestamp)
          .sort((a, b) => a.timestamp - b.timestamp);

        return (
          <div
            key={label}
            className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-950/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-400">{format(date, "MMM d")}</p>
            </div>
            {combinedEntries.length ? (
              <ul className="flex-1 space-y-2 overflow-auto pr-1 text-sm">
                {combinedEntries.map((entry) => {
                  if (entry.type === "event") {
                    const recurrenceNote = describeRecurrence(entry.event.recurrence?.[0]);
                    return (
                      <li key={entry.event.id}>
                        <div className="w-full rounded-xl border border-white/5 bg-slate-900/70 p-3 text-left">
                          <p className="text-base font-semibold text-white">{entry.event.summary || "(untitled)"}</p>
                          <p className="text-sm text-slate-300">
                            {formatEventTime(entry.event.start)} – {formatEventTime(entry.event.end)}
                          </p>
                          {entry.event.description && (
                            <p className="mt-1 overflow-hidden text-ellipsis text-sm text-slate-400">
                              {entry.event.description}
                            </p>
                          )}
                          {entry.event.location && <p className="text-sm text-slate-500">{entry.event.location}</p>}
                          {recurrenceNote && <p className="text-xs text-slate-400">{recurrenceNote}</p>}
                        </div>
                      </li>
                    );
                  }

                  if (entry.type === "todo") {
                    const dueLabel = entry.dueDate
                      ? todoHasExplicitTime(entry.todo)
                        ? format(entry.dueDate, "h:mma")
                        : "All day"
                      : null;

                    return (
                      <li key={`todo-${entry.todo.id}`}>
                        <div className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3">
                          <div className="mb-1 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-emerald-200">
                            <span>Todo</span>
                            {dueLabel && <span className="text-[0.6rem] tracking-wide">{dueLabel}</span>}
                          </div>
                          <p className="text-base font-semibold text-white">{entry.todo.label}</p>
                          {entry.todo.note && (
                            <p className="mt-1 text-xs text-emerald-100/80">{entry.todo.note}</p>
                          )}
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={`chore-${entry.chore.id}`}>
                      <div className="w-full rounded-xl border border-orange-400/40 bg-orange-500/10 p-3">
                        <div className="mb-1 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-orange-200">
                          <span>Chore</span>
                          <span className="text-[0.6rem] tracking-wide">
                            {getChoreFrequencyLabel(entry.chore)}
                          </span>
                        </div>
                        <p className="text-base font-semibold text-white">{entry.chore.label}</p>
                        {entry.chore.note && <p className="mt-1 text-xs text-orange-100/80">{entry.chore.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
                No events
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CalendarWeekGrid({
  events,
  range,
  weatherByDate,
  onEdit,
  editingId,
  onCreateFromDate,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  weatherByDate: Map<string, WeatherDay>;
  onEdit: (event: CalendarEvent) => void;
  editingId: string | null;
  onCreateFromDate?: (date: Date) => void;
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const weekHasWeather = days.some((day) => Boolean(getWeatherForDate(weatherByDate, day)));

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
            const isTodayCell = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`flex min-h-0 flex-col rounded-xl border p-1.5 transition border-white/5 bg-slate-950/50 cursor-pointer`}
                onClick={() => onCreateFromDate?.(day)}
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-0.5">
                  <p className="text-sm font-semibold text-white">{format(day, "EEE")}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>{format(day, "MMM d")}</span>
                    {isTodayCell && (
                      <span className="rounded-full bg-sky-500/30 px-2 py-[1px] text-[0.65rem] text-sky-50">Today</span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex-1 space-y-1.5 overflow-hidden">
                  {dayEvents.length ? (
                    dayEvents.map((calendarEvent) => {
                      const recurrenceNote = describeRecurrence(calendarEvent.recurrence?.[0]);
                      return (
                        <div
                          key={calendarEvent.id}
                          className="w-full space-y-0.5 rounded-lg border border-sky-400/30 bg-sky-400/10 p-2 text-left text-xs text-white/90"
                        >
                          <p className="font-semibold">{calendarEvent.summary || "(untitled)"}</p>
                          <p className="text-[0.6rem] uppercase tracking-wide text-slate-200">
                            {formatEventRange(calendarEvent)}
                          </p>
                          {calendarEvent.location && <p className="text-[0.6rem] text-slate-300">{calendarEvent.location}</p>}
                          {recurrenceNote && <p className="text-[0.6rem] text-slate-200/80">{recurrenceNote}</p>}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">— Free —</p>
                  )}
                  <div className="mt-1 min-h-[32px] text-[0.7rem] text-white/70">
                    {weather ? (
                      <>
                        <p>
                          {weather.max}°F / {weather.min}°F
                        </p>
                        {typeof weather.precipitation === "number" && weather.precipitation > 0 && (
                          <p>{weather.precipitation}% rain</p>
                        )}
                      </>
                    ) : (
                      <span className="text-transparent">placeholder</span>
                    )}
                  </div>
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
  editingId,
  onCreateFromDate,
  onShowDayDetail,
}: {
  events: CalendarEvent[];
  range: { start: Date; end: Date };
  currentMonthStart: Date;
  onEdit: (event: CalendarEvent) => void;
  editingId: string | null;
  onCreateFromDate?: (date: Date) => void;
  onShowDayDetail?: (date: Date) => void;
}) {
  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-white/5 bg-slate-900/60 p-2.5 lg:p-3">
      <div className="grid grid-cols-7 gap-1 text-[0.65rem] uppercase tracking-[0.25em] text-slate-400 lg:text-[0.7rem]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label} className="text-center font-semibold">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex-1 min-h-0 overflow-hidden">
        <div
          className="grid min-h-0 gap-1 overflow-auto pr-1"
          style={{
            gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.map((week, rowIndex) => (
            <div
              key={rowIndex}
              className="grid min-h-0 grid-cols-7 gap-1"
              style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
            >
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
                const inCurrentMonth = isSameMonth(day, currentMonthStart);
                const today = isToday(day);

                return (
                  <article
                    key={day.toISOString()}
                    className={`flex min-h-0 flex-col rounded-xl border p-2.5 transition-colors ${
                      today
                        ? "border-sky-400/70 bg-slate-950/75 shadow-lg shadow-sky-900/20"
                        : "border-white/5 bg-slate-950/55"
                    } ${inCurrentMonth ? "text-white" : "text-slate-500/80"}`}
                    onClick={() => onShowDayDetail?.(day)}
                    onDoubleClick={() => onCreateFromDate?.(day)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onShowDayDetail?.(day);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between text-[0.75rem] font-semibold">
                      <span className="text-base">{format(day, "d")}</span>
                      {today && (
                        <span className="rounded-full bg-sky-500/25 px-1.5 py-0.5 text-[0.6rem] text-sky-50">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex-1 min-h-0 space-y-1 overflow-y-auto pr-0.5">
                      {dayEvents.length ? (
                        dayEvents.map((calendarEvent) => {
                          const recurrenceNote = describeRecurrence(calendarEvent.recurrence?.[0]);
                          const isDisabled = !calendarEvent.id;
                          return (
                            <div
                              key={calendarEvent.id ?? `${day.toISOString()}-${calendarEvent.summary ?? "event"}`}
                              className={`w-full rounded-lg border px-2 py-1.5 text-left text-white ${
                                editingId === calendarEvent.id
                                  ? "border-sky-400/70 bg-sky-500/20"
                                  : "border-white/10 bg-white/5"
                              } ${isDisabled ? "opacity-60" : ""}`}
                            >
                              <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold">
                                <span className="truncate">{calendarEvent.summary || "(untitled)"}</span>
                                <span className="shrink-0 text-[0.6rem] uppercase tracking-wide text-slate-200">
                                  {formatEventRange(calendarEvent)}
                                </span>
                              </span>
                              {recurrenceNote && (
                                <span className="mt-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-slate-300">
                                  {recurrenceNote}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 text-[0.65rem] text-slate-500">
                          No events
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
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
  if (value?.date && !value?.dateTime) {
    return new Date(`${value.date}T12:00:00`);
  }
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

function getTodoDueDate(item: ListItem) {
  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const raw = typeof meta.dueDate === "string" ? meta.dueDate : null;
  if (!raw) return null;
  const source = raw.length <= 10 ? `${raw}T12:00:00` : raw;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function todoHasExplicitTime(item: ListItem) {
  const meta = (item.meta ?? {}) as Record<string, unknown>;
  if (typeof meta.hasTime === "boolean") return meta.hasTime;
  const raw = typeof meta.dueDate === "string" ? meta.dueDate : "";
  if (!raw) return false;
  return !raw.endsWith("T00:00:00");
}

function isTodoDueOnDate(item: ListItem, target: Date) {
  if (item.done) return false;
  const due = getTodoDueDate(item);
  if (!due) return false;
  return isSameDay(due, target);
}

function getChoreFrequencyLabel(item: ListItem) {
  if (item.note) return item.note;
  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const frequency = typeof meta.frequency === "string" ? meta.frequency : "";
  return frequency ? frequency.charAt(0).toUpperCase() + frequency.slice(1) : "Chore";
}

function isChoreDueOnDate(item: ListItem, target: Date) {
  if (item.done) return false;
  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const frequency = typeof meta.frequency === "string" ? meta.frequency : null;
  if (!frequency) return false;
  const normalizedTarget = startOfDay(target);
  const created = startOfDay(new Date(item.createdAt));
  if (Number.isNaN(normalizedTarget.getTime()) || Number.isNaN(created.getTime())) {
    return false;
  }

  switch (frequency) {
    case "daily":
      return true;
    case "weekly": {
      const dayLabel = format(normalizedTarget, "EEE");
      const days = Array.isArray(meta.weeklyDays) ? (meta.weeklyDays as string[]) : [];
      return days.includes(dayLabel);
    }
    case "monthly": {
      const day = Number(meta.monthlyDay) || 1;
      return normalizedTarget.getDate() === day;
    }
    case "custom": {
      const interval = Number(meta.customInterval) || 0;
      const unit = typeof meta.customUnit === "string" ? meta.customUnit : "days";
      if (interval <= 0) return false;
      if (unit === "months") {
        const diffMonths = differenceInCalendarMonths(normalizedTarget, created);
        return diffMonths >= 0 && diffMonths % interval === 0;
      }
      const diffDays = differenceInCalendarDays(normalizedTarget, created);
      if (diffDays < 0) return false;
      const span = unit === "weeks" ? interval * 7 : interval;
      if (span <= 0) return false;
      return diffDays % span === 0;
    }
    default:
      return false;
  }
}
