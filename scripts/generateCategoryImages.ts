/**
 * 一次性脚本：用 gemini-2.5-flash-image 生成品类插图。
 * 结果 commit 进 public/categories/。
 * 运行：$env:GEMINI_API_KEY="..."; npx tsx scripts/generateCategoryImages.ts
 * 输出：public/categories/{coffee,food,noodles,...}.jpg（480x480, ~60KB/张）
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const STYLE = `warm hand-drawn watercolor illustration, soft pastel colors, cozy and inviting,
minimal background with gentle gradient wash, centered composition, no text, no watermark,
no people, studio ghibli inspired warmth, square format.`;

const SHOTS: { name: string; prompt: string }[] = [
  {
    name: "coffee",
    prompt: `A steaming cup of latte art coffee on a small wooden table, with a tiny succulent plant beside it. ${STYLE}`,
  },
  {
    name: "food",
    prompt: `A beautiful spread of Chinese dishes on a round table — mapo tofu, stir-fried greens, steamed rice, chopsticks. ${STYLE}`,
  },
  {
    name: "noodles",
    prompt: `A large bowl of hand-pulled noodles (兰州拉面) with beef slices, cilantro, chili oil, and steam rising. ${STYLE}`,
  },
  {
    name: "bbq",
    prompt: `Grilled lamb skewers (烤串) on a metal tray with cumin seasoning, beer bottles nearby. ${STYLE}`,
  },
  {
    name: "boba",
    prompt: `A tall glass of brown sugar bubble tea with tapioca pearls visible, condensation on the cup, a striped straw. ${STYLE}`,
  },
  {
    name: "bar",
    prompt: `Two colorful cocktails on a dimly lit bar counter, one blue one amber, with ice cubes and citrus garnish. ${STYLE}`,
  },
  {
    name: "bookstore",
    prompt: `A cozy reading nook in a bookstore — a stack of books, a warm reading lamp, a comfortable armchair. ${STYLE}`,
  },
  {
    name: "art",
    prompt: `An artist's desk with watercolor palette, brushes in a jar, a half-finished painting of flowers, natural light from a window. ${STYLE}`,
  },
  {
    name: "park",
    prompt: `A serene park path with autumn maple trees, a wooden bench, fallen leaves, soft golden afternoon light. ${STYLE}`,
  },
  {
    name: "fitness",
    prompt: `A yoga mat unrolled in a bright studio, with a water bottle and towel, morning sunlight streaming in. ${STYLE}`,
  },
  {
    name: "entertainment",
    prompt: `A cozy movie night setup — a bucket of popcorn, movie tickets, a drink cup, warm ambient lighting. ${STYLE}`,
  },
  {
    name: "bike",
    prompt: `A cute vintage bicycle with a flower basket, parked on a tree-lined street, dappled sunlight. ${STYLE}`,
  },
  {
    name: "taxi",
    prompt: `A friendly yellow taxi cab on a city street, viewed from the side, with warm evening light. ${STYLE}`,
  },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("缺少 GEMINI_API_KEY");
  const outDir = resolve(__dirname, "../public/categories");
  mkdirSync(outDir, { recursive: true });

  for (const shot of SHOTS) {
    const outPath = resolve(outDir, `${shot.name}.jpg`);
    if (existsSync(outPath)) {
      console.log(`⏭️  ${shot.name}.jpg 已存在，跳过`);
      continue;
    }
    console.log(`🎨 生成 ${shot.name} ...`);
    try {
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
      const info = await sharp(Buffer.from(data, "base64"))
        .resize({ width: 480, height: 480, fit: "cover", position: "centre" })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(outPath);
      console.log(`✅ ${shot.name}.jpg  ${(info.size / 1024).toFixed(1)} KB  ${info.width}x${info.height}`);
    } catch (e) {
      console.error(`❌ ${shot.name} 生成失败:`, e);
    }
  }
  console.log("\n🎉 完成！图片在 public/categories/");
}

main().catch((e) => {
  console.error("脚本失败：", e);
  process.exit(1);
});
