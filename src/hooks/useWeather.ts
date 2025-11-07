"use client";

import { useEffect, useState } from "react";

export type WeatherDay = {
  date: string;
  max: number;
  min: number;
  precipitation?: number | null;
};

export function useWeather(days = 7) {
  const [daily, setDaily] = useState<WeatherDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather?days=${days}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load weather data");
        const parsed = parseWeather(payload);
        if (!cancelled) {
          setDaily(parsed);
          setLastUpdated(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    const shouldRefresh = !lastUpdated || Date.now() - lastUpdated >= 4 * 60 * 60 * 1000;
    if (shouldRefresh) {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, [days, lastUpdated]);

  return { daily, isLoading, error };
}

function parseWeather(payload: any): WeatherDay[] {
  const times: string[] = payload?.daily?.time || [];
  const maxes: number[] = payload?.daily?.temperature_2m_max || [];
  const mins: number[] = payload?.daily?.temperature_2m_min || [];
  const precip: number[] = payload?.daily?.precipitation_probability_max || [];
  return times.map((time, index) => ({
    date: time,
    max: toFahrenheit(maxes[index]),
    min: toFahrenheit(mins[index]),
    precipitation: precip[index],
  }));
}

function toFahrenheit(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.round((value * 9) / 5 + 32);
}
