import type { Plugin } from "vite";
import { readFileSync } from "fs";

export default function geminiProxy(
  env: Record<string, string> = {}
): Plugin {
  let aiInstance: any = null;

  async function getAI() {
    if (aiInstance) return aiInstance;
    const { GoogleGenAI } = await import("@google/genai");

    let project =
      env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const location =
      env.GOOGLE_CLOUD_LOCATION ||
      process.env.GOOGLE_CLOUD_LOCATION ||
      "us-central1";
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const credFile = env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!project && credFile) {
      try {
        const creds = JSON.parse(readFileSync(credFile, "utf-8"));
        project = creds.project_id;
      } catch {}
    }

    if (project) {
      console.log(
        `[gemini-proxy] Vertex AI · project=${project} location=${location}`
      );
      aiInstance = new GoogleGenAI({ vertexai: true, project, location });
    } else if (apiKey) {
      console.log("[gemini-proxy] Google AI Studio (API key)");
      aiInstance = new GoogleGenAI({ apiKey });
    } else {
      throw new Error(
        "需要 GOOGLE_APPLICATION_CREDENTIALS (Vertex AI) 或 GEMINI_API_KEY (AI Studio)"
      );
    }
    return aiInstance;
  }

  return {
    name: "gemini-vertex-proxy",
    configureServer(server) {
      const WEATHER_ZH: Record<string, string> = {
        "Clear": "晴", "Sunny": "晴", "Partly Cloudy": "多云", "Partly cloudy": "多云",
        "Cloudy": "阴", "Overcast": "阴天", "Mist": "薄雾", "Fog": "雾",
        "Light rain": "小雨", "Moderate rain": "中雨", "Heavy rain": "大雨",
        "Light drizzle": "毛毛雨", "Patchy rain nearby": "局部小雨",
        "Patchy rain possible": "可能有雨", "Thundery outbreaks possible": "可能雷阵雨",
        "Light snow": "小雪", "Moderate snow": "中雪", "Heavy snow": "大雪",
        "Blowing snow": "吹雪", "Blizzard": "暴风雪",
        "Light rain shower": "阵雨", "Moderate or heavy rain shower": "大阵雨",
        "Torrential rain shower": "暴雨",
      };

      server.middlewares.use("/api/weather", async (_req, res) => {
        try {
          const resp = await fetch(
            "https://wttr.in/Wudaokou,Beijing?format=j1&lang=zh",
            { headers: { "User-Agent": "curl/7.0" } }
          );
          if (!resp.ok) throw new Error(`wttr.in ${resp.status}`);
          const data = await resp.json();
          const cur = data.current_condition?.[0] ?? {};
          const rawDesc = (cur.lang_zh?.[0]?.value ?? cur.weatherDesc?.[0]?.value ?? "Clear").trim();
          const result = {
            temp: cur.temp_C ?? "22",
            feelsLike: cur.FeelsLikeC ?? cur.temp_C ?? "22",
            desc: WEATHER_ZH[rawDesc] ?? rawDesc,
            humidity: cur.humidity ?? "50",
            windSpeed: cur.windspeedKmph ?? "10",
            icon: cur.weatherCode ?? "113",
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (e: any) {
          console.warn("[weather] fallback:", e.message);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            temp: "22", feelsLike: "22", desc: "晴", humidity: "50", windSpeed: "10", icon: "113",
          }));
        }
      });

      server.middlewares.use("/api/generate", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (c: Buffer) => {
          body += c.toString();
        });
        req.on("end", async () => {
          try {
            const { model, prompt } = JSON.parse(body);
            const ai = await getAI();
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ text: response.text ?? "" }));
          } catch (e: any) {
            console.error("[gemini-proxy]", e);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}
