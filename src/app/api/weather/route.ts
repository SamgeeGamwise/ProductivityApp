import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LAT = "37.7749";
const DEFAULT_LON = "-122.4194";

type NormalizedWeatherResponse = {
  provider: "nws" | "open-meteo";
  location: {
    latitude: string;
    longitude: string;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: Array<number | null>;
    precipitation_sum: Array<number | null>;
    rain_sum: Array<number | null>;
    snowfall_sum: Array<number | null>;
    weather_code: Array<number | null>;
    sunrise: Array<string | null>;
    sunset: Array<string | null>;
  };
  hourly: {
    time: string[];
    temperature_2m: Array<number | null>;
    precipitation_probability: Array<number | null>;
    wind_speed_10m: Array<number | null>;
    weather_code: Array<number | null>;
  };
  current_weather: {
    temperature?: number;
    weathercode?: number | null;
    description?: string;
  } | null;
};

type NwsPointsResponse = {
  properties?: {
    forecastHourly?: string;
    observationStations?: string;
  };
};

type NwsForecastHourlyResponse = {
  properties?: {
    periods?: NwsHourlyPeriod[];
  };
};

type NwsHourlyPeriod = {
  startTime?: string;
  endTime?: string;
  temperature?: number;
  temperatureUnit?: string;
  probabilityOfPrecipitation?: {
    value?: number | null;
  } | null;
  windSpeed?: string;
  shortForecast?: string;
};

type NwsStationsResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      stationIdentifier?: string;
    };
  }>;
};

type NwsLatestObservationResponse = {
  properties?: {
    temperature?: {
      value?: number | null;
      unitCode?: string | null;
    } | null;
    textDescription?: string | null;
  };
};

export async function GET(request: NextRequest) {
  const lat = process.env.WEATHER_LATITUDE || DEFAULT_LAT;
  const lon = process.env.WEATHER_LONGITUDE || DEFAULT_LON;
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(Number(searchParams.get("days")) || 7, 14);

  try {
    const payload = await loadWeather({ lat, lon, days });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Weather API error", error);
    return NextResponse.json({ error: "Unable to load weather data" }, { status: 502 });
  }
}

async function loadWeather({ lat, lon, days }: { lat: string; lon: string; days: number }) {
  try {
    return await loadFromNws({ lat, lon, days });
  } catch (nwsError) {
    console.error("NWS weather error", nwsError);
    return loadFromOpenMeteo({ lat, lon, days });
  }
}

async function loadFromNws({
  lat,
  lon,
  days,
}: {
  lat: string;
  lon: string;
  days: number;
}): Promise<NormalizedWeatherResponse> {
  const headers = getNwsHeaders();
  const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
  const points = await fetchJson<NwsPointsResponse>(pointsUrl, headers);
  const forecastHourlyUrl = points.properties?.forecastHourly;
  const observationStationsUrl = points.properties?.observationStations;

  if (!forecastHourlyUrl || !observationStationsUrl) {
    throw new Error("NWS points lookup did not return forecast URLs");
  }

  const [forecastHourly, currentWeather] = await Promise.all([
    fetchJson<NwsForecastHourlyResponse>(forecastHourlyUrl, headers),
    loadNwsCurrentWeather(observationStationsUrl, headers),
  ]);

  const periods = forecastHourly.properties?.periods ?? [];
  if (!periods.length) {
    throw new Error("NWS hourly forecast returned no periods");
  }

  const filteredPeriods = limitPeriodsToDays(periods, days);
  if (!filteredPeriods.length) {
    throw new Error("NWS hourly forecast did not include requested days");
  }

  return normalizeNwsPayload({
    lat,
    lon,
    periods: filteredPeriods,
    currentWeather: currentWeather ?? buildCurrentWeatherFromPeriod(filteredPeriods[0]),
  });
}

