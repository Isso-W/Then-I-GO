# Then-I-GO 后端与多 Agent 设计

**日期**: 2026-05-20
**截止**: 2026-06-03 (14 天)
**范围**: 在现有前端 React 原型基础上,新增本地 Node/Express 后端,实现真实多 Agent 路线生成、Vlog 生成、隐藏任务触发、LBS 校验、MBTI 冷启动与偏好自学习。

## 0. 目标与非目标

**目标**
- 把"假装的多 Agent"做成真的多 Agent(混合架构:部分纯 TS,部分 Gemini)
- 让 UI 中目前硬编码的 4 个功能(Vlog 生成、隐藏任务、LBS 校验、MBTI/自学习)走真实代码路径
- 黑客松 demo 全程稳定,Agent 失败不让 UI 卡死

**非目标**
- 用户认证(无登录)
- 云数据库(localStorage + 静态 POI JSON 已够)
- 生产部署(本地双进程)
- 真实视频剪辑(Vlog 只生成脚本)
- 多设备同步
- 多人协作

## 1. 整体架构与数据流

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (Vite dev server :3000)                              │
│                                                              │
│  React UI  ←→  src/services/api.ts (fetch 封装)              │
│       ↑                                                      │
│       ↓ localStorage                                         │
│  ┌─────────────────────────────────────┐                    │
│  │ mbti, tripHistory, prefs, gear,     │                    │
│  │ confirmedGear, currentRouteId,      │                    │
│  │ coupons, xp, achievements, vlogs    │                    │
│  └─────────────────────────────────────┘                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE
                               ↓
┌─────────────────────────────────────────────────────────────┐
│  Express 服务 (:3001)  — 完全无状态                          │
│                                                              │
│  POST /api/route        → routeOrchestrator                  │
│  POST /api/hidden-task  → hiddenOrchestrator                 │
│  POST /api/vlog (SSE)   → vlogOrchestrator                   │
│                              │                               │
│                              ↓                               │
│  agents/  ←─── pure TS: profilingAgent, poiSourcingAgent     │
│         ←─── Gemini:   routeNarrativeAgent,                  │
│                        hiddenTaskAgent, vlogAgent            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ↓
                         Google Gemini API
