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

## POI 数据层 — Implemented

### 设计决策

不接入实时第三方 API（高德需付费，大众点评/美团不对外开放，Google Maps 国内受限）。改用**一次性 AI 生成的模拟数据**，存为静态 JSON 文件提交进仓库。

这个方案完整满足黑客松评审要求：
- POI 数据与服务 → `src/data/pois.json`
- 用户评价语料 → 每条 POI 含 `reviews[]` 和 `review_summary`
- 时空约束 → `avg_stay_minutes + avg_wait_minutes` 计算总时长，`open_hours` 过滤营业状态
- 路线可行、排队适中 → `avg_wait_minutes < 20` 过滤，`crowd_level` 作为舒适度约束

### POI 数据结构（`src/types.ts` → `POI` 接口）

```
id, name, category, tags[]          基础信息
area, address, open_hours           地理与时间
avg_stay_minutes, avg_wait_minutes  路线时长计算依据
crowd_level                         low / medium / high，影响舒适度评分
price_level                         1-4档，配合 budget 偏好过滤
rating, review_summary, reviews[]   评价语料
mood_match[], mbti_tags[]           偏好匹配维度
best_time                           推荐游玩时段文案
```

### 数据生成

**只需跑一次，结果 commit 进仓库，之后 demo 完全离线。**

```bash
npx tsx scripts/generatePOIs.ts   # 生成 src/data/pois.json
```

脚本位置：`scripts/generatePOIs.ts`。调用 Gemini 生成 30 个上海静安区风格的 POI，覆盖咖啡厅、书店、公园、美术馆、餐厅等多种类型，以及 low/medium/high 三种客流等级。

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
  ├── NextTarget   使用 waypoints[0/1].name / emoji / distanceText
  └── TaskCard     使用 waypoints[0/1].name / task / description / reward
      · waypoints[0] → initial / checkin_initial 阶段
      · waypoints[1] → next_objective / checkin_next 阶段
      · hidden_active 阶段仍使用硬编码内容（隐藏任务暂未接入 AI）
```

### 容错设计

所有 waypoint 字段读取均使用 `??` 降级（如 `wp0?.name ?? "前往第一站"`），保证 API 出错或超时时 UI 不崩溃，回退到原始硬编码文案。

### Gemini 调用规范

- 模型：`gemini-2.5-flash`
- 要求 Gemini **只返回 JSON**，用正则 `/\{[\s\S]*\}/` 从响应文本中提取，防止 Gemini 在 JSON 前后多说话导致解析失败。
- API Key 通过 `process.env.GEMINI_API_KEY` 注入（由 `vite.config.ts` 的 `define` 字段在构建时替换）。

## Commands

```bash
npm run dev            # Start dev server at http://localhost:3000
npm run build          # Production build
npm run lint           # TypeScript type-check (tsc --noEmit) — the only linter
npm run preview        # Preview the production build
npm run clean          # Remove dist/
npm run generate:pois  # 一次性生成 POI 模拟数据 → src/data/pois.json（需要 GEMINI_API_KEY）
```

There is no test suite.

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
