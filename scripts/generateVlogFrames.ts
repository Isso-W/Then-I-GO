/**
 * 一次性脚本：用 gemini-2.5-flash-image 生成 Vlog 演示用占位 B-roll，并压成竖版 JPEG。
 * 这些图只是 demo 占位（真实场景由用户拍摄上传），结果 commit 进 public/vlog/。
 * 运行：$env:GEMINI_API_KEY="..."; npx tsx scripts/generateVlogFrames.ts
 * 输出：public/vlog/{coffee,park,bookstore}.jpg（720x1280, ~100KB/张）
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const STYLE = `cinematic vlog still frame, golden hour, warm bokeh, subtle film grain,
shot on 35mm, shallow depth of field, 9:16 vertical, no text, no watermark, no people faces.`;

const SHOTS: { name: string; prompt: string }[] = [
  {
    name: "coffee",
    prompt: `A cozy independent coffee shop street corner in Wudaokou, Beijing at golden hour,
warm bokeh, a bicycle parked outside, steam rising from a cup. ${STYLE}`,
  },
  {
    name: "park",
    prompt: `A serene green park with a small lake in Wudaokou, Beijing in autumn,
willow trees by the water, a winding path, soft afternoon light. ${STYLE}`,
  },
  {
    name: "bookstore",
    prompt: `Cozy interior of an independent bookstore in Wudaokou, Beijing,
warm wooden shelves full of books, a reading nook with a lamp, plants by the window. ${STYLE}`,
  },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("缺少 GEMINI_API_KEY");
  const outDir = resolve(__dirname, "../public/vlog");
  mkdirSync(outDir, { recursive: true });

  for (const shot of SHOTS) {
    console.log(`生成 ${shot.name} ...`);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: shot.prompt,
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const data = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!data) {
      console.error(`❌ ${shot.name} 没返回图片，跳过`);
      continue;
    }
    const out = resolve(outDir, `${shot.name}.jpg`);
    const info = await sharp(Buffer.from(data, "base64"))
      .resize({ width: 720, height: 1280, fit: "cover", position: "centre" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);
    console.log(`✅ ${shot.name}.jpg  ${(info.size / 1024).toFixed(1)} KB  ${info.width}x${info.height}`);
  }
}

main().catch((e) => {
  console.error("脚本失败：", e);
  process.exit(1);
});