```

### 1.1 关键设计决策

- **后端完全无状态**。所有请求带全量 context (`mbti + prefs + history`),backend 重启不丢任何用户数据。
- **三个 endpoint 是入口**,内部 orchestrator 决定 Agent 调用顺序与降级策略,前端不知道编排细节。
- **POI 数据扎根 backend** (`server/data/pois.json`),前端永远拿不到完整 POI 列表。
- **localStorage 是唯一持久层**,trip history 在前端,每次生成路线时发给 backend,构成自学习闭环。
- **`GEMINI_API_KEY` 只在 server 一侧**,前端 bundle 不再注入,通过 `dotenv` 加载。

### 1.2 进程启动

```json
// package.json scripts
{
  "dev": "vite --port=3000",
  "dev:server": "tsx watch server/index.ts",
  "dev:all": "concurrently -n web,api -c blue,green \"npm:dev\" \"npm:dev:server\""
}
```

新增依赖: `concurrently`, `cors`, `zod`(schema 校验), `proper-lockfile`(可选)。`express` / `dotenv` / `tsx` 已存在。

## 2. 后端模块组织

```
Then-I-GO/
├── src/                          ← 前端 (保持现状结构)
│   ├── App.tsx
│   ├── types.ts                  → 改为 re-export shared/types + UI-only 类型
│   ├── screens/, components/
│   ├── services/                 ← 【新增】
│   │   ├── api.ts                → fetch 封装 (超时、重试、错误形状)
│   │   ├── storage.ts            → localStorage 抽象 (schema 版本)
│   │   ├── vlogStream.ts         → SSE parser (异步生成器)
│   │   └── geolocation.ts        → LBS + fake/real toggle
│   └── hooks/
│       └── useStorage.ts         → 订阅式读 PersistedState
│
├── shared/                       ← 【新增】前后端共用类型 (type-only)
│   └── types.ts
│
├── server/                       ← 【新增】整个后端
│   ├── index.ts                  → Express 启动入口 (:3001)
│   ├── routes/                   ← 路由层 (薄壳,不写业务)
│   │   ├── route.ts
│   │   ├── hiddenTask.ts
│   │   └── vlog.ts
│   ├── orchestrators/            ← 编排层 (串 Agent + 降级)
│   │   ├── routeOrchestrator.ts
│   │   ├── hiddenOrchestrator.ts
│   │   └── vlogOrchestrator.ts
│   ├── agents/                   ← 单职责 Agent
│   │   ├── profilingAgent.ts     → 纯 TS
│   │   ├── poiSourcingAgent.ts   → 纯 TS
│   │   ├── routeNarrativeAgent.ts→ Gemini × 1
│   │   ├── hiddenTaskAgent.ts    → Gemini × 1
│   │   └── vlogAgent.ts          → Gemini × 1
│   ├── services/
│   │   ├── geminiClient.ts       → 统一 Gemini 调用 (JSON 三级 fallback + 重试)
│   │   └── poiRepository.ts      → 启动加载 pois.json
│   ├── data/
│   │   └── pois.json             → 30 个 POI (带 lat/lng + cluster)
│   ├── utils/
│   │   ├── distance.ts           → Haversine
│   │   └── logger.ts             → 结构化日志
│   └── fallbacks/
│       └── fallbackRoute.ts      → 硬编码兜底 route 常量
│
├── scripts/
│   └── generatePOIs.ts           → 升级:分簇 + lat/lng + 严格 open_hours
│
├── tsconfig.json                 → 前端 (默认)
├── tsconfig.server.json          → 后端独立配置
├── package.json
└── vite.config.ts                → 加 server.proxy /api → :3001 (含 SSE no-buffer)
```

### 2.1 三层职责约定

| 层 | 职责 | 调 AI |
|---|---|---|
| **routes/** | 解析 HTTP body、调 orchestrator、返回响应 | 否 |
| **orchestrators/** | 决定 Agent 顺序、数据传递、降级策略 | 否 |
| **agents/** | 单一职责,只做自己那一件事 | 看情况 |

### 2.2 Agent 间数据契约

所有 Agent 的 input/output 都用 `shared/types.ts` 里的强类型。**不允许传 `any`**。

| Agent | input | output |
|---|---|---|
| profilingAgent | `{ prefs, mbti?, history? }` | `UserProfile` |
| poiSourcingAgent | `{ profile, currentLocation?, time }` | `RankedPOI[]` |
| routeNarrativeAgent | `{ profile, pois, prefs }` | `GeneratedRoute` |
| hiddenTaskAgent | `{ profile, currentLocation, excludeIds }` | `HiddenTask \| null` |
| vlogAgent | `{ tripHistory: TripRecord, prefs }` | `VlogScript` |

### 2.3 tsconfig 分离

- `tsconfig.json` — 前端,`include: ["src/**/*", "shared/**/*"]`,target ES2022,JSX react-jsx
- `tsconfig.server.json` — 继承前者,`include: ["server/**/*", "shared/**/*"]`,`module: "ESNext"`,`outDir: "dist-server"`,无 JSX

`npm run lint` 改为 `tsc --noEmit && tsc -p tsconfig.server.json --noEmit`。

## 3. API 设计

### 3.1 `POST /api/route` — 生成主路线

```typescript
// Request
{
  preferences: UserPreferences;
  mbti?: MBTI;
  history?: TripRecord[];           // 调用方传 tripHistory.slice(-5)
  currentLocation?: { lat, lng };
}

// Response 200
{
  generationId: string;             // crypto.randomUUID()
  route: GeneratedRoute;            // { title, waypoints[] }
}

// Response 4xx/5xx
{ error: { code, message, retryable } }
```

**约定**: `/api/route` 永远尝试返回 200 + 内容(降级到 fallback route),只有 `INVALID_REQUEST` 返回 400。前端只在 5xx 时显示"重试"按钮。

### 3.2 `POST /api/hidden-task` — 隐藏任务触发

```typescript
// Request
{
  generationId: string;
  preferences: UserPreferences;
  mbti?: MBTI;
  currentWaypointIndex: number;
  currentLocation?: { lat, lng };
}

// Response 200
{ task: HiddenTask }                // { name, description, task, reward, emoji,
                                    //   lat, lng, triggerDistanceM }

// Response 204
// orchestrator 决定不触发 (POI 池太空 / 都太远)
```

**调用时机**: 前端在 `checkin_initial` 完成后主动调一次。204 → 跳到 `next_objective`,200 → 进 `hidden_found`。

### 3.3 `POST /api/vlog` — Vlog 生成 (SSE)

```typescript
// Request
{
  generationId: string;
  tripHistory: { waypoints: CompletedWaypoint[], startedAt, finishedAt };
  preferences: UserPreferences;
}

