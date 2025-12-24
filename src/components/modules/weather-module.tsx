"use client";

import { useEffect } from "react";
import { useWeather } from "@/hooks/useWeather";
import { format } from "date-fns";
import { useErrorLog } from "@/context/error-log";

export function WeatherModule() {
  const { daily, current, isLoading, error, lastUpdated } = useWeather(4);
  const { logError } = useErrorLog();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayIndex = daily.findIndex((day) => day.date === todayKey);
  const orderedDaily =
    todayIndex > 0 ? [...daily.slice(todayIndex), ...daily.slice(0, todayIndex)] : daily;
  const displayedDays = orderedDaily.slice(0, 4);
  const lastUpdatedLabel = lastUpdated ? format(new Date(lastUpdated), "MMM d, h:mma") : null;

  useEffect(() => {
    if (error) {
      logError("Weather forecast", new Error(error));
    }
  }, [error, logError]);

  return (
    <section className="w-full rounded-2xl border border-[#1f2a44] bg-gradient-to-br from-[#050a16] via-[#081021] to-[#03050b] p-4 text-sm text-[#dce5ff] shadow-inner shadow-[#060b15]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#7d8fca]">Weather</p>
            <p className="text-lg font-semibold text-white">Today</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-white">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-[#7d8fca]">Now</p>
              {current ? (
                <>
                  <p className="text-2xl font-semibold">{current.temperature}{"\u00B0F"}</p>
                  <p className="text-xs text-[#b0c0ff]">{current.description}</p>
                </>
              ) : (
                <p className="text-xs text-[#94a8dd]">No current data</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-[#8ea2dc]">
          <span>Last updated {lastUpdatedLabel ? lastUpdatedLabel : "—"}</span>
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-100">
          <p className="text-sm font-semibold">Unable to load weather</p>
          <p className="text-red-200">{error}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.3em] text-red-100/80">
            Auto-refresh will retry soon.
          </p>
        </div>
      )}
      {displayedDays.length > 0 && (
        <div className="mt-4 flex gap-3 text-xs text-[#cbd7ff]">
          {displayedDays.map((day, index) => (
            <div key={day.date} className="flex-1 rounded-xl border border-[#1f2a44] bg-[#0c152c] p-3 text-center">
              <p className="text-[0.7rem] uppercase tracking-wide text-[#7d8fca]">
                {index === 0 ? "Today" : format(new Date(`${day.date}T12:00:00`), "EEE")}
              </p>
              <p className="text-base font-semibold text-white">{day.max}{"\u00B0F"}</p>
              <p className="text-[0.7rem] text-[#9fb4ff]">Low {day.min}{"\u00B0F"}</p>
              {typeof day.precipitation === "number" && day.precipitation > 0 && (
                <p className="mt-1 text-[0.65rem] text-sky-300">{day.precipitation}% rain</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
