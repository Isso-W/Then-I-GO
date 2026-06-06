import type { IncomingMessage, ServerResponse } from "http";

let aiInstance: any = null;

async function getAI() {
  if (aiInstance) return aiInstance;
  const { GoogleGenAI } = await import("@google/genai");

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
  } else {
    throw new Error("需要设置 GEMINI_API_KEY 环境变量");
  }
  return aiInstance;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c: Buffer) => { body += c.toString(); });
    req.on("end", () => resolve(body));
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }

  try {
    const raw = await readBody(req);
    const { model, prompt } = JSON.parse(raw);
    const ai = await getAI();
    const response = await ai.models.generateContent({ model, contents: prompt });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text: response.text ?? "" }));
  } catch (e: any) {
    console.error("[api/generate]", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.message }));
  }
}
