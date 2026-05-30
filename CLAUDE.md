# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**那我走 (Then-I-GO)** is a hackathon project for the local-life track. The core concept: the user says "let's go" — the system figures out where.

**What it does**: A weekend walk recommendation app powered by a multi-agent AI backend. Instead of the user planning a route, the system generates a personalized exploration itinerary on demand, then guides the user through it with check-in tasks and rewards.

**Key differentiators**:
- **Multi-agent route generation**: Multiple AI agents collaborate to produce a route — one agent handles user profiling (MBTI, past exploration history, stated mood/preferences), another sources nearby POIs, another assembles the narrative and task sequence. The Gemini API (`@google/genai`) is the AI backbone.
- **Personalization inputs**: MBTI personality type, mood at launch time, duration preference, transport mode, interest tags (art / outdoor / food / nightlife / family-friendly / photo spots / niche / budget), food preferences, and "how much do you want to think?" intensity level — all collected in `PreferenceOverlay` before route generation.
- **Gamified progression**: The route is structured as a sequence of tasks (`ExploreStep` state machine). Completing check-ins (photo/vlog capture) unlocks the next waypoint and awards XP + real merchant coupons (dining, bike-share, ride-hailing).
- **Hidden task layer**: Beyond the main route, the system can surface hidden POI tasks mid-exploration that the user didn't plan for, adding surprise discovery moments.
- **Vlog auto-generation**: Captured clips from check-ins are fed back to the AI to produce a short auto-edited Vlog of the day's exploration (see `StoryScreen`).

## Multi-Agent Design

The AI backend is organized around distinct agents, each with a single responsibility:

| Agent | Responsibility |
|---|---|
| **Profiling Agent** | Builds and updates the user model from MBTI, interest tags, mood input, and historical check-in behavior. Outputs a structured user profile for other agents to consume. |
| **POI Sourcing Agent** | Queries nearby points of interest filtered by current location, operating hours, weather, and traffic. Ranks candidates against the user profile. |
| **Routing Agent** | Assembles POIs into a walkable sequence. Produces **binary tree decision nodes** at key junctures — two meaningfully different options (e.g. quiet bookstore vs. lively café) so the user navigates like a text adventure rather than following a fixed plan. |
| **Narrative Agent** | Wraps each waypoint in story context and generates the hidden-task trigger text, check-in prompts, and reward copy. |
| **Vlog Agent** | Post-trip: ingests captured clips and location timestamps, then produces a short edited Vlog with style filter applied (planned styles: cyberpunk, retro film, Japanese fresh). |

**Preference self-learning loop**: After each trip, the Profiling Agent reads which waypoints the user actually visited, how long they stayed, and whether they triggered hidden tasks, then automatically adjusts weights in the user profile. This closes the feedback loop without requiring explicit ratings.

## Geolocation

`metadata.json` declares `requestFramePermissions: ["geolocation"]`. The intended use is LBS-based check-in validation: the system confirms the user is physically within range of a waypoint before allowing the check-in capture to proceed. The current frontend simulates this with the `CameraInterface` component; real distance checks against the Geolocation API are not yet wired up.

## Planned / Not Yet Implemented

Features specified but not present in the current frontend prototype:

- **Cold-start onboarding screen** — first-launch flow collecting MBTI and base interest tags. No corresponding `ScreenType` value or screen component exists yet; this needs a new `onboarding` screen added to `App.tsx`.
- **Binary tree route UI** — the `ExploreStep` machine currently has a linear path. A/B decision nodes need a new step type and a choice overlay component.
- **Real LBS validation** — `navigator.geolocation` integration for proximity checks before check-in is allowed.
- **Preference self-learning write-back** — backend call after trip completion to update the user profile.
- **Vlog style selection** — UI for picking cyberpunk / retro film / Japanese fresh before Vlog generation (currently `StoryScreen` has no style picker).
- **Social sharing reward** — sharing a generated Vlog to an external platform grants in-app titles or bonus items.
- ~~Multi-player collaborative routing~~ — scoped out for the hackathon.

## 地理数据层 — Implemented

### 区域定位

项目地点已从上海静安区改为**北京五道口**（海淀区高校聚集区，清华/北林/北语周边）。
BBOX：lat 39.980~40.005，lng 116.320~116.358，以五道口地铁站为中心。

### 路网数据（`scripts/data/street-network.json`）

因国内访问 OpenStreetMap Overpass API 不稳定，改用 Gemini 生成模拟路网。

```bash
npx tsx scripts/fetchStreetNetwork.ts   # 生成 scripts/data/street-network.json
```

输出 35 条路段（主路/次路/支路/步行街）、76 条子线段，总长约 28km。
覆盖成府路、中关村北大街、学院路、清华东路、双清路、王庄路等主要街道。

### 地表数据（`scripts/data/terrain.json`）

校园 / 公园 / 水体 / 商业区多边形，渲染在地图路网下方做底色，并作为 POI 落位依据。