// Response: text/event-stream
data: {"stage":"profiling","progress":10}
data: {"stage":"analyzing_clips","progress":25}
data: {"stage":"gemini_generating","progress":50}
data: {"stage":"rendering","progress":90}
data: {"stage":"complete","progress":100,"vlog":VlogScript}
// 失败:
data: {"stage":"error","error":{code,message,retryable}}
```

`VlogScript` 形状:

```typescript
interface VlogScript {
  title: string;
  narration: string;
  scenes: VlogScene[];
  durationSec: number;
}
interface VlogScene {
  timestamp: string;
  location: string;
  narration: string;
  mood: "warm" | "cool" | "energetic" | "calm";
}
```

**只生成脚本,不真渲染视频**。StoryScreen 把 narration 配原素材展示。

### 3.4 统一错误约定

```typescript
{
  error: {
    code: "GEMINI_PARSE_FAIL" | "GEMINI_QUOTA" | "GEMINI_TIMEOUT" |
          "POI_EMPTY" | "INVALID_REQUEST" | "INTERNAL" | "CLIENT_TIMEOUT";
    message: string;
    retryable: boolean;
  }
}
```

### 3.5 `shared/types.ts` 内容

```typescript
// 现有类型迁移
export interface UserPreferences { ... }
export interface Waypoint { ... }
export interface GeneratedRoute { title, waypoints, generationId? }
export interface POI {
  // 原有字段...
  lat: number;
  lng: number;
  cluster: 'north' | 'south' | 'east' | 'west' | 'center';
}

// 新增
export type MBTI = "INTJ" | "INTP" | "ENTJ" | "ENTP" | "INFJ" | "INFP" |
                   "ENFJ" | "ENFP" | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ" |
                   "ISTP" | "ISFP" | "ESTP" | "ESFP";

export interface UserProfile {
  traits: string[];                 // ["内向", "文艺", "慢节奏"]
  stayPreference: "short" | "medium" | "long";
  avoidCrowd: boolean;
  budgetTier: 1 | 2 | 3 | 4;
}

export interface TripRecord {
  generationId: string;
  startedAt: string;
  finishedAt: string;
  waypoints: CompletedWaypoint[];
  xpGained: number;
  couponsEarned: Coupon[];
}

export interface CompletedWaypoint {
  waypoint: Waypoint;
  completedAt: string;
  stayDurationMin: number;
  capturedClipMeta?: { filename, mood };
}

export interface HiddenTask {
  name: string;
  description: string;
  task: string;
  reward: string;
  emoji: string;
  lat: number;
  lng: number;
  triggerDistanceM: number;
}

export interface VlogScript {
  title: string;
  narration: string;
  scenes: VlogScene[];
  durationSec: number;
}

export interface VlogScene {
  timestamp: string;
  location: string;
  narration: string;
  mood: "warm" | "cool" | "energetic" | "calm";
}

