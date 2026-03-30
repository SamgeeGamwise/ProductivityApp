"use client";

import { useEffect, useState, useCallback } from "react";

export type WeatherDay = {
  date: string;
  max: number;
  min: number;
  precipitation?: number | null;
  precipitationSum?: number | null;
  rainSum?: number | null;
  snowfallSum?: number | null;
  code?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  fullDay?: WeatherFullDay | null;
};

export type WeatherCurrent = {
  temperature: number;
  description: string;
  code: number | null;
};

export type WeatherFullDay = {
  startTime: string | null;
  endTime: string | null;
  startTemperature: number | null;
  middayTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  code: number | null;
};

type WeatherApiResponse = {
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    rain_sum?: number[];
    snowfall_sum?: number[];
    weather_code?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    wind_speed_10m?: number[];
    weather_code?: number[];
  };
  current_weather?: {
    temperature?: number;
    weathercode?: number;
    description?: string;
  };
  error?: string;
};

const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const WEATHER_RETRY_DELAYS_MS = [15 * 1000, 30 * 1000, 60 * 1000];

export function useWeather(days = 7) {
  const [daily, setDaily] = useState<WeatherDay[]>([]);
  const [current, setCurrent] = useState<WeatherCurrent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;

    const clearRetryTimeout = () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
    };

    const scheduleRetry = () => {
      clearRetryTimeout();
      const retryDelay =
        WEATHER_RETRY_DELAYS_MS[Math.min(retryAttempt, WEATHER_RETRY_DELAYS_MS.length - 1)];
      retryAttempt += 1;
      retryTimeoutId = setTimeout(() => {
        retryTimeoutId = null;
        void load();
      }, retryDelay);
    };

    async function load() {
      clearRetryTimeout();
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?days=${days}`, { cache: "no-store" });
        const payloadText = await response.text();
        let payload: WeatherApiResponse | undefined;
        if (payloadText) {
          try {
            payload = JSON.parse(payloadText);
          } catch {
            throw new Error(`Weather API returned invalid data (HTTP ${response.status})`);
          }
        }
        if (!response.ok) {
          const reason = payload?.error || response.statusText || "Unable to load weather data";
          throw new Error(`${reason} (HTTP ${response.status})`);
        }
        const parsed = parseWeather(payload);
        if (!cancelled) {
          setDaily(parsed.daily);
          setCurrent(parsed.current);
          setLastUpdated(Date.now());
          retryAttempt = 0;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unexpected error loading weather");
          scheduleRetry();
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    const handleOnline = () => {
      retryAttempt = 0;
      void load();
    };

    void load();
    intervalId = setInterval(() => {
      retryAttempt = 0;
      void load();
    }, WEATHER_REFRESH_INTERVAL_MS);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      clearRetryTimeout();
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("online", handleOnline);
    };
  }, [days, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { daily, current, isLoading, error, lastUpdated, reload };
}

type ParsedWeather = {
  daily: WeatherDay[];
  current: WeatherCurrent | null;
};

function parseWeather(payload: WeatherApiResponse | null | undefined): ParsedWeather {
  const times: string[] = payload?.daily?.time ?? [];
  const maxes: number[] = payload?.daily?.temperature_2m_max ?? [];
  const mins: number[] = payload?.daily?.temperature_2m_min ?? [];
  const precip: number[] = payload?.daily?.precipitation_probability_max ?? [];
  const precipitationSums: number[] = payload?.daily?.precipitation_sum ?? [];
  const rainSums: number[] = payload?.daily?.rain_sum ?? [];
  const snowfallSums: number[] = payload?.daily?.snowfall_sum ?? [];
  const weatherCodes: number[] = payload?.daily?.weather_code ?? [];
  const sunrises: string[] = payload?.daily?.sunrise ?? [];
  const sunsets: string[] = payload?.daily?.sunset ?? [];
  const fullDayByDate = buildFullDayForecastMap(
    payload?.hourly?.time ?? [],
    payload?.hourly?.temperature_2m ?? [],
    payload?.hourly?.precipitation_probability ?? [],
    payload?.hourly?.wind_speed_10m ?? [],
    payload?.hourly?.weather_code ?? []
  );
  const daily = times.map((time, index) => ({
    date: time,
    max: toFahrenheit(maxes[index]),
    min: toFahrenheit(mins[index]),
    precipitation: precip[index],
    precipitationSum: toRoundedNumber(precipitationSums[index]),
    rainSum: toRoundedNumber(rainSums[index]),
    snowfallSum: toRoundedNumber(snowfallSums[index]),
    code: typeof weatherCodes[index] === "number" ? weatherCodes[index] : null,
    sunrise: sunrises[index] ?? null,
    sunset: sunsets[index] ?? null,
    fullDay: fullDayByDate.get(time) ?? null,
  }));

  const currentPayload = payload?.current_weather;
  const current: WeatherCurrent | null = currentPayload
    ? {
        temperature: toFahrenheit(currentPayload.temperature),
        code: typeof currentPayload.weathercode === "number" ? currentPayload.weathercode : null,
        description: currentPayload.description || describeWeatherCode(currentPayload.weathercode),
      }
    : null;

  return { daily, current };
}

function toFahrenheit(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.round((value * 9) / 5 + 32);
}

function toNullableFahrenheit(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round((value * 9) / 5 + 32);
}

function toRoundedNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function toWholeNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value);
}

function toMph(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value / 1.60934);
}

function buildFullDayForecastMap(
  times: string[],
  temperatures: number[],
  precipitationChances: number[],
  windSpeeds: number[],
  weatherCodes: number[]
) {
  const fullDayByDate = new Map<string, WeatherFullDay>();
  const groupedHours = new Map<
    string,
    Array<{
      time: string;
      hour: number;
      temperature: number | null;
      precipitation: number | null;
      windSpeed: number | null;
      code: number | null;
    }>
  >();

  times.forEach((time, index) => {
    const date = time.slice(0, 10);
    const hour = getHourFromTimestamp(time);
    if (hour === null) return;

    const hours = groupedHours.get(date) ?? [];
    hours.push({
      time,
      hour,
      temperature: toNullableFahrenheit(temperatures[index]),
      precipitation: toWholeNumber(precipitationChances[index]),
      windSpeed: toMph(windSpeeds[index]),
      code: typeof weatherCodes[index] === "number" ? weatherCodes[index] : null,
    });
    groupedHours.set(date, hours);
  });

  groupedHours.forEach((hours, date) => {
    const sortedHours = [...hours].sort((left, right) => left.hour - right.hour);
    const startEntry = [...sortedHours].sort(
      (left, right) =>
        getDayStartPriority(left.hour) - getDayStartPriority(right.hour)
    )[0];
    const middayEntry = [...sortedHours].sort(
      (left, right) =>
        getMiddayPriority(left.hour) - getMiddayPriority(right.hour)
    )[0];
    const temperaturesInRange = sortedHours
      .map((entry) => entry.temperature)
      .filter((value): value is number => typeof value === "number");
    const precipitationInRange = sortedHours
      .map((entry) => entry.precipitation)
      .filter((value): value is number => typeof value === "number");
    const windInRange = sortedHours
      .map((entry) => entry.windSpeed)
      .filter((value): value is number => typeof value === "number");
    const codesInRange = sortedHours.map((entry) => entry.code);

    fullDayByDate.set(date, {
      startTime: startEntry?.time ?? null,
      endTime: sortedHours.at(-1)?.time ?? null,
      startTemperature: startEntry?.temperature ?? null,
      middayTemperature: middayEntry?.temperature ?? null,
      minTemperature: temperaturesInRange.length ? Math.min(...temperaturesInRange) : null,
      maxTemperature: temperaturesInRange.length ? Math.max(...temperaturesInRange) : null,
      precipitation: precipitationInRange.length ? Math.max(...precipitationInRange) : null,
      windSpeed: windInRange.length ? Math.max(...windInRange) : null,
      code: pickFullDayCode(codesInRange),
    });
  });

  return fullDayByDate;
}

function getHourFromTimestamp(value: string) {
  const parsed = Number(value.slice(11, 13));
  return Number.isInteger(parsed) ? parsed : null;
}

function getDayStartPriority(hour: number) {
  if (hour === 8) return 0;
  if (hour === 7) return 1;
  if (hour === 9) return 2;
  if (hour === 6) return 3;
  return 10 + hour;
}

function getMiddayPriority(hour: number) {
  if (hour === 13) return 0;
  if (hour === 12) return 1;
  if (hour === 14) return 2;
  if (hour === 15) return 3;
  if (hour === 11) return 4;
  return 10 + Math.abs(hour - 13);
}

function pickFullDayCode(codes: Array<number | null>) {
  const validCodes = codes.filter((value): value is number => typeof value === "number");
  for (const code of validCodes) {
    if ([95, 96, 99].includes(code)) return code;
  }
  for (const code of validCodes) {
    if ([71, 73, 75, 77, 85, 86].includes(code)) return code;
  }
  for (const code of validCodes) {
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return code;
  }
  return validCodes[0] ?? null;
}

function describeWeatherCode(code: unknown) {
  const parsed = typeof code === "number" ? code : null;
  if (parsed === null) return "Conditions unavailable";
  const mapping: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Icy fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Light freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunder w/ hail",
    99: "Severe thunder w/ hail",
  };
  return mapping[parsed] || "Conditions unavailable";
}
