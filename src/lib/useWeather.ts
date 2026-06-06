import { useState, useEffect } from "react";

export interface Weather {
  temp: string;
  feelsLike: string;
  desc: string;
  humidity: string;
  windSpeed: string;
  icon: string;
}

const WEATHER_EMOJI: Record<string, string> = {
  "113": "☀️", "116": "⛅", "119": "☁️", "122": "☁️",
  "143": "🌫️", "176": "🌦️", "179": "🌨️", "182": "🌧️",
  "200": "⛈️", "227": "🌨️", "230": "❄️", "248": "🌫️",
  "260": "🌫️", "263": "🌦️", "266": "🌧️", "281": "🌧️",
  "284": "🌧️", "293": "🌦️", "296": "🌧️", "299": "🌧️",
  "302": "🌧️", "305": "🌧️", "308": "🌧️", "311": "🌧️",
  "314": "🌧️", "317": "🌨️", "320": "🌨️", "323": "🌨️",
  "326": "🌨️", "329": "❄️", "332": "❄️", "335": "❄️",
  "338": "❄️", "350": "🌧️", "353": "🌦️", "356": "🌧️",
  "359": "🌧️", "362": "🌨️", "365": "🌨️", "368": "🌨️",
  "371": "❄️", "374": "🌧️", "377": "🌧️", "386": "⛈️",
  "389": "⛈️", "392": "⛈️", "395": "❄️",
};

export function weatherEmoji(code: string): string {
  return WEATHER_EMOJI[code] ?? "☀️";
}

export function weatherAdvice(w: Weather): { tip: string; tag: string } {
  const t = parseInt(w.temp);
  const code = w.icon;
  if (["200", "386", "389", "392"].includes(code)) return { tip: "雷雨天气，建议选室内路线", tag: "建议室内" };
  if (["296", "299", "302", "305", "308"].includes(code)) return { tip: "有雨，推荐商场/书店/咖啡厅", tag: "带伞出行" };
  if (["176", "263", "266", "293"].includes(code)) return { tip: "小雨不碍事，沿途有遮蔽", tag: "微雨漫步" };
  if (t >= 35) return { tip: "高温天气，优先推荐阴凉处", tag: "注意防暑" };
  if (t <= 0) return { tip: "低温天气，推荐温暖的室内地点", tag: "注意保暖" };
  return { tip: "系统会优先推荐公园、街区、露台餐饮等地点", tag: "适合步行探索" };
}

function weatherImagePath(code: string): string {
  const c = parseInt(code);
  if ([113].includes(c)) return "/weather/sunny.jpg";
  if ([116, 119, 122].includes(c)) return "/weather/cloudy.jpg";
  if ([143, 248, 260].includes(c)) return "/weather/foggy.jpg";
  if ([176, 182, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 350, 353, 356, 359, 386, 389, 200].includes(c)) return "/weather/rainy.jpg";
  if ([179, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 362, 365, 368, 371, 374, 377, 392, 395].includes(c)) return "/weather/snowy.jpg";
  return "/weather/sunny.jpg";
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherImage, setWeatherImage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((w: Weather) => {
        setWeather(w);
        setWeatherImage(weatherImagePath(w.icon));
      })
      .catch(() => {
        setWeather({ temp: "22", feelsLike: "22", desc: "晴", humidity: "50", windSpeed: "10", icon: "113" });
        setWeatherImage(weatherImagePath("113"));
      });
  }, []);

  return { weather, weatherImage };
}