export interface SavedVlog {
  generationId: string;
  tripId: string;                   // = TripRecord.generationId
  generatedAt: string;              // ISO
  script: VlogScript;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

**Reward → Coupon 映射** (前端职责,`src/services/rewardMapper.ts`):每个 waypoint 完成时,`waypoint.reward` 字符串(如 "美团单车7天卡")通过关键词匹配生成对应 `Coupon` 对象。映射表硬编码 4-6 种品类(单车/餐饮/打车/咖啡),无匹配则归类"通用奖励"。

`src/types.ts` 改造为:

```typescript
export * from '../shared/types';
// 保留 UI-only:
export type ScreenType = 'explore' | 'story' | 'bag' | 'mine' | 'event' | 'settings' | 'onboarding';
export type ExploreStep = ...;
export interface Coupon { ... }
export interface TimelineItemData { ... }
```

## 4. 状态归属

### 4.1 状态总表

| 状态 | 存哪 | 谁写 | 谁读 |
|---|---|---|---|
| `mbti` | localStorage | OnboardingScreen | App.tsx、每次 API |
| `lastPreferences` | localStorage | PreferenceOverlay | 下次启动回填 |
| `confirmedGear` | localStorage (已存在) | GearConfirmationOverlay | BagScreen |
| `tripHistory` | localStorage | achievement_unlock | 自学习 API 调用 |
| `currentTrip` (route + completed) | React state + localStorage | route 生成时、每个 checkin 后 | ExploreScreen |
| `currentGenerationId` | React state + localStorage | route 生成时 | hidden-task / vlog |
| `currentStep` | React state + localStorage | 每次 setExploreStep | 启动恢复 |
| `coupons` / `xp` / `achievements` | localStorage | trip 完成、奖励触发 | BagScreen / MineScreen |
| `vlogs` (脚本数组) | localStorage | Vlog SSE complete 时 | StoryScreen 历史 |
| `pois.json` | `server/data/` | 一次性 generate | poiSourcingAgent |

**后端不存任何用户数据。**

### 4.2 localStorage Schema

单根 key + 版本号 + migrate 函数:

```typescript
// src/services/storage.ts
const ROOT_KEY = 'then-i-go:v1';

interface PersistedState {
  schemaVersion: 1;
  mbti?: MBTI;
  lastPreferences?: UserPreferences;
  confirmedGear: string[];
  tripHistory: TripRecord[];        // FIFO,最多 30 条
  currentGenerationId?: string;
  currentRoute?: GeneratedRoute;
  currentStep?: ExploreStep;
  coupons: Coupon[];
  xp: number;
  achievements: string[];
  vlogs: SavedVlog[];               // VlogScript + 生成时间 + tripId
}

export const storage = {
  load(): PersistedState;
  save(patch: Partial<PersistedState>): void;
  clear(): void;
  migrate(raw: unknown): PersistedState;
};
```

### 4.3 关键生命周期节点

1. **App 启动** — `storage.load()` → 缺 `mbti` 跳 OnboardingScreen → 有 `currentGenerationId + currentRoute` 询问"继续上次?"
2. **PreferenceOverlay 确认** — `storage.save({ lastPreferences })`
3. **GearConfirmationOverlay 确认** — `api.generateRoute(...)` → 写 `currentGenerationId, currentRoute, currentStep=initial`
4. **完成 checkin_initial** — 调 `/api/hidden-task` → 200 跳 hidden_found,204 跳 next_objective
5. **每次 setExploreStep** — 同步写 `currentStep` 到 storage
6. **achievement_unlock** — 整理 currentTrip 为 TripRecord → push 进 tripHistory(slice(-30))→ 清空 currentGenerationId/Route/Step → 累加 xp / coupons / achievements
7. **StoryScreen 生成 Vlog** — SSE 完成时 push 进 vlogs

### 4.4 后端无状态的含义

- 每次请求带全量 context
- `generationId` 用 `crypto.randomUUID()`,前后端无共享计数器
- `pois.json` server 启动时 load 进内存一次,`poiRepository` 提供查询
- 没有"用户 id",刷新 = 换人(B 方案约定)

## 5. 错误处理与 Vlog 长任务

### 5.1 错误分类

| code | 后端动作 | 前端动作 |
|---|---|---|
| `GEMINI_PARSE_FAIL` | 重试 1 次,仍失败 → fallback | 静默,UI 用 fallback |
| `GEMINI_QUOTA` | 直接 fallback | 显示 "AI 累了,用了备用方案" 1 次 |
| `GEMINI_TIMEOUT` | 同上 | 同上 |
| `POI_EMPTY` | 主动放宽过滤再试 | 用户无感 |
| `INVALID_REQUEST` | 400 | 弹错误 dialog (开发期才撞) |
| `INTERNAL` | 500 + 日志 | 弹"出错重试" (retryable) |
| `CLIENT_TIMEOUT` | — | 同上 |

### 5.2 各 Agent 降级链

```
profilingAgent 失败       → 默认 profile { traits: [], stayPreference: "medium" }
poiSourcingAgent 读盘错  → 内置常量数组 (3 POI)
poiSourcingAgent < 3 个  → 放宽 mood_match 过滤再试 → 仍不足则 random sample
routeNarrativeAgent 失败 → FALLBACK_ROUTE 常量
hiddenTaskAgent 失败     → 返回 null (route 层返回 204)
vlogAgent 失败 (SSE 中)  → 推 stage:error,前端退出生成,不存半成品
```

**核心约束**: `/api/route` **永远不返回 5xx** (除 `INVALID_REQUEST`)。

### 5.3 前端 `api.ts` 封装

```typescript
async function apiCall<T>(
  path: string, 
  body: unknown, 
  opts: { timeoutMs: number }
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      
      if (res.ok) return await res.json();
      const err = await res.json() as ApiError;
      if (!err.error.retryable || attempt === 1) throw err;
    } catch (e) {
      if (e.name === 'AbortError') {
        throw { error: { code: 'CLIENT_TIMEOUT', message: '请求超时', retryable: true } };
      }
      if (attempt === 1) throw e;
    }
  }
  throw new Error('unreachable');
}
```

超时: `/api/route` 15s,`/api/hidden-task` 8s,`/api/vlog` 不走此封装。

### 5.4 SSE 实施关键点

后端:
- `res.flushHeaders()` 必须在第一次 `write` 前
- `data: ${json}\n\n` 双换行(SSE 规范)
- `req.on('close', () => abortGemini())` 检测客户端断开,停止 Gemini 节省 quota

`vite.config.ts` 关掉 proxy buffering:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyRes', (proxyRes) => {
          proxyRes.headers['cache-control'] = 'no-cache';
          proxyRes.headers['x-accel-buffering'] = 'no';
        });
      },
    },
  },
}
```

前端 SSE parser (fetch + manual,不用 EventSource 因为要 POST body):

```typescript
// src/services/vlogStream.ts
export async function* streamVlog(body, signal): AsyncGenerator<VlogEvent> {
  const res = await fetch('/api/vlog', { 
    method: 'POST', 
    body: JSON.stringify(body), 
    signal,
    headers: { 'Content-Type': 'application/json' },
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (chunk.startsWith('data: ')) yield JSON.parse(chunk.slice(6));
    }
  }
}
```

StoryScreen 用法:

```typescript
for await (const ev of streamVlog(body, controller.signal)) {
  if (ev.stage === 'complete') { saveVlog(ev.vlog); break; }
  if (ev.stage === 'error') { showError(ev.error); break; }
  setProgress(ev.progress);
  setStatusText(stageMessages[ev.stage]);
}
```

### 5.5 日志策略

- `server/utils/logger.ts` 简单 `console.log` 包装,带 ISO timestamp + level + structured data
- 每个 orchestrator 入口/出口 log: `[route] start prefs=... → end waypoints=2 duration=2.3s`
- 每个 Agent 调用 log input/output **shape**,不日志全文 prompt
- Gemini 失败时日志失败原因 + 前 200 字响应(定位幻觉)
- **不日志** mbti 内容、history 详情(只 log 条数),养习惯

### 5.6 Gemini Client 三级 JSON 提取 fallback

`geminiClient.ts`:

```typescript
function extractJson(text: string): unknown {
  // 一级:直接 parse
  try { return JSON.parse(text); } catch {}
  // 二级:找 ```json ... ``` 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) try { return JSON.parse(fence[1]); } catch {}
  // 三级:最贪婪正则
  const match = text.match(/[\{\[][\s\S]*[\}\]]/);
  if (match) try { return JSON.parse(match[0]); } catch {}
  throw new Error('GEMINI_PARSE_FAIL');
}
```

调用后用 `zod` schema 校验形状,缺字段也算 `GEMINI_PARSE_FAIL`。

## 6. 前端要改什么

### 6.1 新增文件

- `src/screens/OnboardingScreen.tsx` — MBTI 4 题二选一
- `src/services/api.ts` — fetch 封装
- `src/services/storage.ts` — localStorage 抽象
- `src/services/vlogStream.ts` — SSE parser
- `src/services/geolocation.ts` — LBS + fake/real toggle
- `src/hooks/useStorage.ts` — 订阅式读 PersistedState

### 6.2 `App.tsx` 改造

新增 state: `mbti`, `tripHistory`, `currentTrip`。启动时 `useEffect` 从 storage 恢复并决定首屏。

新增 handler:
- `handleAfterInitialCheckin` — 完成首站打卡后调 `/api/hidden-task`
- `handleTripComplete` — `achievement_unlock` 时整理 TripRecord 写入 history

改造 `handleGearConfirm`:用 `api.generateRoute(...)`(替换现 `routeAgent.generateRoute`),失败降级到本地 fallback。

### 6.3 `ExploreScreen.tsx` 改造

- `generatedRoute` prop 改为 `currentTrip`(含 generationId、route、hiddenTask、completed)
- `HiddenTaskAlert` 用 `currentTrip.hiddenTask` 渲染,删硬编码"转角咖啡店"
- `hidden_active` 的 NextTarget / TaskCard 用 hiddenTask.name / lat / lng
- `CameraInterface` 新增 prop `targetLat / targetLng`,`onMouseDown` 前调 `geolocation.checkProximity()`,太远禁用录制 + 提示距离
- `checkin_initial` 后不再直接进 `hidden_found`,改为调 `handleAfterInitialCheckin`

**不动**: 所有视觉组件(map texture, fog, dotted path, user avatar, progress panel)、所有 overlay 样式。

### 6.4 `StoryScreen.tsx` 改造

- "生成今日 AI Vlog" 按钮接 `streamVlog()`,删现 setInterval 假进度
- `VlogGenerationOverlay` 的 status/progress 接真 SSE 事件
- 历史 Vlog 列表从 `storage.load().vlogs` 渲染,删硬编码
- 今日素材时间线从 `currentTrip?.completed` 或最近 TripRecord 渲染

### 6.5 `BagScreen.tsx` / `MineScreen.tsx` 改造

- **BagScreen**: `coupons` / `items` 从 storage 读,删硬编码
- **MineScreen**: `LV.x` / 4 个 StatCard 数字从 storage 算(xp/100, tripHistory.length, etc.)
- **FootprintMap**(MineScreen): 可选,从 tripHistory waypoints 的 lat/lng 转 SVG 坐标 — 排期紧可跳过

### 6.6 类型迁移

```
src/types.ts (旧)                shared/types.ts (新)
├── ScreenType (UI-only,留)       ├── UserPreferences
├── ExploreStep (UI-only,留)      ├── Waypoint
├── Coupon (UI-only,留)           ├── GeneratedRoute
├── TimelineItemData (UI-only,留) ├── POI (加 lat/lng/cluster)
├── UserPreferences ──────→       ├── MBTI (新)
├── Waypoint ─────────→           ├── UserProfile (新)
├── GeneratedRoute ───→           ├── TripRecord (新)
└── POI ──────────────→           ├── CompletedWaypoint (新)
                                  ├── HiddenTask (新)
                                  ├── VlogScript (新)
                                  ├── VlogScene (新)
                                  └── ApiError (新)
