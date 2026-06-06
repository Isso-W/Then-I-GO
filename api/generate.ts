import type { IncomingMessage, ServerResponse } from "http";

let aiInstance: any = null;

async function getAI() {
  if (aiInstance) return aiInstance;
  const { GoogleGenAI } = await import("@google/genai");

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const apiKey = process.env.GEMINI_API_KEY;

  if (saJson) {
    const creds = JSON.parse(saJson);
    const project = creds.project_id;
    const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
    aiInstance = new GoogleGenAI({ vertexai: true, project, location });
  } else if (apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
  } else {
    throw new Error("需要 GOOGLE_SERVICE_ACCOUNT_JSON 或 GEMINI_API_KEY");
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
