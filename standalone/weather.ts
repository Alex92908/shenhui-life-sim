// Live weather for the standalone server, from Open-Meteo (free, no API
// key). Replaces Muse's platform weather tool and returns the same shape,
// so actions.ts's caching / kind mapping works untouched.
import type { WeatherToolResult } from "@hatch/space-sdk";

// Chinese wording, chosen so actions.ts's kindFromDescription maps each
// one to the right sky (e.g. "晴间多云" → partly, "阴" → overcast).
const WMO: Record<number, string> = {
  0: "晴", 1: "大部晴朗", 2: "晴间多云", 3: "阴",
  45: "雾", 48: "雾凇",
  51: "小毛毛雨", 53: "毛毛雨", 55: "浓毛毛雨", 56: "冻毛毛雨", 57: "冻毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
  80: "阵雨", 81: "强阵雨", 82: "暴雨",
  85: "阵雪", 86: "强阵雪",
  95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "强雷阵雨伴冰雹",
};
const desc = (code: unknown) => (typeof code === "number" ? WMO[code] ?? "多云" : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const hhmm = (iso: unknown) => (typeof iso === "string" ? iso.slice(11, 16) : null);

interface OpenMeteo {
  current?: Record<string, unknown>;
  daily?: Record<string, unknown[]>;
}

export async function openMeteoWeather(lat: number, lon: number, tz: string): Promise<WeatherToolResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", tz);
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset");
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = (await res.json()) as OpenMeteo;
  const cur = j.current ?? {};
  const d = j.daily ?? {};
  const at = <T>(k: string, i: number) => (d[k]?.[i] as T | undefined) ?? null;
  const description = desc(cur.weather_code);
  const wind = num(cur.wind_speed_10m);
  const days = (d.time ?? []).map((date, i) => ({
    date: typeof date === "string" ? date : null,
    summary: desc(at<number>("weather_code", i)) || null,
    high: num(at("temperature_2m_max", i)),
    low: num(at("temperature_2m_min", i)),
    precipitation_chance: num(at("precipitation_probability_max", i)),
  }));
  return {
    content: {
      summary: description,
      conditions: {
        description,
        temperature: num(cur.temperature_2m),
        unit: "°C",
        feels_like: num(cur.apparent_temperature),
        high: days[0]?.high ?? null,
        low: days[0]?.low ?? null,
        humidity_percent: num(cur.relative_humidity_2m),
        precipitation_chance: days[0]?.precipitation_chance ?? null,
        wind: wind === null ? null : `${Math.round(wind)} km/h`,
        sunrise: hhmm(at("sunrise", 0)),
        sunset: hhmm(at("sunset", 0)),
      },
      alerts: [],
      forecast_days: days,
      sources: [{ title: "Open-Meteo", url: "https://open-meteo.com/" }],
    },
  };
}