```

`src/types.ts` 改为 `export * from '../shared/types'` + 保留 UI-only 类型。

### 6.7 重构 ExploreScreen.tsx (最后 2 天)

```
src/screens/explore/
├── index.tsx                 (主组件 + step 分发,~150 行)
├── overlays/
│   ├── IntroOverlay.tsx
│   ├── PreferenceOverlay.tsx (~240 行)
│   ├── GearConfirmationOverlay.tsx
│   ├── HiddenTaskAlert.tsx
│   ├── RewardOverlay.tsx
│   ├── AchievementOverlay.tsx
│   └── CameraInterface.tsx   (~100 行)
├── map/
│   ├── CityMapTexture.tsx
│   ├── FogLayer.tsx
│   ├── DottedPath.tsx
│   ├── UserAvatar.tsx
│   ├── NextTarget.tsx
│   ├── UnknownMarkers.tsx
│   └── Legend.tsx
└── TaskCard.tsx
```

**纪律**: 放最后 2 天,不要边加功能边拆。

## 7. POI 数据补 lat/lng

### 7.1 schema 升级

```typescript
interface POI {
  // 原字段不动
  lat: number;          // 保留 4 位小数,如 31.2305
  lng: number;
  cluster: 'north' | 'south' | 'east' | 'west' | 'center';
}
```

### 7.2 坐标生成 — Gemini 在 bounding box 内分簇

承认这是虚构地图,只要内部自洽。

`scripts/generatePOIs.ts` prompt 增加:

```
30 个 POI 分 5 簇,每簇 6 个,簇间步行距离 15-30 分钟:
cluster: "center"  → lat: 31.230~31.234, lng: 121.448~121.452
cluster: "north"   → lat: 31.238~31.242, lng: 121.448~121.452
cluster: "south"   → lat: 31.222~31.226, lng: 121.448~121.452
cluster: "east"    → lat: 31.230~31.234, lng: 121.456~121.460
cluster: "west"    → lat: 31.230~31.234, lng: 121.440~121.444
同一簇内 POI 间距 100~500 米。坐标 4 位小数。
```

`poiSourcingAgent` 强制:一次 route 的所有 waypoint 来自同一簇或相邻簇。

### 7.3 `open_hours` 收紧

prompt 强约束:

```
open_hours 严格只能是 "HH:MM-HH:MM",例如 "09:00-22:00"。
不允许:
- "24小时" / "全天" → 写 "00:00-23:59"
- "11:00-14:00, 17:00-22:00" → 选主营业段
- "18:00-次日02:00" → 写 "18:00-23:59"
```

backend `isOpen()` 解析失败兜底为 `true`。

### 7.4 LBS 校验:`useFakeLocation` 开关

`src/services/geolocation.ts`:

```typescript
let config = { useFakeLocation: true };

