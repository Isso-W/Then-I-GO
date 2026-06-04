/**
 * 一次性脚本：用 gemini-2.5-flash-image 生成品类插图。
 * 结果 commit 进 public/categories/。
 * 运行：$env:GEMINI_API_KEY="..."; npx tsx scripts/generateCategoryImages.ts
 * 输出：public/categories/{local-cuisine,hotpot,...}.jpg（480x480, ~60KB/张）
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// 统一视觉语言：暗调暖光美食摄影 / 氛围场景
// 匹配 app 的深色 UI + 紫色主题，图片作为卡片配图需要：
// - 暗背景 + 暖色主光源（让食物/场景在深色 UI 上跳出来）
// - 浅景深虚化，聚焦主体
// - 色调偏暖铜/琥珀/金，与 app 的 #6C5CFF 紫 + #FFD166 金形成互补
// - 无文字无人脸，正方形构图
const STYLE = `top-down 45-degree angle, cinematic food photography, dark moody background,
warm amber key light from the left, shallow depth of field with creamy bokeh,
rich saturated colors, slight steam or mist for atmosphere,
shot on Hasselblad medium format, 1:1 square crop,
no text, no watermark, no human faces, no hands.`;

const SHOTS: { name: string; prompt: string }[] = [
  // ===== 餐饮 9 大品类 =====
  {
    name: "local-cuisine",
    prompt: `A rustic dark wooden table with three signature Chinese regional dishes:
braised pork belly (红烧肉) glistening with caramelized sauce in a clay pot,
wok-fried greens with garlic on a blue-white porcelain plate,
and a bowl of steamed rice with chopsticks resting on a ceramic holder.
Warm steam rises gently. Background: weathered dark wood grain. ${STYLE}`,
  },
  {
    name: "hotpot",
    prompt: `A split copper hotpot (鸳鸯锅) photographed from above:
one side fiery red Sichuan chili broth with floating peppercorns and dried chilies,
the other side milky white bone broth with goji berries and jujube.
Surrounding: thin-sliced marbled beef on a white plate, fresh greens, mushroom platter,
dipping sauce bowls. Dense aromatic steam rising. Dark slate table surface. ${STYLE}`,
  },
  {
    name: "bbq",
    prompt: `Charcoal-grilled lamb skewers (羊肉串) on a sizzling metal rack,
sprinkled with cumin seeds and chili flakes, grill marks visible.
Beside them: grilled chicken wings with honey glaze, grilled eggplant.
Tiny sparks and smoke wisps from the charcoal underneath.
Background: dark iron grill grate, ambient ember glow. ${STYLE}`,
  },
  {
    name: "world-cuisine",
    prompt: `An elegant Japanese-style wooden serving board with:
a carefully arranged sushi platter (salmon nigiri, tuna maki, tamago),
a small ceramic bowl of miso soup with tofu and wakame,
wasabi and pickled ginger in tiny dishes, lacquer chopsticks.
Background: dark textured stone surface, soft warm side light. ${STYLE}`,
  },
  {
    name: "buffet",
    prompt: `A luxurious buffet station viewed at a slight angle:
gleaming chafing dishes with golden lids partially open revealing roasted meats,
a tiered seafood tower with prawns and oysters on crushed ice,
a dessert section with petit fours and fruit tarts.
Warm brass serving utensils, ambient golden downlighting.
Background: dark polished marble counter. ${STYLE}`,
  },
  {
    name: "seafood",
    prompt: `A dramatic seafood platter on crushed ice:
a whole steamed grouper with ginger and scallion,
garlic butter prawns in a cast-iron skillet,
steamed clams in white wine broth, lemon wedges.
Condensation droplets on the shells, steam rising from the fish.
Background: dark blue-black slate, single warm spotlight. ${STYLE}`,
  },
  {
    name: "snack",
    prompt: `A vibrant Beijing street food spread arranged on kraft paper:
golden jianbing (煎饼果子) cut in half showing crispy layers,
pan-fried dumplings (锅贴) with golden-brown crispy bottoms,
candied hawthorn sticks (糖葫芦) with glossy red coating,
a cup of soy milk with steam.
Background: dark rustic wooden street-cart surface, string lights bokeh. ${STYLE}`,
  },
  {
    name: "drinks",
    prompt: `Three artisan drinks arranged in a triangle on a dark marble counter:
a latte with intricate rosetta art in a ceramic cup,
a tall glass of peach oolong fruit tea with ice and visible fruit slices,
a matcha latte in a clear glass showing the green-white gradient.
Condensation on the cold glasses, warm café backlight glow. ${STYLE}`,
  },
  {
    name: "dessert",
    prompt: `A patisserie display shelf (dark wood) with:
golden flaky croissants stacked on parchment,
a slice of layered strawberry mille-feuille with cream and fresh berries,
a row of pastel French macarons (pink, lavender, pistachio),
a small chocolate fondant with molten center oozing.
Warm bakery light, powdered sugar dust floating in the air. ${STYLE}`,
  },

  // ===== 非餐饮 =====
  {
    name: "coffee",
    prompt: `A cozy specialty coffee corner: a double-walled glass cup of espresso with golden crema,
a small succulent plant in a concrete pot, a worn leather-bound notebook.
Morning golden light streaming through a window hitting the cup.
Background: dark walnut shelf with blurred coffee bags. ${STYLE}`,
  },
  {
    name: "bar",
    prompt: `Two signature cocktails on a dark oak bar counter:
a purple-blue Galaxy cocktail with edible glitter swirling inside,
an amber Old Fashioned with a large ice sphere and orange peel garnish.
Moody purple and amber backlight from bar shelves of bottles in soft bokeh.
Background: dark intimate bar atmosphere. ${STYLE}`,
  },
  {
    name: "bookstore",
    prompt: `A cozy bookstore reading nook: a stack of well-loved books with cloth bookmarks,
a warm brass reading lamp casting a golden pool of light,
a comfortable leather armchair corner visible.
Background: floor-to-ceiling dark wooden bookshelves, soft warm ambient light. ${STYLE}`,
  },
  {
    name: "art",
    prompt: `An artist's workspace: a wooden palette with fresh oil paint dabs (ultramarine, cadmium yellow, alizarin),
brushes of various sizes in a ceramic jar, a half-finished canvas of an abstract cityscape.
Natural north-facing window light. Background: paint-splattered dark studio wall. ${STYLE}`,
  },
  {
    name: "park",
    prompt: `A serene autumn park scene: a winding stone path through a canopy of golden maple trees,
a weathered wooden bench with fallen leaves on it,
soft afternoon sun filtering through branches creating dappled light patterns.
Background: misty park depth, warm golden atmosphere. ${STYLE}`,
  },
  {
    name: "fitness",
    prompt: `A minimalist yoga and fitness scene: a rolled cork yoga mat on a polished wooden floor,
a copper water bottle and a folded linen towel,
morning sunlight casting long shadows through floor-to-ceiling windows.
Background: clean dark studio wall with a single potted monstera plant. ${STYLE}`,
  },
  {
    name: "entertainment",
    prompt: `A premium movie night setup: a vintage popcorn bucket overflowing with buttered popcorn,
two cinema tickets fanned out, a crystal glass of cola with ice,
the warm glow of a projector beam visible.
Background: dark velvet cinema seating, soft purple ambient light. ${STYLE}`,
  },
  {
    name: "bike",
    prompt: `A vintage mint-green bicycle with a wicker basket filled with wildflowers,
parked against a warm brick wall on a tree-lined cobblestone lane,
golden hour light casting a long shadow, leaves scattered on the ground. ${STYLE}`,
  },
  {
    name: "taxi",
    prompt: `A classic yellow taxi viewed from a cinematic low angle on a rain-wet city street at dusk,
warm headlights reflecting on the wet asphalt,
neon signs creating colorful bokeh in the background, slight motion blur. ${STYLE}`,
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