```bash
npx tsx scripts/generateTerrain.ts   # 生成 scripts/data/terrain.json
```

与路网/POI 不同，这里是**确定性脚本**而非 Gemini 生成：地块边界是真实地理事实（清华校园、清华荷塘等），LLM 重画会失真、自交，且会和已落位的 POI 脱钩。脚本内联 11 个手工核定区域（5 校园/3 公园/1 水体/2 商业区），带 BBOX 与退化校验。`TerrainData` 类型由本脚本导出，`snapPOIsToRoads.ts` 直接复用。

### POI 数据（`src/data/pois.json`）

不接入实时第三方 API（高德需付费，大众点评/美团不对外开放，Google Maps 国内受限）。改用 Gemini 分批生成，结果 commit 进仓库，demo 完全离线。

```bash
# 完整生成流程（snapPOIsToRoads 依赖 terrain.json，故须先跑 generateTerrain）：
npx tsx scripts/generatePOIs.ts          # 1. 生成 POI 内容（分3批，每批~38个，共~105个）
npx tsx scripts/generateTerrain.ts       # 2. 生成地表多边形 → scripts/data/terrain.json
npx tsx scripts/snapPOIsToRoads.ts       # 3. POI 按类目落位（公园→park多边形 / 自习室→campus / 其余→路网加权）
npx tsx scripts/visualizeStreetNetwork.ts  # 4. 可选：生成可视化地图 → scripts/data/street-network.html
```

**POI 数据结构（`src/types.ts` → `POI` 接口）**

```
id, name, category, tags[]          基础信息
area, address, lat, lng             地理位置（坐标经 snapPOIsToRoads 吸附到路网）
open_hours                          营业时间
avg_stay_minutes, avg_wait_minutes  路线时长计算依据
crowd_level                         low / medium / high，影响舒适度评分
price_level                         1-4档，配合 budget 偏好过滤
rating, review_summary, reviews[]   评价语料
mood_match[], mbti_tags[]           偏好匹配维度
best_time                           推荐游玩时段文案
```

**生成策略**：分 3 批（西北区/东北区/南部区）各生成约 38 个，限定每批坐标范围，避免扎堆。生成后 `snapPOIsToRoads.ts` 按 category 落位：公园绿地落进 park 多边形、共享空间/自习室落进 campus 多边形（rejection sampling + 射线检测），其余 POI 按路段长度加权随机分布到路网上。

**POI 类型覆盖**（20 种）：咖啡厅、餐厅系列（日韩/北京风味/素食）、奶茶甜品、书店、文创小店、美术馆、livehouse、公园绿地、酒吧系列、夜宵烧烤、便利店、花店、健身瑜伽、共享自习室、洗衣生活服务、宠物友好咖啡。

### 路由逻辑（待实现）

生成数据后，`routeAgent.ts` 的工作流应升级为：

```
1. 按用户偏好标签过滤 pois.json（tags 交集）
2. 过滤不营业的 POI（open_hours vs 当前时间）
3. 过滤排队过长的 POI（avg_wait_minutes > 阈值）
4. 计算候选组合的总时长是否符合 duration 偏好
5. 把筛选后的候选列表（10条以内）传给 Gemini
6. Gemini 负责：最终选择 + 排序 + 写故事 + 生成打卡任务
```

这样 Gemini 不再凭空编造地点，而是从真实结构化数据里做最终决策。

## AI Route Generation — Implemented

### Files involved

| File | Role |
|---|---|
| `src/agents/routeAgent.ts` | 唯一与 Gemini API 通信的模块。接收 `UserPreferences`，返回 `GeneratedRoute`。 |
| `src/types.ts` | 新增 `UserPreferences`、`Waypoint`、`GeneratedRoute` 三个接口。 |
| `src/App.tsx` | 持有 `preferences` 和 `generatedRoute` 两个全局 state，协调调用时机。 |
| `src/screens/ExploreScreen.tsx` | 消费 `generatedRoute`，驱动地图标记和任务卡片显示真实内容。 |

### 数据流

```
PreferenceOverlay
  → onConfirm(prefs)              用户选完偏好，数据传给 App.tsx
      → App: handlePreferenceConfirm()
          → preferences state 更新
          → step 切换到 gear_confirmation

GearConfirmationOverlay
  → onConfirm()                   用户确认装备，触发 AI 调用
      → App: handleGearConfirm()
          → isGenerating = true（全屏转圈动画）
          → generateRoute(preferences)   ← routeAgent.ts
              → 偏好 id 翻译为中文标签
              → 组装 prompt 发给 Gemini
              → 解析返回的 JSON
          → generatedRoute state 更新
          → isGenerating = false
          → step 切换到 initial

ExploreScreen（地图界面）
  └── TaskCard     使用 waypoints[0/1].name / task / description / reward
      · waypoints[0] → initial / checkin_initial 阶段
      · waypoints[1] → next_objective / checkin_next 阶段
      · hidden_active 阶段仍使用硬编码内容（隐藏任务暂未接入 AI）
```

