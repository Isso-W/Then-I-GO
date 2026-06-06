import type { VercelRequest, VercelResponse } from "@vercel/node";

const WEATHER_ZH: Record<string, string> = {
  Clear: "晴", Sunny: "晴", "Partly Cloudy": "多云", "Partly cloudy": "多云",
  Cloudy: "阴", Overcast: "阴天", Mist: "薄雾", Fog: "雾",
  "Light rain": "小雨", "Moderate rain": "中雨", "Heavy rain": "大雨",
  "Light drizzle": "毛毛雨", "Patchy rain nearby": "局部小雨",
  "Patchy rain possible": "可能有雨", "Thundery outbreaks possible": "可能雷阵雨",
  "Light snow": "小雪", "Moderate snow": "中雪", "Heavy snow": "大雪",
  "Blowing snow": "吹雪", Blizzard: "暴风雪",
  "Light rain shower": "阵雨", "Moderate or heavy rain shower": "大阵雨",
  "Torrential rain shower": "暴雨",
};

const FALLBACK = { temp: "22", feelsLike: "22", desc: "晴", humidity: "50", windSpeed: "10", icon: "113" };

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const resp = await fetch("https://wttr.in/Wudaokou,Beijing?format=j1&lang=zh", {
      headers: { "User-Agent": "curl/7.0" },
    });
    if (!resp.ok) throw new Error(`wttr.in ${resp.status}`);
    const data = await resp.json();
    const cur = data.current_condition?.[0] ?? {};
    const rawDesc = (cur.lang_zh?.[0]?.value ?? cur.weatherDesc?.[0]?.value ?? "Clear").trim();
    res.json({
      temp: cur.temp_C ?? "22",
      feelsLike: cur.FeelsLikeC ?? cur.temp_C ?? "22",
      desc: WEATHER_ZH[rawDesc] ?? rawDesc,
      humidity: cur.humidity ?? "50",
      windSpeed: cur.windspeedKmph ?? "10",
      icon: cur.weatherCode ?? "113",
    });
  } catch (e: any) {
    console.warn("[api/weather] fallback:", e.message);
    res.json(FALLBACK);
  }
}
