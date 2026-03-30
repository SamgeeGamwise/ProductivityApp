"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { useWeather, WeatherDay } from "@/hooks/useWeather";
import { useErrorLog } from "@/context/error-log";

export function WeatherModule() {
  const { daily, current, error, lastUpdated } = useWeather(4);
  const { logError } = useErrorLog();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayIndex = daily.findIndex((day) => day.date === todayKey);
  const orderedDaily =
    todayIndex > 0 ? [...daily.slice(todayIndex), ...daily.slice(0, todayIndex)] : daily;
  const todayForecast = orderedDaily.find((day) => day.date === todayKey) ?? orderedDaily[0] ?? null;
  const futureDays = orderedDaily.filter((day) => day.date !== todayForecast?.date).slice(0, 3);
  const lastUpdatedLabel = lastUpdated ? format(new Date(lastUpdated), "MMM d, h:mma") : null;
  const todayPrecipitationLabel = todayForecast ? getPrecipitationLabel(todayForecast) : "Precipitation";

  useEffect(() => {
    if (error) {
      logError("Weather forecast", new Error(error));
    }
  }, [error, logError]);

  return (
    <section className="flex h-full w-full min-h-0 flex-col rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 text-sm text-[#dce5ff] shadow-[0_18px_50px_rgba(2,8,20,0.32)] backdrop-blur-xl lg:p-6">
      {todayForecast && (
        <div className="rounded-[1.4rem] border border-[#3a5278] bg-[linear-gradient(180deg,rgba(5,10,22,0.96),rgba(3,6,16,0.99))] p-4 lg:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#aabae0]">Weather</p>
              <p className="text-2xl font-semibold text-white lg:text-3xl">Today</p>
              <p className="mt-2 text-sm text-[#ccd8ff] lg:text-base">
                {current?.description ?? describeDay(todayForecast)}
              </p>
            </div>
            <div className="text-left text-white sm:text-right">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-[#aabae0]">Current</p>
              {current ? (
                <p className="text-4xl font-semibold lg:text-5xl">{current.temperature}{"\u00B0F"}</p>
              ) : (
                <p className="text-sm text-[#b8ccee]">No current data</p>
              )}
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-[#b8ccee]">
                Last updated {lastUpdatedLabel ? lastUpdatedLabel : "-"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[#344a6e] bg-[rgba(5,10,22,0.97)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#b8ccee]">Current Temp</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {current ? `${current.temperature}\u00B0` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border border-[#344a6e] bg-[rgba(5,10,22,0.97)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#b8ccee]">High / Low</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {todayForecast.max}{"\u00B0"} / {todayForecast.min}{"\u00B0"}
              </p>
            </div>
            <div className="rounded-xl border border-[#344a6e] bg-[rgba(5,10,22,0.97)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#b8ccee]">
                {todayPrecipitationLabel} Chance
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {typeof todayForecast.precipitation === "number" ? `${todayForecast.precipitation}%` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border border-[#344a6e] bg-[rgba(5,10,22,0.97)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#b8ccee]">What To Wear</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {getOutfitSuggestion(current?.temperature ?? todayForecast.max, todayForecast)}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-100">
          <p className="text-sm font-semibold">Unable to load weather</p>
          <p className="text-red-200">{error}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.3em] text-red-100/80">
            Automatic retry is in progress.
          </p>
        </div>
      )}

      {futureDays.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 text-xs text-[#dde6ff]">
          {futureDays.map((day) => (
            <div
              key={day.date}
              className="flex min-h-[7.5rem] min-w-[8.25rem] flex-1 flex-col justify-center rounded-xl border border-[#344a6e] bg-[rgba(4,8,18,0.96)] p-4 text-center lg:min-h-[8.5rem]"
            >
              <p className="text-[0.75rem] uppercase tracking-wide text-[#aabae0] lg:text-xs">
                {format(new Date(`${day.date}T12:00:00`), "EEE")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white lg:text-3xl">{day.max}{"\u00B0F"}</p>
              <p className="text-xs text-[#baccff] lg:text-sm">Low {day.min}{"\u00B0F"}</p>
              {typeof day.precipitation === "number" && day.precipitation > 0 && (
                <p className="mt-2 text-xs text-sky-300 lg:text-sm">
                  {getPrecipitationChanceLabel(day)} {day.precipitation}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getPrecipitationLabel(day: Pick<WeatherDay, "rainSum" | "snowfallSum" | "code">) {
  if (typeof day.snowfallSum === "number" && day.snowfallSum > 0) return "Snow";
  if (typeof day.rainSum === "number" && day.rainSum > 0) return "Rain";
  if (typeof day.code === "number" && [71, 73, 75, 77, 85, 86].includes(day.code)) return "Snow";
  if (typeof day.code === "number" && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(day.code)) {
    return "Rain";
  }
  return "Precipitation";
}

function getPrecipitationChanceLabel(day: Pick<WeatherDay, "rainSum" | "snowfallSum" | "code">) {
  return `${getPrecipitationLabel(day)} chance`;
}

function describeDay(day: Pick<WeatherDay, "code">) {
  switch (day.code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Foggy";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
    case 80:
    case 81:
    case 82:
      return "Rain";
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return "Snow";
    case 95:
    case 96:
    case 99:
      return "Thunderstorms";
    default:
      return "Conditions unavailable";
  }
}

function getOutfitSuggestion(
  temperature: number,
  day: Pick<WeatherDay, "rainSum" | "snowfallSum" | "code" | "precipitation">
) {
  const isWet =
    (typeof day.precipitation === "number" && day.precipitation >= 40) ||
    (typeof day.rainSum === "number" && day.rainSum > 0) ||
    (typeof day.snowfallSum === "number" && day.snowfallSum > 0);

  if (temperature <= 35) return isWet ? "Warm coat" : "Heavy coat";
  if (temperature <= 50) return isWet ? "Jacket" : "Jacket";
  if (temperature <= 65) return isWet ? "Light jacket" : "Long-sleeve shirt";
  if (temperature <= 78) return isWet ? "T-shirt and rain jacket" : "T-shirt and pants";
  return isWet ? "T-shirt and rain jacket" : "T-shirt and shorts";
}