export async function getCurrentPosition(): Promise<{lat, lng}> {
  if (config.useFakeLocation) {
    const target = getCurrentTargetWaypoint();   // 从全局 currentTrip 拿
    return {
      lat: target.lat + (Math.random() - 0.5) * 0.0004,  // 抖动 ±20m
      lng: target.lng + (Math.random() - 0.5) * 0.0004,
    };
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

export async function checkProximity(
  target: { lat, lng },
  thresholdM = 50
): Promise<{ withinRange, distanceM }> {
  const here = await getCurrentPosition();
  const distance = haversine(here, target);
  return { withinRange: distance <= thresholdM, distanceM: distance };
}
```

**fake mode 永远在目标 20m 内**,LBS 永远通过 + 距离数字看起来真实。SettingsScreen 加 toggle。

### 7.5 数据生成流程

```bash
npm run generate:pois
# 输出到 server/data/pois.json (脚本里改 outputPath)
```

数据一次性 commit 进仓库,demo 当天不再调 Gemini 生成。

### 7.6 数据可视化 (demo 前 1 天)

写 `scripts/visualizePOIs.ts` 把 30 个点画 SVG,目测分簇合理性。某簇太散就重生成那一簇。

## 8. 14 天实施排期

### Day 1-2: 地基

- **Day 1** — 后端骨架:`server/` 目录、`tsconfig.server.json`、Express + cors + dotenv、`shared/types.ts` 类型迁移、`vite.config.ts` 加 proxy(含 SSE no-buffer)、`concurrently` 进 npm scripts、`/api/health` smoke test。
  *验收*: `npm run dev:all` 同时起两个进程,浏览器 fetch `/api/health` 拿到 `{ ok: true }`。
  *坑*: `package.json` 是 `"type": "module"`,server 代码 ESM 化,`__dirname` 用 `fileURLToPath(import.meta.url)`。**Vite 的 `define` 里删掉 `GEMINI_API_KEY` 注入**(防泄漏前端)。

- **Day 2** — `geminiClient.ts`(三级 JSON 提取 + zod 校验 + 分类重试)+ `poiRepository.ts` + 升级 `generatePOIs.ts`(分簇 lat/lng + 严格 open_hours),跑一次生成 `server/data/pois.json`。
  *验收*: unit test 调 geminiClient 让生成简单 JSON,parse 成功。`pois.json` 30 条,5 簇分布。

### Day 3-5: 核心多 Agent

- **Day 3** — `profilingAgent.ts`(纯 TS,deterministic)+ `poiSourcingAgent.ts`(过滤打分,零结果放宽)。
  *验收*: mock prefs 输入 → profile 输出稳定;poiSourcingAgent 所有 case 返回 ≥ 3 POI。
  *坑*: zero-result 级联 — 过滤完空集时必须放宽再试,绝不能传 `[]` 给 Gemini。

- **Day 4** — `routeNarrativeAgent.ts`(Gemini, temperature 0.8)+ `routeOrchestrator.ts`(串 Profiling → POI → routeNarrative,各级降级)+ `routes/route.ts` endpoint。
  *验收*: `curl -X POST localhost:3001/api/route -d '...'` 拿到合法 GeneratedRoute,所有 waypoint 都在 pois.json 里。
  *坑*: temperature 不要全用默认值,每个 Agent 单独设。

- **Day 5** — `hiddenTaskAgent.ts`(temperature 0.9, 更跳跃)+ `hiddenOrchestrator.ts`(从 POI 池排除当前路线,距离 < 500m 优先)+ `routes/hiddenTask.ts`。
  *验收*: `curl POST /api/hidden-task` 拿到 HiddenTask 或 204(POI 池被排空时)。
  *Checkpoint*: 后端能独立 demo(curl 模拟前端)。延期则 Day 8 后压力陡增。

### Day 6-7: Vlog + SSE

- **Day 6** — `vlogAgent.ts`(temperature 0.7)+ `vlogOrchestrator.ts`(内部分步推 progress)+ `routes/vlog.ts` 用 SSE。
  *验收*: `curl -N localhost:3001/api/vlog -d ...` 看到 stage 事件流,complete 事件携带 VlogScript。
  *坑*: `res.flushHeaders()` 必须在第一次 write 前;`req.on('close', ...)` 触发时停 Gemini 调用。

- **Day 7** — 前端 `src/services/vlogStream.ts` SSE parser(异步生成器)+ 验证 Vite proxy 不 buffer SSE。
  *验收*: 浏览器 fetch `/api/vlog` 能逐条收到事件,不是一起到。
  *坑*: SSE buffering 实在搞不定的话,降级到 polling(`/api/vlog/start` 拿 jobId,`/api/vlog/status/:id` 轮询),作为 Plan B 留余地。

### Day 8-9: 前端联调

- **Day 8** — `services/api.ts`(超时 15s/8s + 单次重试)+ `services/storage.ts`(schema v1 + migrate)+ `App.tsx` 改造接 mbti/history。`OnboardingScreen.tsx` 4 道二选一 MBTI。
  *验收*: 首次打开跳 onboarding 收 MBTI,二次打开直接 explore;localStorage 看到 `then-i-go:v1` 根 key。

- **Day 9** — 主流程接通: ExploreScreen 改用 currentTrip,`/api/route` 替换现有前端 routeAgent,`/api/hidden-task` 在 checkin_initial 后触发。
  *验收*: 偏好 → 装备 → AI 生成路线 → 走完整流程,所有 waypoint 内容来自真 API,刷新页面能恢复进度。
  *Checkpoint*: UI 真接通,之后可以请人试用。

### Day 10-11: LBS + MBTI + 自学习

- **Day 10** — `services/geolocation.ts`(useFakeLocation toggle + Haversine)+ CameraInterface 加 proximity check。
  *验收*: 打卡前必须过 LBS 检查;fake mode 永远通过,显示距离从 30m 倒数到 12m。
  *坑*: HTTPS 在 localhost 可豁免,production 部署才需要。SettingsScreen 加 toggle 给评委演示。

- **Day 11** — 自学习闭环: achievement_unlock 写 TripRecord,下次 /api/route 自动带 `history.slice(-5)`。`routeNarrativeAgent` prompt 增加 history 解读段落。
  *验收*: 连续生成两条路线,backend log 第二条 prompt 里有 history;肉眼看 narrative 引用了上次。
  *Checkpoint*: 4 个额外功能全部完成,之后只剩重构和 polish。

### Day 12-13: 数据接通 + 重构

- **Day 12** — BagScreen 改读 storage(删硬编码),MineScreen 同样,StoryScreen 历史 tab 读 storage.vlogs。拆 ExploreScreen.tsx → `screens/explore/{overlays,map}/`,每个组件单独 commit。
  *验收*: `npm run lint` pass,端到端 demo flow 跑通无 regression。
  *坑*: 拆文件时每个 commit 只动一个 overlay,小步走,出问题易定位。

- **Day 13** — 端到端 demo 走 5 遍记 bug,修关键 bug。可视化检查 POI 分簇(`scripts/visualizePOIs.ts`),不合理就重生成。VlogScript 文案逐句过,调 prompt 让文案更有故事感。
  *Checkpoint*: 稳定版,Day 14 只动文案和录像。

### Day 14: Polish + Demo

- 最后修 bug + 录 demo 视频 + 更新 README + commit + push。
- **绝不加新功能**。

### 总体 checkpoint

| Day | Milestone | 延期风险 |
|---|---|---|
| 5 末 | 后端独立可 demo | 高 |
| 9 末 | UI 真接通 | 高 |
| 11 末 | 4 额外功能完成 | 中 |
| 13 末 | 稳定版 | 低 |

### 风险与缓解

- **SSE buffering 调不通** → Day 7 留时间评估,Plan B 降级到轮询
- **Gemini quota 撞墙** → 提前申请额度;开发期把 routeNarrativeAgent 用 mock response 顶替;关键 demo 前不疯狂测试
- **重构引入 regression** → 拆文件时每 commit 一个组件,有问题快速 revert
- **fake location 露馅** → SettingsScreen toggle 把"真 GPS"作为对照模式,评委有需要可演示真实判定逻辑

## 9. 验收清单 (demo 合格的最低要求)

- [ ] 首次启动跳 OnboardingScreen 收 MBTI,localStorage 持久化
- [ ] 偏好 + 装备页正常,确认后调真 API 拿路线
- [ ] 路线含 2-3 个 waypoint,来自 pois.json (非 Gemini 编造)
- [ ] 任意 waypoint 打卡前过 LBS 校验(fake mode)
- [ ] checkin_initial 后触发隐藏任务(或显式跳过),隐藏点 POI 来自真 API
- [ ] 完成全程后跳 StoryScreen,点 Vlog 生成看到 4 阶段 SSE 进度
- [ ] VlogScript 生成成功,持久化到 localStorage,在历史 tab 看到
- [ ] BagScreen 三个 tab 数据来自 storage 不是硬编码
- [ ] MineScreen 等级/统计来自 storage 计算
- [ ] 连续生成两条路线,第二条 prompt 含 history
- [ ] 中途刷新浏览器能恢复进度
- [ ] 任一 Agent 失败时 UI 不卡死,降级到 fallback
- [ ] `npm run lint` 前后端都 pass
- [ ] `npm run dev:all` 一条命令起完整环境
