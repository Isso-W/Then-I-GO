import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credFile) { console.error("Set GOOGLE_APPLICATION_CREDENTIALS"); process.exit(1); }
const creds = JSON.parse(fs.readFileSync(credFile, "utf-8"));
const ai = new GoogleGenAI({ vertexai: true, project: creds.project_id, location: "us-central1" });

const SCENES = [
  { key: "sunny", prompt: "A bright sunny urban street scene with warm golden light, blue sky, modern city buildings and trees casting shadows. Wide angle, cinematic, no text." },
  { key: "cloudy", prompt: "An overcast urban cityscape with soft diffused light, grey clouds, modern buildings and pedestrian streets. Moody atmosphere, wide angle, cinematic, no text." },
  { key: "rainy", prompt: "A rainy city street at dusk with wet reflections on pavement, umbrellas, warm street lights glowing through rain. Cinematic, moody, wide angle, no text." },
  { key: "snowy", prompt: "A snowy urban winter scene with snow-covered streets and rooftops, soft white light, cozy atmosphere, modern city buildings. Wide angle, cinematic, no text." },
  { key: "foggy", prompt: "A misty foggy morning urban scene with buildings fading into fog, soft ethereal light, mysterious atmosphere, city silhouettes. Wide angle, cinematic, no text." },
];

const OUT_DIR = path.resolve("public/weather");

async function generate() {
  for (const scene of SCENES) {
    const outPath = path.join(OUT_DIR, `${scene.key}.jpg`);
    if (fs.existsSync(outPath)) {
      console.log(`⏭️ ${scene.key}.jpg already exists, skipping`);
      continue;
    }
    console.log(`🎨 Generating ${scene.key}...`);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: scene.prompt,
        config: { responseModalities: ["IMAGE", "TEXT"] },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
      if (imgPart?.inlineData?.data) {
        const buf = Buffer.from(imgPart.inlineData.data, "base64");
        fs.writeFileSync(outPath, buf);
        console.log(`✅ ${scene.key}.jpg (${Math.round(buf.length / 1024)}KB)`);
      } else {
        console.warn(`⚠️ No image in response for ${scene.key}`);
      }
    } catch (e: any) {
      console.error(`❌ ${scene.key}: ${e.message}`);
    }
  }
  console.log("Done!");
}

generate();
