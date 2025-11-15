"use client";

import { useWeather } from "@/hooks/useWeather";
import { format } from "date-fns";

export function WeatherModule() {
  const { daily, current, isLoading, error } = useWeather(4);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayIndex = daily.findIndex((day) => day.date === todayKey);
  const orderedDaily =
    todayIndex > 0 ? [...daily.slice(todayIndex), ...daily.slice(0, todayIndex)] : daily;
  const displayedDays = orderedDaily.slice(0, 4);

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-white/80 shadow-inner">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Weather</p>
          <p className="text-lg font-semibold text-white">Today</p>
        </div>
        <div className="text-right text-white">
          <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/60">Now</p>
          {current ? (
            <>
              <p className="text-2xl font-semibold">{current.temperature}{"\u00B0F"}</p>
              <p className="text-xs text-white/70">{current.description}</p>
            </>
          ) : (
            <p className="text-xs text-white/60">No current data</p>
          )}
        </div>
      </div>
      {isLoading && <p className="mt-2 text-xs text-white/60">Loading forecast...</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {!isLoading && !error && (
        <div className="mt-4 flex gap-3 text-xs text-white/70">
          {displayedDays.map((day, index) => (
            <div key={day.date} className="flex-1 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-center">
              <p className="text-[0.7rem] uppercase tracking-wide text-white/60">
                {index === 0 ? "Today" : format(new Date(`${day.date}T12:00:00`), "EEE")}
              </p>
              <p className="text-base font-semibold text-white">{day.max}{"\u00B0F"}</p>
              <p className="text-[0.7rem] text-white/60">Low {day.min}{"\u00B0F"}</p>
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
