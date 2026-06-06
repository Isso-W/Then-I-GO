import type { VercelRequest, VercelResponse } from "@vercel/node";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { model, prompt } = req.body;
    const ai = await getAI();
    const response = await ai.models.generateContent({ model, contents: prompt });
    res.json({ text: response.text ?? "" });
  } catch (e: any) {
    console.error("[api/generate]", e);
    res.status(500).json({ error: e.message });
  }
}