async function loadNwsCurrentWeather(observationStationsUrl: string, headers: HeadersInit) {
  try {
    const stations = await fetchJson<NwsStationsResponse>(observationStationsUrl, headers);
    const stationIdentifier =
      stations.features?.[0]?.properties?.stationIdentifier ?? getStationIdFromUrl(stations.features?.[0]?.id);
    if (!stationIdentifier) return null;

    const latest = await fetchJson<NwsLatestObservationResponse>(
      `https://api.weather.gov/stations/${stationIdentifier}/observations/latest`,
      headers
    );
    const temperature = normalizeObservationTemperature(latest.properties?.temperature);
    const description = latest.properties?.textDescription ?? null;

    if (temperature === null && !description) {
      return null;
    }

    return {
      temperature: temperature ?? undefined,
      weathercode: mapForecastTextToCode(description),
      description: description ?? undefined,
    };
  } catch (error) {
    console.error("NWS current observation error", error);
    return null;
  }
}

function normalizeNwsPayload({
  lat,
  lon,
  periods,
  currentWeather,
}: {
  lat: string;
  lon: string;
  periods: NwsHourlyPeriod[];
  currentWeather: NormalizedWeatherResponse["current_weather"];
}): NormalizedWeatherResponse {
  const hourly = {
    time: periods.map((period) => period.startTime?.slice(0, 19) ?? ""),
    temperature_2m: periods.map((period) => toCelsiusTemperature(period.temperature, period.temperatureUnit)),
    precipitation_probability: periods.map((period) => normalizePercentage(period.probabilityOfPrecipitation?.value)),
    wind_speed_10m: periods.map((period) => toKilometersPerHour(parseWindSpeedMph(period.windSpeed))),
    weather_code: periods.map((period) => mapForecastTextToCode(period.shortForecast)),
  };

  const dailyGroups = new Map<string, NwsHourlyPeriod[]>();
  for (const period of periods) {
    const date = period.startTime?.slice(0, 10);
    if (!date) continue;
    const existing = dailyGroups.get(date) ?? [];
    existing.push(period);
    dailyGroups.set(date, existing);
  }

  const dailyEntries = Array.from(dailyGroups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, group]) => buildDailyEntry(date, group));

  return {
    provider: "nws",
    location: {
      latitude: lat,
      longitude: lon,
    },
    daily: {
      time: dailyEntries.map((entry) => entry.time),
      temperature_2m_max: dailyEntries.map((entry) => entry.temperature_2m_max),
      temperature_2m_min: dailyEntries.map((entry) => entry.temperature_2m_min),
      precipitation_probability_max: dailyEntries.map((entry) => entry.precipitation_probability_max),
      precipitation_sum: dailyEntries.map(() => null),
      rain_sum: dailyEntries.map(() => null),
      snowfall_sum: dailyEntries.map(() => null),
      weather_code: dailyEntries.map((entry) => entry.weather_code),
      sunrise: dailyEntries.map(() => null),
      sunset: dailyEntries.map(() => null),
    },
    hourly,
    current_weather: currentWeather,
  };
}

function buildDailyEntry(date: string, periods: NwsHourlyPeriod[]) {
  const temperatures = periods
    .map((period) => toCelsiusTemperature(period.temperature, period.temperatureUnit))
    .filter((value): value is number => typeof value === "number");
  const precipitationValues = periods
    .map((period) => normalizePercentage(period.probabilityOfPrecipitation?.value))
    .filter((value): value is number => typeof value === "number");
  const codes = periods.map((period) => mapForecastTextToCode(period.shortForecast));

  return {
    time: date,
    temperature_2m_max: temperatures.length ? Math.max(...temperatures) : 0,
    temperature_2m_min: temperatures.length ? Math.min(...temperatures) : 0,
    precipitation_probability_max: precipitationValues.length ? Math.max(...precipitationValues) : null,
    weather_code: pickMostSevereCode(codes),
  };
}

function buildCurrentWeatherFromPeriod(period?: NwsHourlyPeriod) {
  if (!period) return null;

  const temperature = toCelsiusTemperature(period.temperature, period.temperatureUnit);
  const weathercode = mapForecastTextToCode(period.shortForecast);
  const description = period.shortForecast ?? undefined;

  if (temperature === null && weathercode === null && !description) {
    return null;
  }

  return {
    temperature: temperature ?? undefined,
    weathercode,
    description,
  };
}

