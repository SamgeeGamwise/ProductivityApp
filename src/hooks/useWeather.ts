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
};

export type WeatherCurrent = {
  temperature: number;
  description: string;
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
  current_weather?: {
    temperature?: number;
    weathercode?: number;
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
  }));

  const currentPayload = payload?.current_weather;
  const current: WeatherCurrent | null = currentPayload
    ? {
        temperature: toFahrenheit(currentPayload.temperature),
        code: typeof currentPayload.weathercode === "number" ? currentPayload.weathercode : null,
        description: describeWeatherCode(currentPayload.weathercode),
      }
    : null;

  return { daily, current };
}

function toFahrenheit(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.round((value * 9) / 5 + 32);
}

function toRoundedNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
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
