import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LAT = "37.7749";
const DEFAULT_LON = "-122.4194";

export async function GET(request: NextRequest) {
  const lat = process.env.WEATHER_LATITUDE || DEFAULT_LAT;
  const lon = process.env.WEATHER_LONGITUDE || DEFAULT_LON;
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(Number(searchParams.get("days")) || 7, 14);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", days.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }
    const data = await response.json();
    return NextResponse.json({
      location: {
        latitude: lat,
        longitude: lon,
      },
      daily: data.daily,
    });
  } catch (error) {
    console.error("Weather API error", error);
    return NextResponse.json({ error: "Unable to load weather data" }, { status: 502 });
  }
}