function limitPeriodsToDays(periods: NwsHourlyPeriod[], days: number) {
  const allowedDates = new Set<string>();
  const filtered: NwsHourlyPeriod[] = [];

  for (const period of periods) {
    const date = period.startTime?.slice(0, 10);
    if (!date) continue;

    if (!allowedDates.has(date) && allowedDates.size >= days) {
      continue;
    }

    allowedDates.add(date);
    filtered.push(period);
  }

  return filtered;
}

function parseWindSpeedMph(value?: string) {
  if (!value) return null;
  const matches = value.match(/(\d+(?:\.\d+)?)/g);
  if (!matches?.length) return null;
  return Math.max(...matches.map((match) => Number(match)).filter((match) => Number.isFinite(match)));
}

function toCelsiusTemperature(value?: number, unit?: string) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (unit?.toUpperCase() === "F") {
    return Math.round((((value - 32) * 5) / 9) * 10) / 10;
  }
  return Math.round(value * 10) / 10;
}

function toKilometersPerHour(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 1.60934 * 10) / 10;
}

function normalizeObservationTemperature(
  temperature?: { value?: number | null; unitCode?: string | null } | null
) {
  const value = temperature?.value;
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

function normalizePercentage(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pickMostSevereCode(codes: Array<number | null>) {
  const validCodes = codes.filter((code): code is number => typeof code === "number");
  for (const code of validCodes) {
    if ([95, 96, 99].includes(code)) return code;
  }
  for (const code of validCodes) {
    if ([71, 73, 75, 77, 85, 86].includes(code)) return code;
  }
  for (const code of validCodes) {
    if ([66, 67].includes(code)) return code;
  }
  for (const code of validCodes) {
    if ([61, 63, 65, 80, 81, 82, 51, 53, 55, 56, 57].includes(code)) return code;
  }
  return validCodes[0] ?? null;
}

function mapForecastTextToCode(text?: string | null) {
  if (!text) return null;
  const normalized = text.toLowerCase();

  if (normalized.includes("thunder")) return 95;
  if (normalized.includes("freezing rain")) return 66;
  if (normalized.includes("sleet")) return 77;
  if (normalized.includes("snow shower")) return 85;
  if (normalized.includes("snow")) return 73;
  if (normalized.includes("rain shower")) return 80;
  if (normalized.includes("drizzle")) return 53;
  if (normalized.includes("rain")) return 63;
  if (normalized.includes("fog")) return 45;
  if (normalized.includes("mostly clear")) return 1;
  if (normalized.includes("partly sunny") || normalized.includes("partly cloudy")) return 2;
  if (normalized.includes("mostly sunny") || normalized.includes("mostly clear")) return 1;
  if (normalized.includes("sunny") || normalized.includes("clear")) return 0;
  if (
    normalized.includes("cloudy") ||
    normalized.includes("overcast") ||
    normalized.includes("mostly cloudy")
  ) {
    return 3;
  }

  return null;
}

function getStationIdFromUrl(value?: string) {
  if (!value) return null;
  const segments = value.split("/");
  return segments[segments.length - 1] || null;
}

function getNwsHeaders(): HeadersInit {
  const configuredUserAgent = process.env.WEATHER_USER_AGENT?.trim();
  if (configuredUserAgent) {
    return {
      Accept: "application/geo+json",
      "User-Agent": configuredUserAgent,
    };
  }

  return {
    Accept: "application/geo+json",
    "User-Agent": "productivity-app/0.1 (weather dashboard)",
  };
}

async function fetchJson<T>(url: string, headers?: HeadersInit) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function loadFromOpenMeteo({
  lat,
  lon,
  days,
}: {
  lat: string;
  lon: string;
  days: number;
}): Promise<NormalizedWeatherResponse> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "rain_sum",
      "snowfall_sum",
      "weather_code",
      "sunrise",
      "sunset",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation_probability", "wind_speed_10m", "weather_code"].join(",")
  );
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", days.toString());

  const data = await fetchJson<Omit<NormalizedWeatherResponse, "provider" | "location">>(url.toString());
  return {
    provider: "open-meteo",
    location: {
      latitude: lat,
      longitude: lon,
    },
    daily: data.daily,
    hourly: data.hourly,
    current_weather: data.current_weather,
  };
}