### 容错设计

所有 waypoint 字段读取均使用 `??` 降级（如 `wp0?.name ?? "前往第一站"`），保证 API 出错或超时时 UI 不崩溃，回退到原始硬编码文案。

### Gemini 调用规范

- 模型：`gemini-2.5-flash-lite`（`gemini-2.5-flash` 在国内高峰期频繁 503，lite 版稳定性更好）
- 要求 Gemini **只返回 JSON**，用正则 `/\{[\s\S]*\}/` 或 `/\[[\s\S]*\]/` 从响应文本中提取，防止 Gemini 在 JSON 前后多说话导致解析失败。
- API Key 通过 `process.env.GEMINI_API_KEY` 注入（由 `vite.config.ts` 的 `define` 字段在构建时替换）。
- 脚本层通过 `$env:GEMINI_API_KEY="..."; npx tsx scripts/xxx.ts` 传入，或读取 `.env.local`。

## Commands

```bash
npm run dev            # Start dev server at http://localhost:3000
npm run build          # Production build
npm run lint           # TypeScript type-check (tsc --noEmit) — the only linter
npm test               # Run the vitest suite once（tests/ 目录）
npm run test:watch     # vitest watch mode
npm run preview        # Preview the production build
npm run clean          # Remove dist/
npm run generate:pois  # 一次性生成 POI 模拟数据 → src/data/pois.json（需要 GEMINI_API_KEY）

# 地理数据生成（一次性，结果 commit 进仓库）
npx tsx scripts/fetchStreetNetwork.ts      # 生成路网 → scripts/data/street-network.json
npx tsx scripts/generatePOIs.ts           # 生成 POI → src/data/pois.json
npx tsx scripts/generateTerrain.ts        # 生成地表多边形 → scripts/data/terrain.json
npx tsx scripts/snapPOIsToRoads.ts        # POI 按类目落位（依赖 terrain.json，覆盖 pois.json）
npx tsx scripts/visualizeStreetNetwork.ts # 可视化地图 → scripts/data/street-network.html
```

Tests live in `tests/` and run with `npm test` (vitest), covering the pure routing/geo logic（`poiFilter`、`roadGraph`、`mapProjection`、`derivePosition`）。

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The app is designed to run on Google AI Studio, which injects this key at runtime.

## Architecture

**Screen routing** is handled entirely in `src/App.tsx` via a `screen: ScreenType` React state value — there is no router library. `onNavigate(screen)` callbacks are passed down to each screen component. The six screens are: `explore`, `story`, `bag`, `mine`, `event`, `settings`.

**ExploreScreen sub-state machine**: The Explore screen has its own `step: ExploreStep` state (also owned by `App.tsx` so it survives tab switches). The step drives which overlays, map markers, task cards, and camera interfaces are rendered. The progression is:
`intro` → `preference_selection` → `gear_confirmation` → `initial` → `checkin_initial` → `hidden_found` → `hidden_active` → `checkin_hidden` → `reward_hidden` → `next_objective` → `checkin_next` → `achievement_unlock` → (back to `intro`).

**Shared layout components** (`src/components/Layout.tsx`):
- `AppLayout` — outer shell that constrains width to 500px and renders a simulated iOS status bar. Every screen wraps its content in this.
- `Glass` — glassmorphism `motion.div` card used throughout for floating panels.

**Shared UI components** (`src/components/CommonUI.tsx`):
- `BottomNav` — four-tab nav bar rendered by every main screen (`explore`, `story`, `bag`, `mine`).
- `PageTitle`, `TabBar` — used in secondary screens.

**Types** (`src/types.ts`): 所有共享接口都在这里定义。
- UI 基础类型：`ScreenType`、`ExploreStep`、`Coupon`、`TimelineItemData`
- AI 路线类型：`UserPreferences`（偏好输入）、`Waypoint`（单个打卡点）、`GeneratedRoute`（完整路线，含 `title` 和 `waypoints[]`）
- POI 数据类型：`POI`（数据库记录，含评价语料、时间约束、偏好匹配字段）

**Gear persistence**: The gear checklist confirmed in `GearConfirmationOverlay` is saved to `localStorage` under the key `confirmedGear` (JSON array of string IDs). `BagScreen` reads this to populate the Equipment tab.

## Styling conventions

- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.*` file needed).
- Dark neon aesthetic: primary background `#05060F` / `#0A0A1A`, accent purple `#6C5CFF` / `#A98BFF`, gold `#FFD166`, cyan `#00E5FF`, alert red `#FF4D64`.
- Animations use `motion/react` (`framer-motion` v12). `AnimatePresence` wraps conditional renders. `layoutId` is used on nav glow and tab underline for shared-element transitions.
- Icons come exclusively from `lucide-react`.
- The `@` path alias resolves to the project root (configured in `vite.config.ts`).
