"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useWeather, WeatherDay } from "@/hooks/useWeather";
import { useErrorLog } from "@/context/error-log";

type LockedFullDayOutfit = {
  date: string;
  recommendation: string;
};

const FULL_DAY_OUTFIT_STORAGE_KEY = "weather-full-day-outfit-v3";

export function WeatherModule() {
  const { daily, current, error, lastUpdated } = useWeather(4);
  const { logError } = useErrorLog();
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayIndex = daily.findIndex((day) => day.date === todayKey);
  const orderedDaily =
    todayIndex > 0 ? [...daily.slice(todayIndex), ...daily.slice(0, todayIndex)] : daily;
  const todayForecast = orderedDaily.find((day) => day.date === todayKey) ?? orderedDaily[0] ?? null;
  const futureDays = orderedDaily.filter((day) => day.date !== todayForecast?.date).slice(0, 3);
  const calculatedFullDayRecommendation = todayForecast ? getFullDayRecommendation(todayForecast) : null;
  const [lockedFullDayOutfit, setLockedFullDayOutfit] = useState<LockedFullDayOutfit | null>(null);
  const lastUpdatedLabel = lastUpdated ? format(new Date(lastUpdated), "MMM d, h:mma") : null;
  const fullDayRecommendation =
    todayForecast && lockedFullDayOutfit?.date === todayForecast.date
      ? lockedFullDayOutfit.recommendation
      : calculatedFullDayRecommendation;

  useEffect(() => {
    if (error) {
      logError("Weather forecast", new Error(error));
    }
  }, [error, logError]);

  useEffect(() => {
    function syncLockedOutfit() {
      if (!todayForecast?.date || !calculatedFullDayRecommendation || typeof window === "undefined") {
        return;
      }

      const storedOutfit = readLockedSchoolDayOutfit();
      if (storedOutfit?.date === todayForecast.date) {
        setLockedFullDayOutfit(storedOutfit);
        return;
      }

      const nextLockedOutfit = {
        date: todayForecast.date,
        recommendation: calculatedFullDayRecommendation,
      };
      window.localStorage.setItem(FULL_DAY_OUTFIT_STORAGE_KEY, JSON.stringify(nextLockedOutfit));
      setLockedFullDayOutfit(nextLockedOutfit);
    }

    syncLockedOutfit();
  }, [todayForecast?.date, calculatedFullDayRecommendation]);

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
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-[#7d8fca]">Updated</p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-[#8ea2dc]">
                {lastUpdatedLabel ? lastUpdatedLabel : "-"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl border border-[#263856] bg-[rgba(15,29,52,0.88)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#8ea2dc]">Now</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {current ? `${current.temperature}\u00B0` : "N/A"}
              </p>
              <p className="mt-1 text-sm text-[#b0c0ff]">
                {current?.description ?? describeDay(todayForecast)}
              </p>
              <p className="mt-1 text-sm font-medium text-[#9fb4ff]">{getFullDayWindSummary(todayForecast)}</p>
            </div>
            <div className="rounded-xl border border-[#344a6e] bg-[rgba(5,10,22,0.97)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#b8ccee]">High / Low</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {todayForecast.max}{"\u00B0"} / {todayForecast.min}{"\u00B0"}
              </p>
              <p className="mt-1 text-sm text-[#b0c0ff]">{describeDay(todayForecast)}</p>
              <p className="mt-3 text-xs text-[#9fb4ff]">{getFullDayPrecipitationSummary(todayForecast)}</p>
            </div>
            <div className="rounded-xl border border-[#263856] bg-[rgba(15,29,52,0.88)] p-3">
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#8ea2dc]">What To Wear</p>
              {fullDayRecommendation ? (
                <p className="mt-3 text-lg font-semibold leading-snug text-white">{fullDayRecommendation}</p>
              ) : (
                <p className="mt-2 text-sm font-semibold text-white">No outfit data</p>
              )}
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

function readLockedSchoolDayOutfit() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(FULL_DAY_OUTFIT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as LockedFullDayOutfit;
    if (!parsed?.date || !parsed?.recommendation) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getPrecipitationLabel(day: {
  rainSum?: number | null;
  snowfallSum?: number | null;
  code?: number | null;
}) {
  if (typeof day.snowfallSum === "number" && day.snowfallSum > 0) return "Snow";
  if (typeof day.rainSum === "number" && day.rainSum > 0) return "Rain";
  if (isSnowCode(day.code)) return "Snow";
  if (isRainCode(day.code) || isStormCode(day.code)) {
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

function getFullDayPrecipitationSummary(
  day: Pick<WeatherDay, "precipitation" | "rainSum" | "snowfallSum" | "code" | "fullDay">
) {
  const precipitation = day.fullDay?.precipitation ?? day.precipitation;
  if (typeof precipitation !== "number") return "Precipitation chance unavailable";
  return `${getPrecipitationLabel(day.fullDay ?? day)} chance ${precipitation}%`;
}

function getFullDayWindSummary(day: Pick<WeatherDay, "fullDay">) {
  const windSpeed = day.fullDay?.windSpeed;
  if (typeof windSpeed !== "number") return "Wind info unavailable";
  if (windSpeed >= 20) return `Windy at ${windSpeed} mph`;
  if (windSpeed >= 10) return `Breezy at ${windSpeed} mph`;
  return `Light wind at ${windSpeed} mph`;
}

function getFullDayRecommendation(
  day: Pick<
    WeatherDay,
    "min" | "max" | "precipitation" | "rainSum" | "snowfallSum" | "code" | "fullDay"
  >
) {
  const coolestTemperature = day.fullDay?.minTemperature ?? day.min;
  const warmestTemperature = day.fullDay?.maxTemperature ?? day.max;
  const startTemperature = day.fullDay?.startTemperature ?? coolestTemperature;
  const middayTemperature =
    day.fullDay?.middayTemperature ?? Math.round((coolestTemperature + warmestTemperature) / 2);
  const precipitation = day.fullDay?.precipitation ?? day.precipitation ?? 0;
  const windSpeed = day.fullDay?.windSpeed ?? 0;
  const code = day.fullDay?.code ?? day.code ?? null;
  const temperatureSwing = warmestTemperature - coolestTemperature;
  const isSnow = isSnowCode(code) || (typeof day.snowfallSum === "number" && day.snowfallSum > 0);
  const isStormy = isStormCode(code);
  const isRainy = isRainCode(code) || (typeof day.rainSum === "number" && day.rainSum > 0);
  const isWet =
    isSnow ||
    isRainy ||
    isStormy ||
    precipitation >= 50;
  const isHotAllDay = coolestTemperature >= 70 && middayTemperature >= 80 && !isWet;
  const isWarmAllDay = coolestTemperature >= 62 && middayTemperature >= 74 && !isWet;
  const isWarmMidday = middayTemperature >= 72;
  const isHotMidday = middayTemperature >= 80;
  const isHotLater = warmestTemperature >= 82 || middayTemperature >= 78;
  const isWindy = windSpeed >= 15;
  const isVeryWindy = windSpeed >= 25;
  const needsJacketForSwing = temperatureSwing >= 15;
  const isCoolStart = startTemperature <= 48;
  const isColdDay = coolestTemperature <= 35 || warmestTemperature <= 45;
  const isVeryColdDay = coolestTemperature <= 15 || warmestTemperature <= 30;
  const shouldSkipJacketForWarmDay =
    !isWet &&
    !isSnow &&
    !isVeryWindy &&
    isHotLater &&
    middayTemperature >= 74 &&
    startTemperature >= 50;

  let shirt = "T-shirt";
  let bottoms = "pants";
  let jacket: string | null = null;

  if (isHotAllDay && !isWindy) {
    shirt = "T-shirt";
    bottoms = "shorts";
  } else if (isWarmAllDay || isHotMidday) {
    shirt = "T-shirt";
    bottoms = coolestTemperature >= 65 && !isWindy && precipitation < 30 ? "shorts" : "pants";
  } else if (!isWet && isWarmMidday) {
    shirt = "T-shirt";
    bottoms = "pants";
  }

  if (bottoms === "shorts" && (isWet || isWindy || coolestTemperature < 65)) {
    bottoms = "pants";
  }

  if (isVeryColdDay) {
    shirt = "Warm long sleeves";
    bottoms = "pants";
    jacket = "a heavy coat";
  } else if (isSnow) {
    shirt = coolestTemperature <= 20 ? "Warm long sleeves" : "T-shirt";
    bottoms = "pants";
    jacket = coolestTemperature <= 28 ? "a heavy coat" : "a jacket";
  } else if (isColdDay) {
    shirt = coolestTemperature <= 22 ? "Long sleeves" : "T-shirt";
    bottoms = "pants";
    jacket = coolestTemperature <= 28 || isVeryWindy || isWet ? "a heavy coat" : "a jacket";
  } else if (isWet) {
    bottoms = "pants";
    jacket = coolestTemperature <= 55 || isStormy || precipitation >= 70 ? "a jacket" : "a light jacket";
  } else if (isVeryWindy) {
    jacket = coolestTemperature <= 50 ? "a jacket" : "a light jacket";
  } else if (shouldSkipJacketForWarmDay) {
    jacket = null;
  } else if (isWindy || needsJacketForSwing || isCoolStart) {
    if (isHotLater && windSpeed < 20 && startTemperature >= 50) {
      jacket = null;
    } else {
      jacket = startTemperature <= 42 || middayTemperature < 66 ? "a jacket" : "a light jacket";
    }
  }

  if (!jacket && middayTemperature <= 55) {
    jacket = "a jacket";
  }

  if (!jacket && bottoms === "shorts" && coolestTemperature < 68) {
    bottoms = "pants";
  }

  if (!isVeryColdDay && shirt === "Long sleeves" && middayTemperature >= 62) {
    shirt = "T-shirt";
  }

  if (!isWet && !jacket && middayTemperature >= 78 && coolestTemperature >= 60 && !isWindy) {
    bottoms = "shorts";
  }

  return buildOutfitPhrase(shirt, bottoms, jacket);
}

function buildOutfitPhrase(shirt: string, bottoms: string, jacket: string | null) {
  if (shirt === "T-shirt" && bottoms === "shorts" && !jacket) {
    return "Shorts and a T-shirt";
  }
  if (!jacket) {
    return `${shirt} and ${bottoms}`;
  }
  return `${shirt}, ${bottoms}, and ${jacket}`;
}

function isSnowCode(code?: number | null) {
  return typeof code === "number" && [71, 73, 75, 77, 85, 86].includes(code);
}

function isRainCode(code?: number | null) {
  return typeof code === "number" && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
}

function isStormCode(code?: number | null) {
  return typeof code === "number" && [95, 96, 99].includes(code);
}
