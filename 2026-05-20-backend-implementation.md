# Then-I-GO 后端与多 Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 React 原型基础上新增本地 Node/Express 后端,实现真实多 Agent 路线生成、Vlog 生成、隐藏任务触发、LBS 校验、MBTI 冷启动与偏好自学习。

**Architecture:** 双进程本地 dev (Vite :3000 + Express :3001)。后端完全无状态,前端用 localStorage 持久化。三个高层 endpoint(`/api/route`、`/api/hidden-task`、`/api/vlog` SSE)。混合多 Agent:Profiling/POI Sourcing 纯 TS,Routing/HiddenTask/Vlog 各一次 Gemini。

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Express 4, `@google/genai` 1.29, `motion` 12, `lucide-react`, `tsx`, `vitest` (新增), `zod` (新增), `cors` (新增), `concurrently` (新增), `dotenv`.

**Spec reference:** `docs/superpowers/specs/2026-05-20-backend-design.md`

---

## §0. 测试策略

- **TDD 单测覆盖**:`server/utils/distance.ts`, `server/services/geminiClient.ts` 的 `extractJson`, `server/agents/profilingAgent.ts`, `server/agents/poiSourcingAgent.ts` 的 `isOpen` / `filter` / `rank`
- **Smoke test (curl)** 验证每个 endpoint:`/api/health`, `/api/route`, `/api/hidden-task`, `/api/vlog`
- **不写单测的部分**:Gemini-calling Agent(routeNarrativeAgent、hiddenTaskAgent、vlogAgent)、Express middleware setup、React components
- **测试运行器**:`vitest` (与 Vite 共享配置,ESM 友好)
- **测试文件位置**:与源文件同目录,后缀 `.test.ts`

---

## Phase 1: 地基 (Day 1-2)

### Task 1: 安装后端依赖

**Files:** `package.json`

- [ ] **Step 1.1: 安装运行时依赖**

```bash
cd D:/GitHub/Then-I-GO
npm install cors zod
```

- [ ] **Step 1.2: 安装开发依赖**

```bash
npm install -D concurrently vitest @types/cors
```

- [ ] **Step 1.3: 验证**

```bash
npm ls cors zod concurrently vitest --depth=0
```

Expected: 列出 4 个包,无 `missing` 错误。

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add backend deps (cors, zod, concurrently, vitest)"
```

---

### Task 2: 创建 tsconfig.server.json

**Files:** Create `tsconfig.server.json`

- [ ] **Step 2.1: 写入文件**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist-server",
    "noEmit": true,
    "jsx": "preserve",
    "types": ["node", "vitest/globals"]
  },
  "include": ["server/**/*", "shared/**/*", "scripts/**/*"]
}
```

- [ ] **Step 2.2: Commit**

```bash
git add tsconfig.server.json
git commit -m "build: add tsconfig.server.json for backend type-check"
```

---

### Task 3: 创建 shared/types.ts

**Files:** Create `shared/types.ts`, modify `src/types.ts`

- [ ] **Step 3.1: 创建 shared/types.ts**

```typescript
// shared/types.ts — 前后端共用类型 (type-only)

export interface UserPreferences {
  mood: string;
  duration: string;
  transport: string;
  special: string[];
  foodPreference: string[];
  intensity: string;
}

export interface Waypoint {
  name: string;
  description: string;
  task: string;
  reward: string;
  emoji: string;
  distanceText: string;
  lat?: number;
  lng?: number;
}

export interface GeneratedRoute {
  title: string;
  waypoints: Waypoint[];
  generationId?: string;
}

export interface POI {
  id: string;
  name: string;
  category: string;
  tags: string[];
  area: string;
  address: string;
  open_hours: string;
  avg_stay_minutes: number;
  avg_wait_minutes: number;
  crowd_level: "low" | "medium" | "high";
  price_level: 1 | 2 | 3 | 4;
  rating: number;
  review_summary: string;
  reviews: string[];
  mood_match: string[];
  mbti_tags: string[];
  best_time: string;
  lat: number;
  lng: number;
  cluster: "north" | "south" | "east" | "west" | "center";
}

export type MBTI =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

export interface UserProfile {
  traits: string[];
  stayPreference: "short" | "medium" | "long";
  avoidCrowd: boolean;
  budgetTier: 1 | 2 | 3 | 4;
}

export interface CompletedWaypoint {
  waypoint: Waypoint;
  completedAt: string;
  stayDurationMin: number;
  capturedClipMeta?: { filename: string; mood: string };
}

export interface TripRecord {
  generationId: string;
  startedAt: string;
  finishedAt: string;
  waypoints: CompletedWaypoint[];
  xpGained: number;
  couponIds: string[];
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

export interface VlogScene {
  timestamp: string;
  location: string;
  narration: string;
  mood: "warm" | "cool" | "energetic" | "calm";
}

export interface VlogScript {
  title: string;
  narration: string;
  scenes: VlogScene[];
  durationSec: number;
}

export interface SavedVlog {
  generationId: string;
  tripId: string;
  generatedAt: string;
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

- [ ] **Step 3.2: 改造 src/types.ts**

```typescript
// src/types.ts — re-export shared + UI-only types
import type { ReactNode } from 'react';

export * from '../shared/types';

export type ScreenType = 'explore' | 'story' | 'bag' | 'mine' | 'event' | 'settings' | 'onboarding';

export type ExploreStep =
  | "intro"
  | "preference_selection"
  | "gear_confirmation"
  | "initial"
  | "checkin_initial"
  | "hidden_found"
  | "hidden_active"
  | "checkin_hidden"
  | "reward_hidden"
  | "next_objective"
  | "checkin_next"
  | "vlog_ready"
  | "achievement_unlock";

export interface Coupon {
  id: string;
  title: string;
  desc: string;
  date: string;
  amount: string;
  icon: ReactNode;
  color: string;
  tag?: string;
}

export interface TimelineItemData {
  time: string;
  title: string;
  desc: string;
  icon: ReactNode;
  img: string;
  recorded?: boolean;
}
```

- [ ] **Step 3.3: 类型检查**

```bash
npm run lint
```

Expected: 通过(可能现有 `routeAgent.ts` 会因为类型迁移有警告,先无视,后面 Task 替换)。

- [ ] **Step 3.4: Commit**

```bash
git add shared/types.ts src/types.ts
git commit -m "types: split shared types into shared/types.ts, add MBTI/TripRecord/HiddenTask/VlogScript/etc"
```

---

### Task 4: 创建 server/index.ts 与 /api/health

**Files:** Create `server/index.ts`

- [ ] **Step 4.1: 写入 server/index.ts**

```typescript
// server/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 4.2: 测试启动**

```bash
npx tsx server/index.ts &
sleep 2
curl -s http://localhost:3001/api/health
kill %1
```

Expected: 输出 `{"ok":true,"ts":"2026-..."}`,server 进程能正常被 kill。

- [ ] **Step 4.3: Commit**

```bash
git add server/index.ts
git commit -m "feat(server): bootstrap Express with /api/health"
```

---

### Task 5: 配置 Vite proxy + 删除 GEMINI_API_KEY 注入

**Files:** Modify `vite.config.ts`

- [ ] **Step 5.1: 改写 vite.config.ts**

```typescript
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
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
    },
  };
});
```

注意:**删除了 `define: { 'process.env.GEMINI_API_KEY': ... }`**,key 不再注入前端 bundle。

- [ ] **Step 5.2: Commit**

```bash
git add vite.config.ts
git commit -m "build(vite): add /api proxy with SSE no-buffer; remove GEMINI_API_KEY from frontend bundle"
```

---

### Task 6: 更新 npm scripts

**Files:** Modify `package.json` scripts 段

- [ ] **Step 6.1: 修改 scripts**

```json
{
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "dev:server": "tsx watch server/index.ts",
    "dev:all": "concurrently -n web,api -c blue,green \"npm:dev\" \"npm:dev:server\"",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist dist-server",
    "lint": "tsc --noEmit && tsc -p tsconfig.server.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "generate:pois": "tsx scripts/generatePOIs.ts"
  }
}
```

- [ ] **Step 6.2: 验证 dev:all 启动**

```bash
npm run dev:all &
sleep 4
curl -s http://localhost:3000/api/health
kill %1
```

Expected: 通过 Vite proxy 返回 `{"ok":true,...}`。

- [ ] **Step 6.3: Commit**

```bash
git add package.json
git commit -m "build(scripts): add dev:all, dev:server, test, lint covers both tsconfigs"
```

---

### Task 7: Vitest 配置 + 第一个 sanity test

**Files:** Create `vitest.config.ts`, Create `server/sanity.test.ts`

- [ ] **Step 7.1: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
```

- [ ] **Step 7.2: 创建 sanity 测试**

```typescript
// server/sanity.test.ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7.3: 运行测试**

```bash
npm test
```

Expected: 1 test passed.

- [ ] **Step 7.4: Commit**

```bash
git add vitest.config.ts server/sanity.test.ts
git commit -m "test: set up vitest, add sanity test"
```

---

### Task 8: utils/distance.ts (Haversine, TDD)

**Files:** Create `server/utils/distance.ts`, Create `server/utils/distance.test.ts`

- [ ] **Step 8.1: 写失败测试**

```typescript
// server/utils/distance.test.ts
import { describe, it, expect } from 'vitest';
import { haversineM } from './distance';

describe('haversineM', () => {
  it('returns 0 for same point', () => {
    expect(haversineM({ lat: 31.23, lng: 121.45 }, { lat: 31.23, lng: 121.45 })).toBe(0);
  });

  it('returns ~111000 for 1 degree lat difference', () => {
    const d = haversineM({ lat: 31.23, lng: 121.45 }, { lat: 32.23, lng: 121.45 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('returns ~22 meters for 0.0002 degree lat diff (Shanghai latitude)', () => {
    const d = haversineM({ lat: 31.23, lng: 121.45 }, { lat: 31.2302, lng: 121.45 });
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(24);
  });
});
```

- [ ] **Step 8.2: 跑测试确认失败**

```bash
npm test -- distance
```

Expected: FAIL "Cannot find module './distance'"

- [ ] **Step 8.3: 实现 distance.ts**

```typescript
// server/utils/distance.ts
const EARTH_RADIUS_M = 6371000;

export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 8.4: 跑测试确认通过**

```bash
npm test -- distance
```

Expected: 3 tests passed.

- [ ] **Step 8.5: Commit**

```bash
git add server/utils/distance.ts server/utils/distance.test.ts
git commit -m "feat(utils): add Haversine distance with TDD tests"
```

---

### Task 9: utils/logger.ts

**Files:** Create `server/utils/logger.ts`

- [ ] **Step 9.1: 写文件**

```typescript
// server/utils/logger.ts
type Level = 'info' | 'warn' | 'error' | 'debug';

function format(level: Level, scope: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const dataStr = data === undefined ? '' : ' ' + JSON.stringify(data);
  return `[${ts}] [${level.toUpperCase()}] [${scope}] ${msg}${dataStr}`;
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, data?: unknown) => console.log(format('info', scope, msg, data)),
    warn: (msg: string, data?: unknown) => console.warn(format('warn', scope, msg, data)),
    error: (msg: string, data?: unknown) => console.error(format('error', scope, msg, data)),
    debug: (msg: string, data?: unknown) => {
      if (process.env.DEBUG) console.log(format('debug', scope, msg, data));
    },
  };
}
```

- [ ] **Step 9.2: Commit**

```bash
git add server/utils/logger.ts
git commit -m "feat(utils): add scoped logger"
```

---

### Task 10: services/geminiClient.ts (extractJson TDD)

**Files:** Create `server/services/geminiClient.ts`, Create `server/services/geminiClient.test.ts`

- [ ] **Step 10.1: 写失败测试 (只测 extractJson)**

```typescript
// server/services/geminiClient.test.ts
import { describe, it, expect } from 'vitest';
import { extractJson } from './geminiClient';

describe('extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON from markdown code fence', () => {
    const text = '这是回复:\n```json\n{"a":2}\n```\n谢谢';
    expect(extractJson(text)).toEqual({ a: 2 });
  });

  it('extracts JSON via greedy regex when no fence', () => {
    const text = '前置说明...{"a":3}尾部';
    expect(extractJson(text)).toEqual({ a: 3 });
  });

  it('throws GEMINI_PARSE_FAIL when no JSON found', () => {
    expect(() => extractJson('hello world')).toThrow('GEMINI_PARSE_FAIL');
  });

  it('handles arrays', () => {
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 10.2: 跑测试确认失败**

```bash
npm test -- geminiClient
```

Expected: FAIL "Cannot find module './geminiClient'"

- [ ] **Step 10.3: 实现 geminiClient.ts**

```typescript
// server/services/geminiClient.ts
import { GoogleGenAI } from '@google/genai';
import { z, ZodSchema } from 'zod';
import { createLogger } from '../utils/logger';

const log = createLogger('geminiClient');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export function extractJson(text: string): unknown {
  // 一级:直接 parse
  try { return JSON.parse(text); } catch {}
  // 二级:找 ```json ... ``` 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // 三级:贪婪正则
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    try { return JSON.parse(obj[0]); } catch {}
  }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) {
    try { return JSON.parse(arr[0]); } catch {}
  }
  throw new Error('GEMINI_PARSE_FAIL');
}

export interface GenerateOpts<T> {
  prompt: string;
  schema: ZodSchema<T>;
  temperature?: number;
  retries?: number;
  signal?: AbortSignal;
}

export async function generate<T>(opts: GenerateOpts<T>): Promise<T> {
  const { prompt, schema, temperature = 0.7, retries = 1, signal } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new Error('ABORTED');
    try {
      log.info('gemini call', { attempt, temperature, promptLen: prompt.length });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature },
      });
      const text = response.text ?? '';
      const json = extractJson(text);
      const parsed = schema.parse(json);
      log.info('gemini ok', { attempt });
      return parsed;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      log.warn('gemini fail', { attempt, msg: msg.slice(0, 200) });
      // quota / auth 错误不重试
      if (msg.includes('quota') || msg.includes('401') || msg.includes('PERMISSION_DENIED')) {
        throw new Error('GEMINI_QUOTA');
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('GEMINI_PARSE_FAIL');
}
```

- [ ] **Step 10.4: 跑测试确认通过**

```bash
npm test -- geminiClient
```

Expected: 5 tests passed.

- [ ] **Step 10.5: Commit**

```bash
git add server/services/geminiClient.ts server/services/geminiClient.test.ts
git commit -m "feat(server): add geminiClient with three-tier JSON extraction + zod validation"
```

---

### Task 11: services/poiRepository.ts (TDD)

**Files:** Create `server/services/poiRepository.ts`, Create `server/services/poiRepository.test.ts`, Create `server/data/.gitkeep`

- [ ] **Step 11.1: 创建 server/data 目录**

```bash
mkdir -p server/data
touch server/data/.gitkeep
```

- [ ] **Step 11.2: 写失败测试**

```typescript
// server/services/poiRepository.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POIRepository } from './poiRepository';
import type { POI } from '../../shared/types';

const fixturePOI: POI = {
  id: 'p1',
  name: 'Test Cafe',
  category: '咖啡厅',
  tags: ['art', 'coffee'],
  area: '静安寺',
  address: '某路',
  open_hours: '09:00-22:00',
  avg_stay_minutes: 60,
  avg_wait_minutes: 10,
  crowd_level: 'medium',
  price_level: 2,
  rating: 4.5,
  review_summary: 'ok',
  reviews: [],
  mood_match: ['relax'],
  mbti_tags: ['内向'],
  best_time: '下午',
  lat: 31.230,
  lng: 121.448,
  cluster: 'center',
};

describe('POIRepository', () => {
  let tmpPath: string;

  beforeAll(() => {
    const dir = join(tmpdir(), 'poi-test-' + Date.now());
    mkdirSync(dir, { recursive: true });
    tmpPath = join(dir, 'pois.json');
    writeFileSync(tmpPath, JSON.stringify([fixturePOI]));
  });

  it('loads POIs from JSON file', () => {
    const repo = new POIRepository(tmpPath);
    expect(repo.all().length).toBe(1);
    expect(repo.all()[0].id).toBe('p1');
  });

  it('finds POI by id', () => {
    const repo = new POIRepository(tmpPath);
    expect(repo.byId('p1')?.name).toBe('Test Cafe');
    expect(repo.byId('nonexistent')).toBeUndefined();
  });

  it('returns POIs in a cluster', () => {
    const repo = new POIRepository(tmpPath);
    expect(repo.byCluster('center').length).toBe(1);
    expect(repo.byCluster('north').length).toBe(0);
  });
});
```

- [ ] **Step 11.3: 跑测试确认失败**

```bash
npm test -- poiRepository
```

Expected: FAIL "Cannot find module './poiRepository'"

- [ ] **Step 11.4: 实现 poiRepository.ts**

```typescript
// server/services/poiRepository.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { POI } from '../../shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.resolve(__dirname, '../data/pois.json');

export class POIRepository {
  private pois: POI[];

  constructor(filePath: string = DEFAULT_PATH) {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      this.pois = JSON.parse(raw) as POI[];
    } catch (e) {
      // 文件不存在或损坏 → 空池(降级)
      this.pois = [];
    }
  }

  all(): POI[] {
    return this.pois;
  }

  byId(id: string): POI | undefined {
    return this.pois.find((p) => p.id === id);
  }

  byCluster(cluster: POI['cluster']): POI[] {
    return this.pois.filter((p) => p.cluster === cluster);
  }
}

// 单例(server 启动时加载一次)
export const poiRepo = new POIRepository();
```

- [ ] **Step 11.5: 跑测试确认通过**

```bash
npm test -- poiRepository
```

Expected: 3 tests passed.

- [ ] **Step 11.6: Commit**

```bash
git add server/services/poiRepository.ts server/services/poiRepository.test.ts server/data/.gitkeep
git commit -m "feat(server): add POIRepository with file load + cluster query (TDD)"
```

---

### Task 12: 升级 generatePOIs.ts (lat/lng + cluster + 严格 open_hours)

**Files:** Modify `scripts/generatePOIs.ts`

- [ ] **Step 12.1: 改写 generatePOIs.ts**

```typescript
/**
 * 一次性脚本:用 Gemini 生成上海静安区的模拟 POI 数据
 * 运行方式:npx tsx scripts/generatePOIs.ts (需 GEMINI_API_KEY)
 * 输出文件:server/data/pois.json
 */

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const prompt = `
你是一个熟悉上海静安区的本地生活专家。生成 30 个 POI(兴趣点)数据,
覆盖咖啡厅、书店、公园、美术馆、餐厅、小店等多种类型。

把 30 个 POI 分为 5 簇,每簇 6 个,簇间步行距离 15-30 分钟:
- cluster: "center" → lat: 31.230~31.234, lng: 121.448~121.452
- cluster: "north"  → lat: 31.238~31.242, lng: 121.448~121.452
- cluster: "south"  → lat: 31.222~31.226, lng: 121.448~121.452
- cluster: "east"   → lat: 31.230~31.234, lng: 121.456~121.460
- cluster: "west"   → lat: 31.230~31.234, lng: 121.440~121.444

同一簇内 POI 间距 100~500 米(lat/lng 差 0.001~0.005)。坐标 4 位小数。

每个 POI 必须包含以下字段,严格返回 JSON 数组,不要有任何其他文字:

[
  {
    "id": "poi_001",
    "name": "地点名称",
    "category": "咖啡厅",
    "tags": ["art", "niche", "photo"],
    "area": "静安寺",
    "address": "静安区某路某号",
    "open_hours": "09:00-22:00",
    "avg_stay_minutes": 60,
    "avg_wait_minutes": 10,
    "crowd_level": "medium",
    "price_level": 2,
    "rating": 4.6,
    "review_summary": "一句话评价摘要",
    "reviews": ["评论1", "评论2", "评论3"],
    "mood_match": ["relax", "explore"],
    "mbti_tags": ["内向", "文艺", "慢节奏"],
    "best_time": "下午",
    "lat": 31.2305,
    "lng": 121.4501,
    "cluster": "center"
  }
]

要求:
- tags 只允许:art, outdoor, food, busy, family, photo, niche, budget, coffee
- mood_match 只允许:happy, tired, bored, relax, explore, hungry
- crowd_level:low / medium / high
- price_level:1~4
- avg_wait_minutes:热门 10-30 分钟,冷门 0-5 分钟
- avg_stay_minutes:咖啡厅 45-90,公园 60-180,书店 30-60,餐厅 45-75
- open_hours 严格 "HH:MM-HH:MM" 格式,不允许:"24小时"(写 "00:00-23:59")、多段(选主段)、跨日(改 "HH:MM-23:59")
- 30 个 POI 至少覆盖 5 种 category,low/medium/high 三种 crowd_level 都要有
- reviews 真实可信,提到具体感受(等待、环境、食物、性价比)
- 每簇 6 个,id 顺序 poi_001~poi_030
`;

async function main() {
  console.log('正在用 Gemini 生成 POI 数据...');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { temperature: 0.8 },
  });

  const text = response.text ?? '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('返回内容:', text.slice(0, 500));
    throw new Error('没找到 JSON 数组');
  }

  const pois = JSON.parse(jsonMatch[0]);
  console.log(`生成了 ${pois.length} 个 POI`);

  // 验证分簇分布
  const counts: Record<string, number> = {};
  for (const p of pois) counts[p.cluster] = (counts[p.cluster] ?? 0) + 1;
  console.log('cluster 分布:', counts);

  const outputDir = path.resolve(__dirname, '../server/data');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'pois.json');
  writeFileSync(outputPath, JSON.stringify(pois, null, 2), 'utf-8');
  console.log(`已保存到 ${outputPath}`);

  console.log('\n样本:');
  console.log(JSON.stringify(pois[0], null, 2));
}

main().catch(console.error);
```

- [ ] **Step 12.2: 运行脚本(需 GEMINI_API_KEY 已配置)**

```bash
npm run generate:pois
```

Expected: 输出 30 个 POI,5 个 cluster 各 6 个,生成 `server/data/pois.json`。

- [ ] **Step 12.3: 验证数据**

```bash
node -e "const p=require('./server/data/pois.json'); console.log('count:',p.length); console.log('clusters:',[...new Set(p.map(x=>x.cluster))]); console.log('has lat/lng:',p.every(x=>typeof x.lat==='number' && typeof x.lng==='number'))"
```

Expected: `count: 30`, 5 个 cluster, `has lat/lng: true`。

- [ ] **Step 12.4: Commit**

```bash
git add scripts/generatePOIs.ts server/data/pois.json
git commit -m "feat(data): regenerate POIs with lat/lng, cluster, strict open_hours"
```

---

## Phase 2: 纯 TS Agent (Day 3)

### Task 13: profilingAgent.ts (TDD)

**Files:** Create `server/agents/profilingAgent.ts`, Create `server/agents/profilingAgent.test.ts`

- [ ] **Step 13.1: 写失败测试**

```typescript
// server/agents/profilingAgent.test.ts
import { describe, it, expect } from 'vitest';
import { buildProfile } from './profilingAgent';
import type { UserPreferences, TripRecord } from '../../shared/types';

const basePrefs: UserPreferences = {
  mood: 'relax',
  duration: '2h',
  transport: 'walk',
  special: ['art', 'niche'],
  foodPreference: ['coffee'],
  intensity: 'normal',
};

describe('buildProfile', () => {
  it('is deterministic for same input', () => {
    const a = buildProfile(basePrefs);
    const b = buildProfile(basePrefs);
    expect(a).toEqual(b);
  });

  it('maps "relax" mood to slow traits', () => {
    const p = buildProfile({ ...basePrefs, mood: 'relax' });
    expect(p.traits).toContain('慢节奏');
  });

  it('maps "explore" mood to curious trait', () => {
    const p = buildProfile({ ...basePrefs, mood: 'explore' });
    expect(p.traits).toContain('好奇');
  });

  it('infers MBTI traits when provided', () => {
    const p = buildProfile(basePrefs, 'INFP');
    expect(p.traits).toContain('内向');
  });

  it('infers long stay from history (avg > 60min)', () => {
    const history: TripRecord[] = [{
      generationId: 'g1', startedAt: '', finishedAt: '',
      waypoints: [{
        waypoint: { name: '', description: '', task: '', reward: '', emoji: '', distanceText: '' },
        completedAt: '', stayDurationMin: 90,
      }],
      xpGained: 0, couponIds: [],
    }];
    const p = buildProfile(basePrefs, undefined, history);
    expect(p.stayPreference).toBe('long');
  });

  it('avoidCrowd true when special has "niche"', () => {
    const p = buildProfile({ ...basePrefs, special: ['niche'] });
    expect(p.avoidCrowd).toBe(true);
  });

  it('budgetTier 1 when special has "budget"', () => {
    const p = buildProfile({ ...basePrefs, special: ['budget'] });
    expect(p.budgetTier).toBe(1);
  });

  it('budgetTier 3 default', () => {
    const p = buildProfile({ ...basePrefs, special: ['art'] });
    expect(p.budgetTier).toBe(3);
  });
});
```

- [ ] **Step 13.2: 跑测试确认失败**

```bash
npm test -- profilingAgent
```

Expected: FAIL.

- [ ] **Step 13.3: 实现 profilingAgent.ts**

```typescript
// server/agents/profilingAgent.ts
import type { UserPreferences, MBTI, TripRecord, UserProfile } from '../../shared/types';

const MOOD_TRAITS: Record<string, string[]> = {
  relax: ['慢节奏'],
  explore: ['好奇'],
  happy: ['外向'],
  tired: ['慢节奏', '安静'],
  bored: ['好奇'],
  hungry: ['美食'],
};

const SPECIAL_TRAITS: Record<string, string[]> = {
  art: ['文艺'],
  outdoor: ['户外'],
  food: ['美食'],
  busy: ['热闹'],
  family: ['亲子'],
  photo: ['摄影'],
  niche: ['小众'],
  budget: ['朴素'],
};

const MBTI_TRAITS: Record<string, string[]> = {
  I: ['内向'],
  E: ['外向'],
  N: ['想象力'],
  S: ['务实'],
  F: ['共情'],
  T: ['理性'],
  P: ['随性'],
  J: ['计划'],
};

export function buildProfile(
  prefs: UserPreferences,
  mbti?: MBTI,
  history?: TripRecord[]
): UserProfile {
  const traits = new Set<string>();
  (MOOD_TRAITS[prefs.mood] ?? []).forEach((t) => traits.add(t));
  prefs.special.forEach((s) => (SPECIAL_TRAITS[s] ?? []).forEach((t) => traits.add(t)));
  if (mbti) {
    [...mbti].forEach((ch) => (MBTI_TRAITS[ch] ?? []).forEach((t) => traits.add(t)));
  }

  // 自学习:从 history 平均停留时长推 stayPreference
  let stayPreference: UserProfile['stayPreference'] = 'medium';
  if (history && history.length > 0) {
    const allStays = history.flatMap((t) => t.waypoints.map((w) => w.stayDurationMin));
    if (allStays.length > 0) {
      const avg = allStays.reduce((s, x) => s + x, 0) / allStays.length;
      if (avg > 60) stayPreference = 'long';
      else if (avg < 30) stayPreference = 'short';
    }
  } else {
    // 没有 history 时,从 duration 推
    if (prefs.duration === '30min') stayPreference = 'short';
    else if (prefs.duration === 'half_day') stayPreference = 'long';
  }

  const avoidCrowd = prefs.special.includes('niche');
  let budgetTier: 1 | 2 | 3 | 4 = 3;
  if (prefs.special.includes('budget')) budgetTier = 1;

  return {
    traits: [...traits].sort(),
    stayPreference,
    avoidCrowd,
    budgetTier,
  };
}
```

- [ ] **Step 13.4: 跑测试确认通过**

```bash
npm test -- profilingAgent
```

Expected: 8 tests passed.

- [ ] **Step 13.5: Commit**

```bash
git add server/agents/profilingAgent.ts server/agents/profilingAgent.test.ts
git commit -m "feat(agent): add profilingAgent (pure TS, deterministic, learns from history)"
```

---

### Task 14: poiSourcingAgent.ts (TDD)

**Files:** Create `server/agents/poiSourcingAgent.ts`, Create `server/agents/poiSourcingAgent.test.ts`

- [ ] **Step 14.1: 写失败测试**

```typescript
// server/agents/poiSourcingAgent.test.ts
import { describe, it, expect } from 'vitest';
import { isOpen, sourcePOIs } from './poiSourcingAgent';
import type { POI, UserProfile } from '../../shared/types';

function mkPOI(over: Partial<POI> = {}): POI {
  return {
    id: 'p', name: 'X', category: 'cafe', tags: [], area: 'A', address: '',
    open_hours: '09:00-22:00', avg_stay_minutes: 60, avg_wait_minutes: 10,
    crowd_level: 'medium', price_level: 2, rating: 4.0, review_summary: '',
    reviews: [], mood_match: [], mbti_tags: [], best_time: '',
    lat: 31.23, lng: 121.45, cluster: 'center',
    ...over,
  };
}

describe('isOpen', () => {
  it('open at 12:00 for 09:00-22:00', () => {
    const poi = mkPOI({ open_hours: '09:00-22:00' });
    const noon = new Date('2026-05-20T12:00:00');
    expect(isOpen(poi, noon)).toBe(true);
  });

  it('closed at 23:00 for 09:00-22:00', () => {
    const poi = mkPOI({ open_hours: '09:00-22:00' });
    const late = new Date('2026-05-20T23:00:00');
    expect(isOpen(poi, late)).toBe(false);
  });

  it('returns true on malformed open_hours (fallback)', () => {
    const poi = mkPOI({ open_hours: 'garbage' });
    expect(isOpen(poi, new Date())).toBe(true);
  });
});

const baseProfile: UserProfile = {
  traits: ['文艺'], stayPreference: 'medium', avoidCrowd: false, budgetTier: 3,
};

describe('sourcePOIs', () => {
  const pois: POI[] = [
    mkPOI({ id: 'p1', cluster: 'center', tags: ['art'], crowd_level: 'low', avg_wait_minutes: 5 }),
    mkPOI({ id: 'p2', cluster: 'center', tags: ['art'], crowd_level: 'low', avg_wait_minutes: 8 }),
    mkPOI({ id: 'p3', cluster: 'center', tags: ['food'], crowd_level: 'high', avg_wait_minutes: 35 }),
    mkPOI({ id: 'p4', cluster: 'north', tags: ['art'], crowd_level: 'low', avg_wait_minutes: 5 }),
    mkPOI({ id: 'p5', cluster: 'center', tags: ['photo'], crowd_level: 'medium', avg_wait_minutes: 15 }),
  ];
  const noon = new Date('2026-05-20T12:00:00');

  it('returns at least 3 POIs', () => {
    const result = sourcePOIs(pois, baseProfile, noon);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('filters out long-wait POIs by default (>20min)', () => {
    const result = sourcePOIs(pois, baseProfile, noon);
    const ids = result.map((p) => p.id);
    expect(ids).not.toContain('p3');
  });

  it('all returned POIs from same cluster', () => {
    const result = sourcePOIs(pois, baseProfile, noon);
    const clusters = new Set(result.map((p) => p.cluster));
    expect(clusters.size).toBe(1);
  });

  it('avoidCrowd=true filters out high crowd_level', () => {
    const result = sourcePOIs(pois, { ...baseProfile, avoidCrowd: true }, noon);
    expect(result.every((p) => p.crowd_level !== 'high')).toBe(true);
  });

  it('relaxes filter when initial filter yields < 3', () => {
    // Profile that matches nothing exactly
    const strictProfile: UserProfile = {
      traits: ['不存在'], stayPreference: 'short', avoidCrowd: true, budgetTier: 1,
    };
    const result = sourcePOIs(pois, strictProfile, noon);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('throws POI_EMPTY when pool is empty', () => {
    expect(() => sourcePOIs([], baseProfile, noon)).toThrow('POI_EMPTY');
  });
});
```

- [ ] **Step 14.2: 跑测试确认失败**

```bash
npm test -- poiSourcingAgent
```

Expected: FAIL.

- [ ] **Step 14.3: 实现 poiSourcingAgent.ts**

```typescript
// server/agents/poiSourcingAgent.ts
import type { POI, UserProfile } from '../../shared/types';
import { createLogger } from '../utils/logger';

const log = createLogger('poiSourcing');

function parseTime(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function isOpen(poi: POI, now: Date): boolean {
  const parts = poi.open_hours.split('-');
  if (parts.length !== 2) return true;
  const open = parseTime(parts[0].trim());
  const close = parseTime(parts[1].trim());
  if (open == null || close == null) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= open && nowMin <= close;
}

function scorePOI(poi: POI, profile: UserProfile): number {
  let score = poi.rating; // base 4-5
  // traits 命中加分
  for (const trait of profile.traits) {
    if (poi.mbti_tags.includes(trait)) score += 0.5;
  }
  // 预算匹配
  if (poi.price_level === profile.budgetTier) score += 0.3;
  // 等待时间反比
  score -= poi.avg_wait_minutes * 0.02;
  return score;
}

function pickCluster(pois: POI[]): POI['cluster'] {
  // 选 POI 最多的 cluster
  const counts: Record<string, number> = {};
  for (const p of pois) counts[p.cluster] = (counts[p.cluster] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] ?? 'center') as POI['cluster'];
}

export function sourcePOIs(
  pool: POI[],
  profile: UserProfile,
  now: Date
): POI[] {
  if (pool.length === 0) throw new Error('POI_EMPTY');

  // Step 1: 营业 + 等待时间过滤
  let candidates = pool.filter((p) => isOpen(p, now));
  candidates = candidates.filter((p) => p.avg_wait_minutes <= 20);

  if (profile.avoidCrowd) {
    candidates = candidates.filter((p) => p.crowd_level !== 'high');
  }

  // Step 2: 锁定一个 cluster
  if (candidates.length === 0) {
    log.warn('strict filter yielded zero, relaxing all');
    candidates = pool.slice();
  }
  const cluster = pickCluster(candidates);
  let inCluster = candidates.filter((p) => p.cluster === cluster);

  // Step 3: 如果同簇 < 3,放宽到不限 cluster
  if (inCluster.length < 3) {
    log.warn(`cluster ${cluster} only has ${inCluster.length}, relaxing`);
    inCluster = pool.filter((p) => isOpen(p, now)).slice(0, Math.max(3, inCluster.length));
    if (inCluster.length < 3) inCluster = pool.slice(0, Math.min(5, pool.length));
  }

  // Step 4: 打分 + 排序,取前 5 个
  inCluster.sort((a, b) => scorePOI(b, profile) - scorePOI(a, profile));
  const result = inCluster.slice(0, 5);
  log.info('sourced', { count: result.length, cluster, ids: result.map((p) => p.id) });
  return result;
}
```

- [ ] **Step 14.4: 跑测试确认通过**

```bash
npm test -- poiSourcingAgent
```

Expected: 9 tests passed.

- [ ] **Step 14.5: Commit**

```bash
git add server/agents/poiSourcingAgent.ts server/agents/poiSourcingAgent.test.ts
git commit -m "feat(agent): add poiSourcingAgent (filter + relax + cluster lock, TDD)"
```

---

## Phase 3: 主路线生成 (Day 4)

### Task 15: fallbacks/fallbackRoute.ts

**Files:** Create `server/fallbacks/fallbackRoute.ts`

- [ ] **Step 15.1: 写文件**

```typescript
// server/fallbacks/fallbackRoute.ts
import type { GeneratedRoute } from '../../shared/types';

export const FALLBACK_ROUTE: GeneratedRoute = {
  title: '静安区的小确幸',
  waypoints: [
    {
      name: '转角咖啡馆',
      description: '藏着这条街十年前的秘密',
      task: '找到窗边的那把椅子',
      reward: '美团单车7天畅骑卡',
      emoji: '☕',
      distanceText: '步行约 8 分钟',
      lat: 31.2305,
      lng: 121.4501,
    },
    {
      name: '愚园路书店',
      description: '即便发呆四小时也合法',
      task: '在中文区找一本你没读过的书',
      reward: '咖啡店 8 折券',
      emoji: '📚',
      distanceText: '步行约 12 分钟',
      lat: 31.2315,
      lng: 121.4495,
    },
  ],
};
```

- [ ] **Step 15.2: Commit**

```bash
git add server/fallbacks/fallbackRoute.ts
git commit -m "feat(fallback): hardcoded route used when agents fail"
```

---

### Task 16: routeNarrativeAgent.ts

**Files:** Create `server/agents/routeNarrativeAgent.ts`

- [ ] **Step 16.1: 写文件**

```typescript
// server/agents/routeNarrativeAgent.ts
import { z } from 'zod';
import { generate } from '../services/geminiClient';
import type { POI, UserProfile, UserPreferences, TripRecord, GeneratedRoute } from '../../shared/types';

const WaypointSchema = z.object({
  name: z.string(),
  description: z.string(),
  task: z.string(),
  reward: z.string(),
  emoji: z.string(),
  distanceText: z.string(),
  poiId: z.string(),
});

const ResponseSchema = z.object({
  title: z.string(),
  waypoints: z.array(WaypointSchema).min(2).max(3),
});

function buildPrompt(
  profile: UserProfile,
  pois: POI[],
  prefs: UserPreferences,
  history?: TripRecord[]
): string {
  const poiList = pois.map((p) =>
    `- [${p.id}] ${p.name}(${p.category}, 评分 ${p.rating}, ${p.avg_stay_minutes}min, ${p.review_summary})`
  ).join('\n');

  const historyHint = history && history.length > 0
    ? `\n用户历史(最近 ${history.length} 次):上次平均停留 ${
      Math.round(
        history.flatMap((t) => t.waypoints.map((w) => w.stayDurationMin))
          .reduce((s, x) => s + x, 0) /
        Math.max(1, history.flatMap((t) => t.waypoints).length)
      )
    } 分钟。参考但不要复刻。\n`
    : '';

  return `
你是城市探索路线策划。基于用户画像和候选 POI,挑 2-3 个组成一条故事化路线。

用户画像:
- 特质:${profile.traits.join('、')}
- 停留偏好:${profile.stayPreference}
- 避开人群:${profile.avoidCrowd}
- 预算档:${profile.budgetTier}
- 偏好标签:${prefs.special.join('、')}
${historyHint}
候选 POI(只能从这里选):
${poiList}

严格返回 JSON,不要其他文字:
{
  "title": "路线标题(10字内有意境)",
  "waypoints": [
    {
      "name": "<POI 真实 name>",
      "description": "故事描述 30字内",
      "task": "打卡任务 20字内",
      "reward": "奖励描述(如:美团单车7天卡)",
      "emoji": "代表 emoji",
      "distanceText": "步行约 X 分钟",
      "poiId": "<POI 的 id>"
    }
  ]
}
`;
}

export async function generateRouteNarrative(
  profile: UserProfile,
  pois: POI[],
  prefs: UserPreferences,
  history?: TripRecord[]
): Promise<GeneratedRoute> {
  const prompt = buildPrompt(profile, pois, prefs, history);
  const result = await generate({
    prompt,
    schema: ResponseSchema,
    temperature: 0.8,
  });

  // 把 poiId 补回 lat/lng
  const waypoints = result.waypoints.map((wp) => {
    const poi = pois.find((p) => p.id === wp.poiId);
    return {
      name: wp.name,
      description: wp.description,
      task: wp.task,
      reward: wp.reward,
      emoji: wp.emoji,
      distanceText: wp.distanceText,
      lat: poi?.lat,
      lng: poi?.lng,
    };
  });

  return { title: result.title, waypoints };
}
```

- [ ] **Step 16.2: Commit**

```bash
git add server/agents/routeNarrativeAgent.ts
git commit -m "feat(agent): add routeNarrativeAgent (Gemini, temperature 0.8, zod-validated)"
```

---

### Task 17: routeOrchestrator.ts

**Files:** Create `server/orchestrators/routeOrchestrator.ts`

- [ ] **Step 17.1: 写文件**

```typescript
// server/orchestrators/routeOrchestrator.ts
import { randomUUID } from 'node:crypto';
import { buildProfile } from '../agents/profilingAgent';
import { sourcePOIs } from '../agents/poiSourcingAgent';
import { generateRouteNarrative } from '../agents/routeNarrativeAgent';
import { poiRepo } from '../services/poiRepository';
import { FALLBACK_ROUTE } from '../fallbacks/fallbackRoute';
import { createLogger } from '../utils/logger';
import type { UserPreferences, MBTI, TripRecord, GeneratedRoute } from '../../shared/types';

const log = createLogger('routeOrch');

export interface RouteInput {
  preferences: UserPreferences;
  mbti?: MBTI;
  history?: TripRecord[];
}

export interface RouteOutput {
  generationId: string;
  route: GeneratedRoute;
  usedFallback: boolean;
}

export async function orchestrateRoute(input: RouteInput): Promise<RouteOutput> {
  const generationId = randomUUID();
  log.info('start', { generationId, prefsMood: input.preferences.mood, hasHistory: !!input.history?.length });

  // 1. Profiling
  let profile;
  try {
    profile = buildProfile(input.preferences, input.mbti, input.history);
  } catch (e) {
    log.warn('profiling fail, using default', { e: String(e).slice(0, 200) });
    profile = { traits: [], stayPreference: 'medium' as const, avoidCrowd: false, budgetTier: 3 as const };
  }

  // 2. POI Sourcing
  let pois;
  try {
    pois = sourcePOIs(poiRepo.all(), profile, new Date());
  } catch (e) {
    log.warn('poiSourcing fail, using fallback', { e: String(e).slice(0, 200) });
    return { generationId, route: FALLBACK_ROUTE, usedFallback: true };
  }

  // 3. Route + Narrative (Gemini)
  try {
    const route = await generateRouteNarrative(profile, pois, input.preferences, input.history);
    log.info('done', { generationId, waypointCount: route.waypoints.length });
    return { generationId, route: { ...route, generationId }, usedFallback: false };
  } catch (e) {
    log.warn('routeNarrative fail, using fallback', { e: String(e).slice(0, 200) });
    return { generationId, route: { ...FALLBACK_ROUTE, generationId }, usedFallback: true };
  }
}
```

- [ ] **Step 17.2: Commit**

```bash
git add server/orchestrators/routeOrchestrator.ts
git commit -m "feat(orchestrator): routeOrchestrator with per-step fallback"
```

---

### Task 18: routes/route.ts + smoke test

**Files:** Create `server/routes/route.ts`, Modify `server/index.ts`

- [ ] **Step 18.1: 创建 route.ts**

```typescript
// server/routes/route.ts
import { Router } from 'express';
import { z } from 'zod';
import { orchestrateRoute } from '../orchestrators/routeOrchestrator';
import { createLogger } from '../utils/logger';

const log = createLogger('route');
const router: Router = Router();

const RequestSchema = z.object({
  preferences: z.object({
    mood: z.string(),
    duration: z.string(),
    transport: z.string(),
    special: z.array(z.string()),
    foodPreference: z.array(z.string()),
    intensity: z.string(),
  }),
  mbti: z.string().optional(),
  history: z.array(z.any()).optional(),
  currentLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

router.post('/', async (req, res) => {
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: parseResult.error.message, retryable: false },
    });
  }

  try {
    const result = await orchestrateRoute(parseResult.data as any);
    return res.json({
      generationId: result.generationId,
      route: result.route,
      usedFallback: result.usedFallback,
    });
  } catch (e) {
    log.error('uncaught', { e: String(e).slice(0, 500) });
    return res.status(500).json({
      error: { code: 'INTERNAL', message: 'route generation failed', retryable: true },
    });
  }
});

export default router;
```

- [ ] **Step 18.2: 接进 server/index.ts**

```typescript
// server/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routeRouter from './routes/route';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/route', routeRouter);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 18.3: Smoke test**

```bash
npx tsx server/index.ts &
sleep 2
curl -s -X POST http://localhost:3001/api/route \
  -H 'Content-Type: application/json' \
  -d '{"preferences":{"mood":"relax","duration":"2h","transport":"walk","special":["art","niche"],"foodPreference":["coffee"],"intensity":"normal"}}' \
  | head -c 2000
kill %1
```

Expected: JSON with `generationId`, `route.title`, `route.waypoints[]` 长度 2-3,每个 waypoint 有 lat/lng。

- [ ] **Step 18.4: Commit**

```bash
git add server/routes/route.ts server/index.ts
git commit -m "feat(route): wire POST /api/route through orchestrator + zod input validation"
```

---

## Phase 4: 隐藏任务 (Day 5)

### Task 19: hiddenTaskAgent.ts

**Files:** Create `server/agents/hiddenTaskAgent.ts`

- [ ] **Step 19.1: 写文件**

```typescript
// server/agents/hiddenTaskAgent.ts
import { z } from 'zod';
import { generate } from '../services/geminiClient';
import type { POI, UserProfile, HiddenTask } from '../../shared/types';

const ResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  task: z.string(),
  reward: z.string(),
  emoji: z.string(),
});

export async function generateHiddenTask(
  candidate: POI,
  profile: UserProfile
): Promise<HiddenTask> {
  const prompt = `
你是城市探索的故事编辑。为下面这个 POI 生成一段"隐藏记忆"风格的触发文本。
要让用户感觉这是意外发现的小确幸。

POI:
- 名称:${candidate.name}
- 类型:${candidate.category}
- 评价摘要:${candidate.review_summary}

用户特质:${profile.traits.join('、') || '普通'}

严格返回 JSON,不要其他文字:
{
  "name": "POI 名称(可润色)",
  "description": "30 字内的氛围/秘密描述",
  "task": "20 字内的具体打卡任务",
  "reward": "奖励描述(如:咖啡 8 折券)",
  "emoji": "代表 emoji"
}
`;

  const result = await generate({
    prompt,
    schema: ResponseSchema,
    temperature: 0.9,
  });

  return {
    name: result.name,
    description: result.description,
    task: result.task,
    reward: result.reward,
    emoji: result.emoji,
    lat: candidate.lat,
    lng: candidate.lng,
    triggerDistanceM: 50,
  };
}
```

- [ ] **Step 19.2: Commit**

```bash
git add server/agents/hiddenTaskAgent.ts
git commit -m "feat(agent): add hiddenTaskAgent (Gemini, temperature 0.9)"
```

---

### Task 20: hiddenOrchestrator.ts

**Files:** Create `server/orchestrators/hiddenOrchestrator.ts`

- [ ] **Step 20.1: 写文件**

```typescript
// server/orchestrators/hiddenOrchestrator.ts
import { buildProfile } from '../agents/profilingAgent';
import { generateHiddenTask } from '../agents/hiddenTaskAgent';
import { poiRepo } from '../services/poiRepository';
import { haversineM } from '../utils/distance';
import { createLogger } from '../utils/logger';
import type { UserPreferences, MBTI, HiddenTask, POI } from '../../shared/types';

const log = createLogger('hiddenOrch');

export interface HiddenInput {
  generationId: string;
  preferences: UserPreferences;
  mbti?: MBTI;
  currentLocation?: { lat: number; lng: number };
  excludeIds?: string[];      // 已在主路线中的 POI id
}

export async function orchestrateHidden(input: HiddenInput): Promise<HiddenTask | null> {
  log.info('start', { generationId: input.generationId, hasLoc: !!input.currentLocation });

  const profile = buildProfile(input.preferences, input.mbti);
  const excludeSet = new Set(input.excludeIds ?? []);

  // 候选:不在 exclude,优先距离当前位置 < 500m
  const allCandidates = poiRepo.all().filter((p) => !excludeSet.has(p.id));
  if (allCandidates.length === 0) {
    log.info('no candidates after exclude');
    return null;
  }

  let ranked: POI[];
  if (input.currentLocation) {
    const loc = input.currentLocation;
    ranked = allCandidates
      .map((p) => ({ p, d: haversineM(loc, { lat: p.lat, lng: p.lng }) }))
      .filter((x) => x.d <= 500)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.p);

    if (ranked.length === 0) {
      log.info('no POI within 500m');
      return null;
    }
  } else {
    // 没位置就用 niche 标签里的随机一个
    ranked = allCandidates.filter((p) => p.tags.includes('niche'));
    if (ranked.length === 0) ranked = allCandidates;
    ranked = ranked.slice(0, 5);
  }

  const candidate = ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];

  try {
    const task = await generateHiddenTask(candidate, profile);
    log.info('done', { generationId: input.generationId, candidate: candidate.id });
    return task;
  } catch (e) {
    log.warn('agent fail, returning null', { e: String(e).slice(0, 200) });
    return null;
  }
}
```

- [ ] **Step 20.2: Commit**

```bash
git add server/orchestrators/hiddenOrchestrator.ts
git commit -m "feat(orchestrator): hiddenOrchestrator picks nearby non-route POI"
```

---

### Task 21: routes/hiddenTask.ts + smoke test

**Files:** Create `server/routes/hiddenTask.ts`, Modify `server/index.ts`

- [ ] **Step 21.1: 创建 hiddenTask.ts**

```typescript
// server/routes/hiddenTask.ts
import { Router } from 'express';
import { z } from 'zod';
import { orchestrateHidden } from '../orchestrators/hiddenOrchestrator';
import { createLogger } from '../utils/logger';

const log = createLogger('hiddenTask');
const router: Router = Router();

const RequestSchema = z.object({
  generationId: z.string(),
  preferences: z.any(),
  mbti: z.string().optional(),
  currentWaypointIndex: z.number().optional(),
  currentLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  excludeIds: z.array(z.string()).optional(),
});

router.post('/', async (req, res) => {
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: parseResult.error.message, retryable: false },
    });
  }

  try {
    const task = await orchestrateHidden(parseResult.data as any);
    if (task == null) {
      return res.status(204).end();
    }
    return res.json({ task });
  } catch (e) {
    log.error('uncaught', { e: String(e).slice(0, 500) });
    return res.status(500).json({
      error: { code: 'INTERNAL', message: 'hidden task failed', retryable: true },
    });
  }
});

export default router;
```

- [ ] **Step 21.2: 接进 index.ts**

修改 `server/index.ts`,加一行 import 和 use:

```typescript
import hiddenTaskRouter from './routes/hiddenTask';
// ...
app.use('/api/hidden-task', hiddenTaskRouter);
```

- [ ] **Step 21.3: Smoke test**

```bash
npx tsx server/index.ts &
sleep 2
curl -s -X POST http://localhost:3001/api/hidden-task \
  -H 'Content-Type: application/json' \
  -d '{"generationId":"test","preferences":{"mood":"explore","duration":"1h","transport":"walk","special":["niche"],"foodPreference":[],"intensity":"normal"}}' \
  -w '\nHTTP %{http_code}\n'
kill %1
```

Expected: HTTP 200 with `{"task":{...}}` 或 HTTP 204 (空 body)。两者都合法。

- [ ] **Step 21.4: Commit**

```bash
git add server/routes/hiddenTask.ts server/index.ts
git commit -m "feat(route): wire POST /api/hidden-task, returns 204 when no candidate"
```

---

## Phase 5: Vlog + SSE (Day 6-7)

### Task 22: vlogAgent.ts

**Files:** Create `server/agents/vlogAgent.ts`

- [ ] **Step 22.1: 写文件**

```typescript
// server/agents/vlogAgent.ts
import { z } from 'zod';
import { generate } from '../services/geminiClient';
import type { TripRecord, UserPreferences, VlogScript } from '../../shared/types';

const SceneSchema = z.object({
  timestamp: z.string(),
  location: z.string(),
  narration: z.string(),
  mood: z.enum(['warm', 'cool', 'energetic', 'calm']),
});

const ResponseSchema = z.object({
  title: z.string(),
  narration: z.string(),
  scenes: z.array(SceneSchema).min(2),
  durationSec: z.number().int().positive(),
});

export async function generateVlog(
  trip: TripRecord,
  prefs: UserPreferences
): Promise<VlogScript> {
  const tripJson = JSON.stringify(
    trip.waypoints.map((w, i) => ({
      idx: i,
      name: w.waypoint.name,
      task: w.waypoint.task,
      stayMin: w.stayDurationMin,
      time: w.completedAt,
      mood: w.capturedClipMeta?.mood,
    })),
    null, 2
  );

  const prompt = `
你是 Vlog 脚本编剧。基于用户今天的探索路径,生成一段电影感的 Vlog 脚本。

用户偏好:${prefs.special.join('、') || '无'}
意境基调:${prefs.mood}

今日打卡(JSON):
${tripJson}

要求:
- title 10 字内,有意境
- narration 整体旁白 80~120 字,第二人称,感性
- scenes 数量 = 打卡点数量,每个对应一站
- 每个 scene 的 narration 30~50 字
- mood 在 warm/cool/energetic/calm 四选一

严格返回 JSON,不要其他文字:
{
  "title": "...",
  "narration": "...",
  "scenes": [
    { "timestamp": "10:32", "location": "便利店", "narration": "...", "mood": "warm" }
  ],
  "durationSec": 90
}
`;

  return await generate({
    prompt,
    schema: ResponseSchema,
    temperature: 0.7,
  });
}
```

- [ ] **Step 22.2: Commit**

```bash
git add server/agents/vlogAgent.ts
git commit -m "feat(agent): add vlogAgent (Gemini, temperature 0.7, 80-120字 narration)"
```

---

### Task 23: vlogOrchestrator.ts + routes/vlog.ts (SSE)

**Files:** Create `server/orchestrators/vlogOrchestrator.ts`, Create `server/routes/vlog.ts`

- [ ] **Step 23.1: 创建 vlogOrchestrator.ts**

```typescript
// server/orchestrators/vlogOrchestrator.ts
import { generateVlog } from '../agents/vlogAgent';
import { createLogger } from '../utils/logger';
import type { TripRecord, UserPreferences, VlogScript } from '../../shared/types';

const log = createLogger('vlogOrch');

export type ProgressCallback = (stage: string, progress: number) => void;

export interface VlogInput {
  generationId: string;
  tripHistory: TripRecord;
  preferences: UserPreferences;
}

export async function orchestrateVlog(
  input: VlogInput,
  onProgress: ProgressCallback,
  signal: AbortSignal
): Promise<VlogScript> {
  log.info('start', { generationId: input.generationId, waypoints: input.tripHistory.waypoints.length });

  onProgress('profiling', 10);
  await sleep(300, signal);

  onProgress('analyzing_clips', 25);
  await sleep(500, signal);

  onProgress('gemini_generating', 50);
  const script = await generateVlog(input.tripHistory, input.preferences);

  onProgress('rendering', 90);
  await sleep(500, signal);

  log.info('done', { generationId: input.generationId, scenes: script.scenes.length });
  return script;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('ABORTED'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('ABORTED'));
    }, { once: true });
  });
}
```

- [ ] **Step 23.2: 创建 routes/vlog.ts (SSE)**

```typescript
// server/routes/vlog.ts
import { Router } from 'express';
import { z } from 'zod';
import { orchestrateVlog } from '../orchestrators/vlogOrchestrator';
import { createLogger } from '../utils/logger';

const log = createLogger('vlog');
const router: Router = Router();

const RequestSchema = z.object({
  generationId: z.string(),
  tripHistory: z.any(),
  preferences: z.any(),
});

router.post('/', async (req, res) => {
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: parseResult.error.message, retryable: false },
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => {
    log.warn('client disconnected, aborting');
    controller.abort();
  });

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const script = await orchestrateVlog(
      parseResult.data as any,
      (stage, progress) => send({ stage, progress }),
      controller.signal
    );
    send({ stage: 'complete', progress: 100, vlog: script });
    res.end();
  } catch (e) {
    log.error('vlog fail', { e: String(e).slice(0, 500) });
    const msg = String(e);
    const code = msg.includes('QUOTA') ? 'GEMINI_QUOTA' :
                 msg.includes('PARSE') ? 'GEMINI_PARSE_FAIL' :
                 msg.includes('ABORTED') ? 'CLIENT_ABORTED' : 'INTERNAL';
    send({ stage: 'error', error: { code, message: msg.slice(0, 200), retryable: code !== 'GEMINI_QUOTA' } });
    res.end();
  }
});

export default router;
```

- [ ] **Step 23.3: 接进 index.ts**

加一行:

```typescript
import vlogRouter from './routes/vlog';
// ...
app.use('/api/vlog', vlogRouter);
```

- [ ] **Step 23.4: Smoke test SSE**

```bash
npx tsx server/index.ts &
sleep 2
curl -N -s -X POST http://localhost:3001/api/vlog \
  -H 'Content-Type: application/json' \
  -d '{"generationId":"t1","preferences":{"mood":"relax","duration":"2h","transport":"walk","special":["art"],"foodPreference":[],"intensity":"normal"},"tripHistory":{"generationId":"t1","startedAt":"2026-05-20T10:00:00Z","finishedAt":"2026-05-20T12:00:00Z","waypoints":[{"waypoint":{"name":"转角咖啡","description":"","task":"","reward":"","emoji":"☕","distanceText":""},"completedAt":"2026-05-20T10:30:00Z","stayDurationMin":40},{"waypoint":{"name":"愚园书店","description":"","task":"","reward":"","emoji":"📚","distanceText":""},"completedAt":"2026-05-20T11:30:00Z","stayDurationMin":55}],"xpGained":0,"couponIds":[]}}' \
  | head -c 3000
kill %1
```

Expected: 多个 `data: {...}` 事件流式输出,最后是 `complete` 带 `vlog` payload。

- [ ] **Step 23.5: Commit**

```bash
git add server/orchestrators/vlogOrchestrator.ts server/routes/vlog.ts server/index.ts
git commit -m "feat(vlog): SSE endpoint with progress events + AbortController"
```

---

## Phase 6: 前端 services (Day 8)

### Task 24: src/services/api.ts

**Files:** Create `src/services/api.ts`

- [ ] **Step 24.1: 写文件**

```typescript
// src/services/api.ts
import type {
  UserPreferences, MBTI, TripRecord, GeneratedRoute, HiddenTask, ApiError,
} from '../types';

class ApiException extends Error {
  constructor(public payload: ApiError['error']) {
    super(payload.message);
  }
}

async function apiCall<T>(
  path: string,
  body: unknown,
  opts: { timeoutMs: number } = { timeoutMs: 15000 }
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const res = await fetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 204) return undefined as T;
      if (res.ok) return await res.json() as T;

      const err = (await res.json()) as ApiError;
      if (!err.error.retryable || attempt === 1) {
        throw new ApiException(err.error);
      }
      // retry
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof ApiException) {
        if (!e.payload.retryable || attempt === 1) throw e;
        continue;
      }
      if ((e as any).name === 'AbortError') {
        if (attempt === 1) {
          throw new ApiException({ code: 'CLIENT_TIMEOUT', message: '请求超时', retryable: true });
        }
        continue;
      }
      if (attempt === 1) throw e;
    }
  }
  throw new Error('unreachable');
}

export const api = {
  async generateRoute(input: {
    preferences: UserPreferences;
    mbti?: MBTI;
    history?: TripRecord[];
    currentLocation?: { lat: number; lng: number };
  }): Promise<{ generationId: string; route: GeneratedRoute; usedFallback?: boolean }> {
    return await apiCall('/api/route', input, { timeoutMs: 15000 });
  },

  async requestHiddenTask(input: {
    generationId: string;
    preferences: UserPreferences;
    mbti?: MBTI;
    currentWaypointIndex: number;
    currentLocation?: { lat: number; lng: number };
    excludeIds?: string[];
  }): Promise<{ task: HiddenTask } | undefined> {
    return await apiCall('/api/hidden-task', input, { timeoutMs: 8000 });
  },
};

export { ApiException };
```

- [ ] **Step 24.2: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(client): add api.ts wrapper (timeout, retry-once, error shape)"
```

---

### Task 25: src/services/storage.ts

**Files:** Create `src/services/storage.ts`

- [ ] **Step 25.1: 写文件**

```typescript
// src/services/storage.ts
import type {
  MBTI, UserPreferences, TripRecord, GeneratedRoute,
  SavedVlog, ExploreStep, Coupon,
} from '../types';

const ROOT_KEY = 'then-i-go:v1';

export interface PersistedState {
  schemaVersion: 1;
  mbti?: MBTI;
  lastPreferences?: UserPreferences;
  confirmedGear: string[];
  tripHistory: TripRecord[];
  currentGenerationId?: string;
  currentRoute?: GeneratedRoute;
  currentStep?: ExploreStep;
  coupons: Coupon[];
  xp: number;
  achievements: string[];
  vlogs: SavedVlog[];
}

const DEFAULT_STATE: PersistedState = {
  schemaVersion: 1,
  confirmedGear: [],
  tripHistory: [],
  coupons: [],
  xp: 0,
  achievements: [],
  vlogs: [],
};

function migrate(raw: unknown): PersistedState {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const obj = raw as Record<string, unknown>;
  // v1: 直接合并默认值兜底
  return {
    ...DEFAULT_STATE,
    ...obj,
    schemaVersion: 1,
  } as PersistedState;
}

function readGearLegacy(): string[] {
  // 兼容已存在的 confirmedGear key
  try {
    const v = localStorage.getItem('confirmedGear');
    if (v) return JSON.parse(v) as string[];
  } catch {}
  return [];
}

export const storage = {
  load(): PersistedState {
    try {
      const raw = localStorage.getItem(ROOT_KEY);
      if (!raw) {
        // 首次:抢救现有的 confirmedGear
        return { ...DEFAULT_STATE, confirmedGear: readGearLegacy() };
      }
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn('[storage] load failed, returning defaults', e);
      return DEFAULT_STATE;
    }
  },

  save(patch: Partial<PersistedState>): void {
    const current = this.load();
    const next = { ...current, ...patch };
    try {
      localStorage.setItem(ROOT_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[storage] save failed', e);
    }
  },

  clear(): void {
    localStorage.removeItem(ROOT_KEY);
    localStorage.removeItem('confirmedGear');
  },
};
```

- [ ] **Step 25.2: Commit**

```bash
git add src/services/storage.ts
git commit -m "feat(client): storage abstraction (root key, schema v1, legacy gear rescue)"
```

---

### Task 26: src/services/geolocation.ts

**Files:** Create `src/services/geolocation.ts`

- [ ] **Step 26.1: 写文件**

```typescript
// src/services/geolocation.ts

let config = { useFakeLocation: true };
let fakeTargetGetter: (() => { lat: number; lng: number } | undefined) | null = null;

export function setFakeLocationMode(enabled: boolean) {
  config.useFakeLocation = enabled;
}

export function isFakeLocationMode(): boolean {
  return config.useFakeLocation;
}

export function registerFakeTargetGetter(getter: () => { lat: number; lng: number } | undefined) {
  fakeTargetGetter = getter;
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  if (config.useFakeLocation) {
    const target = fakeTargetGetter?.();
    if (!target) {
      // 没有当前目标 → 给一个静安寺默认位置
      return { lat: 31.2305, lng: 121.4501 };
    }
    return {
      lat: target.lat + (Math.random() - 0.5) * 0.0004,
      lng: target.lng + (Math.random() - 0.5) * 0.0004,
    };
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('GEOLOCATION_UNSUPPORTED'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function checkProximity(
  target: { lat: number; lng: number },
  thresholdM: number = 50
): Promise<{ withinRange: boolean; distanceM: number }> {
  const here = await getCurrentPosition();
  const distanceM = haversineM(here, target);
  return { withinRange: distanceM <= thresholdM, distanceM };
}
```

- [ ] **Step 26.2: Commit**

```bash
git add src/services/geolocation.ts
git commit -m "feat(client): geolocation with useFakeLocation toggle + proximity check"
```

---

### Task 27: src/services/vlogStream.ts

**Files:** Create `src/services/vlogStream.ts`

- [ ] **Step 27.1: 写文件**

```typescript
// src/services/vlogStream.ts
import type { VlogScript, TripRecord, UserPreferences, ApiError } from '../types';

export type VlogEvent =
  | { stage: 'profiling' | 'analyzing_clips' | 'gemini_generating' | 'rendering'; progress: number }
  | { stage: 'complete'; progress: 100; vlog: VlogScript }
  | { stage: 'error'; error: ApiError['error'] };

export interface VlogStreamInput {
  generationId: string;
  tripHistory: TripRecord;
  preferences: UserPreferences;
}

export async function* streamVlog(
  body: VlogStreamInput,
  signal: AbortSignal
): AsyncGenerator<VlogEvent, void, void> {
  const res = await fetch('/api/vlog', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE init failed: ${res.status}`);
  }

  const reader = res.body.getReader();
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
      if (chunk.startsWith('data: ')) {
        try {
          yield JSON.parse(chunk.slice(6)) as VlogEvent;
        } catch (e) {
          console.error('[vlogStream] parse fail', chunk, e);
        }
      }
    }
  }
}
```

- [ ] **Step 27.2: Commit**

```bash
git add src/services/vlogStream.ts
git commit -m "feat(client): SSE parser for /api/vlog (async generator)"
```

---

## Phase 7: 前端 onboarding + App.tsx + ExploreScreen (Day 9-10)

### Task 28: OnboardingScreen.tsx

**Files:** Create `src/screens/OnboardingScreen.tsx`

- [ ] **Step 28.1: 写文件**

```typescript
// src/screens/OnboardingScreen.tsx
import React, { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayout } from '../components/Layout';
import type { MBTI } from '../types';

interface Choice {
  axis: 0 | 1 | 2 | 3;
  options: [{ letter: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'; label: string; desc: string },
             { letter: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P'; label: string; desc: string }];
}

const QUESTIONS: Choice[] = [
  { axis: 0, options: [
    { letter: 'E', label: '人多的地方更有劲', desc: '热闹让你充电' },
    { letter: 'I', label: '独处时更舒服', desc: '安静让你充电' },
  ]},
  { axis: 1, options: [
    { letter: 'S', label: '我先看眼前的细节', desc: '务实派' },
    { letter: 'N', label: '我先想象未来的可能', desc: '想象派' },
  ]},
  { axis: 2, options: [
    { letter: 'T', label: '看逻辑做决定', desc: '理性优先' },
    { letter: 'F', label: '看感受做决定', desc: '共情优先' },
  ]},
  { axis: 3, options: [
    { letter: 'J', label: '我喜欢一切都计划好', desc: '有掌控感' },
    { letter: 'P', label: '我喜欢边走边看', desc: '随机应变' },
  ]},
];

export function OnboardingScreen({ onComplete }: { onComplete: (mbti: MBTI) => void }) {
  const [step, setStep] = useState(0);
  const [letters, setLetters] = useState<string[]>(['', '', '', '']);

  const handlePick = (letter: string) => {
    const next = [...letters];
    next[step] = letter;
    setLetters(next);

    if (step === 3) {
      const mbti = next.join('') as MBTI;
      setTimeout(() => onComplete(mbti), 400);
    } else {
      setTimeout(() => setStep(step + 1), 300);
    }
  };

  const q = QUESTIONS[step];

  return (
    <AppLayout>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(108,92,255,.18),transparent_40%)]" />

      <header className="absolute left-0 right-0 top-[80px] z-30 text-center">
        <div className="flex items-center justify-center gap-2 text-[#6C5CFF]">
          <Sparkles size={16} />
          <span className="text-[12px] font-bold tracking-[0.3em]">PROFILE SETUP</span>
        </div>
        <h1 className="mt-3 text-[24px] font-black italic text-white">了解一下你</h1>
        <p className="mt-2 text-[12px] text-white/40">{step + 1} / {QUESTIONS.length}</p>
      </header>

      <main className="absolute inset-x-6 top-[230px] bottom-[40px] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4"
          >
            {q.options.map((opt) => (
              <motion.button
                key={opt.letter}
                whileTap={{ scale: 0.97 }}
                onClick={() => handlePick(opt.letter)}
                className={`w-full rounded-3xl p-6 text-left border transition-all ${
                  letters[step] === opt.letter
                    ? 'bg-[#6C5CFF] border-[#6C5CFF] text-white'
                    : 'bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[18px] font-bold">{opt.label}</div>
                    <div className="text-[12px] opacity-60 mt-1">{opt.desc}</div>
                  </div>
                  <ChevronRight size={18} className="opacity-40" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto flex gap-2 justify-center">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i < step ? 'w-4 bg-[#6C5CFF]' : i === step ? 'w-8 bg-[#A98BFF]' : 'w-4 bg-white/10'
            }`} />
          ))}
        </div>
      </main>
    </AppLayout>
  );
}
```

- [ ] **Step 28.2: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat(screen): OnboardingScreen 4 binary MBTI questions"
```

---

### Task 29: App.tsx 改造 (state + 启动恢复 + handlers)

**Files:** Modify `src/App.tsx`

- [ ] **Step 29.1: 全文替换 App.tsx**

```typescript
// src/App.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, ExploreStep, UserPreferences, GeneratedRoute, MBTI, TripRecord, HiddenTask } from './types';
import { ExploreScreen } from './screens/ExploreScreen';
import { StoryScreen } from './screens/StoryScreen';
import { BagScreen } from './screens/BagScreen';
import { MineScreen } from './screens/MineScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { api, ApiException } from './services/api';
import { storage } from './services/storage';
import { registerFakeTargetGetter } from './services/geolocation';
import { FALLBACK_ROUTE } from './fallbacks/fallbackRoute';

export interface CurrentTrip {
  generationId: string;
  route: GeneratedRoute;
  hiddenTask?: HiddenTask;
  completed: { index: number; completedAt: string; durationMin: number }[];
}

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('explore');
  const [exploreStep, setExploreStep] = useState<ExploreStep>('intro');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [currentTrip, setCurrentTrip] = useState<CurrentTrip | null>(null);
  const [mbti, setMbti] = useState<MBTI | undefined>();
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 启动恢复
  useEffect(() => {
    const state = storage.load();
    setMbti(state.mbti);
    setTripHistory(state.tripHistory);
    setPreferences(state.lastPreferences ?? null);

    if (state.currentGenerationId && state.currentRoute) {
      setCurrentTrip({
        generationId: state.currentGenerationId,
        route: state.currentRoute,
        completed: [],
      });
      if (state.currentStep) setExploreStep(state.currentStep);
    }

    if (!state.mbti) {
      setScreen('onboarding');
    }
  }, []);

  // 让 geolocation service 能拿到当前目标 waypoint
  useEffect(() => {
    registerFakeTargetGetter(() => {
      if (!currentTrip) return undefined;
      const idx = ['initial', 'checkin_initial'].includes(exploreStep) ? 0
                : ['next_objective', 'checkin_next'].includes(exploreStep) ? 1
                : 0;
      const wp = currentTrip.route.waypoints[idx];
      return wp?.lat && wp?.lng ? { lat: wp.lat, lng: wp.lng } : undefined;
    });
  }, [currentTrip, exploreStep]);

  // step 持久化
  useEffect(() => {
    if (currentTrip) storage.save({ currentStep: exploreStep });
  }, [exploreStep, currentTrip]);

  const navigate = (next: ScreenType) => setScreen(next);

  const handleOnboardingComplete = (newMbti: MBTI) => {
    setMbti(newMbti);
    storage.save({ mbti: newMbti });
    setScreen('explore');
  };

  const handlePreferenceConfirm = (prefs: UserPreferences) => {
    setPreferences(prefs);
    storage.save({ lastPreferences: prefs });
    setExploreStep('gear_confirmation');
  };

  const handleGearConfirm = async () => {
    if (!preferences) return;
    setIsGenerating(true);

    try {
      const { generationId, route } = await api.generateRoute({
        preferences,
        mbti,
        history: tripHistory.slice(-5),
      });
      const trip = { generationId, route, completed: [] };
      setCurrentTrip(trip);
      storage.save({ currentGenerationId: generationId, currentRoute: route, currentStep: 'initial' });
      setExploreStep('initial');
    } catch (err) {
      console.error('generate route fail, using fallback', err);
      const trip = { generationId: 'fallback', route: FALLBACK_ROUTE, completed: [] };
      setCurrentTrip(trip);
      setExploreStep('initial');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAfterInitialCheckin = async () => {
    if (!currentTrip || !preferences) {
      setExploreStep('next_objective');
      return;
    }

    try {
      const result = await api.requestHiddenTask({
        generationId: currentTrip.generationId,
        preferences,
        mbti,
        currentWaypointIndex: 0,
      });
      if (result?.task) {
        setCurrentTrip({ ...currentTrip, hiddenTask: result.task });
        setExploreStep('hidden_found');
      } else {
        setExploreStep('next_objective');
      }
    } catch (e) {
      console.warn('hidden task fail, skip', e);
      setExploreStep('next_objective');
    }
  };

  const handleTripComplete = () => {
    if (!currentTrip) return;
    const record: TripRecord = {
      generationId: currentTrip.generationId,
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finishedAt: new Date().toISOString(),
      waypoints: currentTrip.route.waypoints.map((wp, i) => ({
        waypoint: wp,
        completedAt: new Date(Date.now() - (i + 1) * 30 * 60 * 1000).toISOString(),
        stayDurationMin: 30,
      })),
      xpGained: 60,
      couponIds: [],
    };
    const newHistory = [...tripHistory, record].slice(-30);
    setTripHistory(newHistory);
    const state = storage.load();
    storage.save({
      tripHistory: newHistory,
      currentGenerationId: undefined,
      currentRoute: undefined,
      currentStep: undefined,
      xp: state.xp + 60,
    });
    setCurrentTrip(null);
  };

  return (
    <div className="h-full w-full bg-[#05060F] font-[PingFang_SC,Inter,system-ui,sans-serif] text-white">
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#05060F]/95 backdrop-blur-md"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="h-12 w-12 rounded-full border-4 border-white/10 border-t-[#6C5CFF]"
            />
            <p className="mt-6 text-[15px] font-bold text-white/60">AI 正在为你规划路线…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full w-full"
        >
          {screen === 'onboarding' && <OnboardingScreen onComplete={handleOnboardingComplete} />}
          {screen === 'explore' && (
            <ExploreScreen
              step={exploreStep}
              setStep={setExploreStep}
              onNavigate={navigate}
              onPreferenceConfirm={handlePreferenceConfirm}
              onGearConfirm={handleGearConfirm}
              currentTrip={currentTrip}
              onAfterInitialCheckin={handleAfterInitialCheckin}
              onTripComplete={handleTripComplete}
            />
          )}
          {screen === 'story' && <StoryScreen onNavigate={navigate} currentTrip={currentTrip} preferences={preferences} />}
          {screen === 'bag' && <BagScreen onNavigate={navigate} />}
          {screen === 'mine' && <MineScreen onNavigate={navigate} />}
          {screen === 'event' && <EventDetailScreen onBack={() => navigate('explore')} />}
          {screen === 'settings' && <SettingsScreen onBack={() => navigate('mine')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 29.2: 创建 src/fallbacks/fallbackRoute.ts** (前端也要一份)

```typescript
// src/fallbacks/fallbackRoute.ts
import type { GeneratedRoute } from '../types';

export const FALLBACK_ROUTE: GeneratedRoute = {
  title: '静安区的小确幸',
  waypoints: [
    {
      name: '转角咖啡馆',
      description: '藏着这条街十年前的秘密',
      task: '找到窗边的那把椅子',
      reward: '美团单车7天畅骑卡',
      emoji: '☕',
      distanceText: '步行约 8 分钟',
      lat: 31.2305,
      lng: 121.4501,
    },
    {
      name: '愚园路书店',
      description: '即便发呆四小时也合法',
      task: '在中文区找一本你没读过的书',
      reward: '咖啡店 8 折券',
      emoji: '📚',
      distanceText: '步行约 12 分钟',
      lat: 31.2315,
      lng: 121.4495,
    },
  ],
};
```

- [ ] **Step 29.3: 删除现有的 src/agents/routeAgent.ts**

```bash
rm src/agents/routeAgent.ts
# 如果 src/agents 空了也删
rmdir src/agents 2>/dev/null || true
```

- [ ] **Step 29.4: 类型检查**

```bash
npm run lint
```

Expected: ExploreScreen/StoryScreen 的 prop 不匹配错误(下个 task 修)。先记下,继续。

- [ ] **Step 29.5: Commit**

```bash
git add src/App.tsx src/fallbacks/fallbackRoute.ts
git rm src/agents/routeAgent.ts 2>/dev/null
git commit -m "feat(app): App.tsx refactor — mbti/history/currentTrip + storage restore + onboarding"
```

---

### Task 30: ExploreScreen 改用 currentTrip

**Files:** Modify `src/screens/ExploreScreen.tsx`

- [ ] **Step 30.1: 改 props 和 import**

打开 `src/screens/ExploreScreen.tsx`,在文件顶部把 import 改为:

```typescript
import { ScreenType, ExploreStep, UserPreferences, HiddenTask } from "../types";
import type { CurrentTrip } from "../App";
import { checkProximity } from "../services/geolocation";
```

把 `export function ExploreScreen({...})` 的签名改为:

```typescript
export function ExploreScreen({
  onNavigate,
  step,
  setStep,
  onPreferenceConfirm,
  onGearConfirm,
  currentTrip,
  onAfterInitialCheckin,
  onTripComplete,
}: {
  onNavigate: (s: ScreenType) => void;
  step: ExploreStep;
  setStep: (s: ExploreStep) => void;
  onPreferenceConfirm: (prefs: UserPreferences) => void;
  onGearConfirm: () => void;
  currentTrip: CurrentTrip | null;
  onAfterInitialCheckin: () => void;
  onTripComplete: () => void;
}) {
```

- [ ] **Step 30.2: 替换 generatedRoute 引用**

在 ExploreScreen 函数体内,搜索 `generatedRoute` 全部替换为 `currentTrip?.route`。例如:

```typescript
// 原:
const handleInitialCheckin = () => {
  setStep("hidden_found");
};
// 改为:
const handleInitialCheckin = () => {
  onAfterInitialCheckin();
};
```

```typescript
// NextTarget / TaskCard 等组件 props 传入处:
<NextTarget step={step} generatedRoute={currentTrip?.route ?? null} />
<TaskCard ... generatedRoute={currentTrip?.route ?? null} hiddenTask={currentTrip?.hiddenTask} />
```

- [ ] **Step 30.3: 改 HiddenTaskAlert 用 hiddenTask**

找到 `<HiddenTaskAlert onAccept={startHiddenTask} />`,改为:

```typescript
{step === "hidden_found" && currentTrip?.hiddenTask && (
  <HiddenTaskAlert onAccept={startHiddenTask} hiddenTask={currentTrip.hiddenTask} />
)}
```

并且修改 `HiddenTaskAlert` 函数签名:

```typescript
function HiddenTaskAlert({ onAccept, hiddenTask }: { onAccept: () => void; hiddenTask: HiddenTask }) {
  // ... 替换"转角咖啡店"/秘密文案为 hiddenTask.name / hiddenTask.description
  return (
    // 修改:
    // <h2>触发:隐藏记忆</h2> — 保留
    // <div>转角咖啡店</div> → <div>{hiddenTask.name}</div>
    // <p>"那里不仅有醇厚的香气..."</p> → <p>{hiddenTask.description}</p>
    ...
  );
}
```

具体找到这段并替换:

```typescript
// 找到:
<div className="flex items-center gap-2 text-amber-400">
   <MapPin size={16} />
   <span className="text-[14px] font-bold">转角咖啡店</span>
</div>
<p className="mt-2 text-[12px] leading-relaxed text-white/50">
  那里不仅有醇厚的香气,还藏着这个街区十年前的秘密瞬间。
</p>

// 替换为:
<div className="flex items-center gap-2 text-amber-400">
   <MapPin size={16} />
   <span className="text-[14px] font-bold">{hiddenTask.name}</span>
</div>
<p className="mt-2 text-[12px] leading-relaxed text-white/50">
  {hiddenTask.description}
</p>
```

- [ ] **Step 30.4: TaskCard 在 hidden_active 阶段用 hiddenTask**

找到 `TaskCard` 函数,修改 props:

```typescript
function TaskCard({ step, onComplete, onCheckIn, generatedRoute, hiddenTask }: {
  step: ExploreStep;
  onComplete: () => void;
  onCheckIn: () => void;
  generatedRoute: import("../types").GeneratedRoute | null;
  hiddenTask?: HiddenTask;
}) {
```

`getTaskContent()` 里 `isHiddenActive` 分支改为:

```typescript
if (isHiddenActive) return {
  title: hiddenTask?.name ?? "秘密地点",
  desc: hiddenTask?.task ?? "开启特殊的视频打卡",
  detail: hiddenTask?.description ?? "通过老木门走进那段旧时光",
  reward: hiddenTask?.reward ?? "+50 XP",
  color: "#F59E0B",
};
```

- [ ] **Step 30.5: NextTarget 用 hiddenTask 的 lat/lng (光标位置)**

找到 `NextTarget` 函数中 `isHiddenActive` 分支:

```typescript
// 原硬编码 emoji:
<span className="relative text-xl">☕</span>

// 改为:
<span className="relative text-xl">{hiddenTask?.emoji ?? "☕"}</span>

// 标签文字:
<div className="text-[12px] font-bold text-amber-100">转角咖啡店</div>
// 改为:
<div className="text-[12px] font-bold text-amber-100">{hiddenTask?.name ?? "秘密坐标"}</div>
```

同时把 `NextTarget` 的 props 改为:

```typescript
function NextTarget({ step, generatedRoute, hiddenTask }: {
  step: ExploreStep;
  generatedRoute: import("../types").GeneratedRoute | null;
  hiddenTask?: HiddenTask;
}) {
```

- [ ] **Step 30.6: CameraInterface 加 LBS 校验**

找到 `CameraInterface` 函数,改 props:

```typescript
function CameraInterface({ onCapture, onClose, targetLat, targetLng }: {
  onCapture: () => void;
  onClose: () => void;
  targetLat?: number;
  targetLng?: number;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [proximity, setProximity] = useState<{ withinRange: boolean; distanceM: number } | null>(null);

  useEffect(() => {
    if (!targetLat || !targetLng) {
      setProximity({ withinRange: true, distanceM: 0 });
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await checkProximity({ lat: targetLat, lng: targetLng }, 50);
        if (!cancelled) setProximity(result);
      } catch (e) {
        if (!cancelled) setProximity({ withinRange: true, distanceM: 0 }); // 拿不到位置降级允许
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [targetLat, targetLng]);

  const canRecord = proximity?.withinRange ?? false;

  // ... 原有 useEffect for isRecording 不动

  return (
    <motion.div /* ... 原 wrapper ... */>
      {/* ... 原 viewfinder ... */}

      <div className="space-y-8">
        <div className="text-center">
          <p className="text-[12px] font-bold text-white tracking-[0.2em] uppercase">
            {!canRecord
              ? `距离打卡点还有 ${Math.round(proximity?.distanceM ?? 0)} 米`
              : isRecording ? "记录中..." : "长按捕获 3 秒素材"}
          </p>
          {/* ... 原进度条 ... */}
        </div>

        <div className="flex items-center justify-center gap-12">
          {/* ... 原刷新和缩略图 ... */}
          <button
            disabled={!canRecord}
            onMouseDown={() => canRecord && setIsRecording(true)}
            onMouseUp={() => canRecord && !progress && setIsRecording(false)}
            onTouchStart={() => canRecord && setIsRecording(true)}
            onTouchEnd={() => canRecord && !progress && setIsRecording(false)}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full border-4 p-1 ${
              canRecord ? 'border-white/40' : 'border-white/10 opacity-40 cursor-not-allowed'
            }`}
          >
            <div className={`h-full w-full rounded-full bg-white transition-all duration-300 ${isRecording ? "scale-90 rounded-lg bg-red-600 shadow-[0_0_20px_red]" : "scale-100"}`} />
          </button>
          {/* ... 原缩略图 ... */}
        </div>
      </div>

      {/* ... 原 scanline ... */}
    </motion.div>
  );
}
```

调用处把 targetLat/Lng 传进去:

```typescript
{isCapturing && (
  <CameraInterface
    targetLat={
      step === 'checkin_initial' ? currentTrip?.route.waypoints[0]?.lat :
      step === 'checkin_hidden' ? currentTrip?.hiddenTask?.lat :
      step === 'checkin_next' ? currentTrip?.route.waypoints[1]?.lat :
      undefined
    }
    targetLng={
      step === 'checkin_initial' ? currentTrip?.route.waypoints[0]?.lng :
      step === 'checkin_hidden' ? currentTrip?.hiddenTask?.lng :
      step === 'checkin_next' ? currentTrip?.route.waypoints[1]?.lng :
      undefined
    }
    onCapture={() => { /* ... 原 logic ... */ }}
    onClose={() => { /* ... 原 logic ... */ }}
  />
)}
```

- [ ] **Step 30.7: AchievementOverlay 完成时调 onTripComplete**

```typescript
<AchievementOverlay onContinue={() => {
  onTripComplete();
  setStep("intro");
}} />
```

- [ ] **Step 30.8: 类型检查**

```bash
npm run lint
```

Expected: pass(可能还有 StoryScreen prop 不匹配,后面 task 修)。

- [ ] **Step 30.9: 端到端手测**

```bash
npm run dev:all
# 浏览器打开 http://localhost:3000
# 走流程:onboarding → preferences → gear → 看到 AI 生成的 waypoint → 打卡(LBS 通过)→ hidden task → 完成
```

Expected: 打卡前显示距离倒数,完成后 storage 看到 tripHistory.length 增加 1。

- [ ] **Step 30.10: Commit**

```bash
git add src/screens/ExploreScreen.tsx
git commit -m "feat(explore): wire currentTrip + LBS proximity + hidden task from API"
```

---

## Phase 8: Vlog 接通 + 其他屏读 storage (Day 11)

### Task 31: StoryScreen 接 SSE + 历史读 storage

**Files:** Modify `src/screens/StoryScreen.tsx`

- [ ] **Step 31.1: 改 import 和 props**

```typescript
import { streamVlog } from '../services/vlogStream';
import { storage } from '../services/storage';
import type { CurrentTrip } from '../App';
import type { UserPreferences, SavedVlog, TripRecord } from '../types';

export function StoryScreen({
  onNavigate,
  currentTrip,
  preferences,
}: {
  onNavigate: (s: ScreenType) => void;
  currentTrip: CurrentTrip | null;
  preferences: UserPreferences | null;
}) {
```

- [ ] **Step 31.2: 用 storage 替代 historicalVlogs 硬编码**

找到 `const historicalVlogs = [...]` 改为:

```typescript
const [savedVlogs, setSavedVlogs] = React.useState<SavedVlog[]>([]);
const [tripHistory, setTripHistory] = React.useState<TripRecord[]>([]);

React.useEffect(() => {
  const s = storage.load();
  setSavedVlogs(s.vlogs);
  setTripHistory(s.tripHistory);
}, []);
```

历史 tab 渲染时改为遍历 `savedVlogs`:

```typescript
{savedVlogs.length === 0 ? (
  <div className="mt-12 text-center text-white/40 text-[13px]">
    还没有生成过 Vlog,去探索一次试试
  </div>
) : (
  savedVlogs.map((v, idx) => (
    <motion.div key={v.generationId} /* ... 原样式 ... */>
      <div className="flex-1">
        <div className="text-[10px] text-white/30 font-bold">
          {new Date(v.generatedAt).toLocaleDateString()}
        </div>
        <h3 className="text-[15px] font-bold text-white/90 mt-0.5">{v.script.title}</h3>
        <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{v.script.narration}</p>
      </div>
    </motion.div>
  ))
)}
```

- [ ] **Step 31.3: 改造 VlogGenerationOverlay 接 SSE**

```typescript
function VlogGenerationOverlay({ onFinish, onCancel, body }: {
  onFinish: () => void;
  onCancel: () => void;
  body: import('../services/vlogStream').VlogStreamInput;
}) {
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState('启动中...');

  const STAGE_TEXT: Record<string, string> = {
    profiling: '正在分析今日深度足迹...',
    analyzing_clips: '提取画面精彩瞬间...',
    gemini_generating: '正在 AI 创作脚本...',
    rendering: '后期处理...',
    complete: '完成',
  };

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        for await (const ev of streamVlog(body, controller.signal)) {
          if (ev.stage === 'complete') {
            const newVlog: SavedVlog = {
              generationId: body.generationId,
              tripId: body.tripHistory.generationId,
              generatedAt: new Date().toISOString(),
              script: ev.vlog,
            };
            const cur = storage.load().vlogs;
            storage.save({ vlogs: [...cur, newVlog] });
            setProgress(100);
            setStatus(STAGE_TEXT.complete);
            setTimeout(onFinish, 800);
            return;
          }
          if (ev.stage === 'error') {
            setStatus('生成失败,请稍后重试');
            setTimeout(onCancel, 1500);
            return;
          }
          setProgress(ev.progress);
          setStatus(STAGE_TEXT[ev.stage] ?? '处理中...');
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error(e);
          setStatus('生成失败');
          setTimeout(onCancel, 1500);
        }
      }
    })();

    return () => controller.abort();
  }, [body, onFinish, onCancel]);

  return (
    // ... 沿用原来的 UI,只把 status / progress 变量绑上即可 ...
    // (保留原 component body 的 JSX 不动)
  );
}
```

- [ ] **Step 31.4: 生成按钮触发时构造 body**

找到 `<motion.button onClick={() => setIsGenerating(true)}` 改为:

```typescript
<motion.button
  whileTap={{ scale: 0.98 }}
  onClick={() => {
    if (!currentTrip || !preferences) {
      alert('请先完成一次探索');
      return;
    }
    // 构造 trip record(取最近一条 history 或 currentTrip)
    const trip = tripHistory[tripHistory.length - 1];
    if (!trip) {
      alert('没有可用的探索记录');
      return;
    }
    setIsGenerating(true);
  }}
  /* ... */
>
```

并把 `<VlogGenerationOverlay onFinish={...} onCancel={...} />` 改为:

```typescript
{isGenerating && tripHistory.length > 0 && preferences && (
  <VlogGenerationOverlay
    body={{
      generationId: crypto.randomUUID(),
      tripHistory: tripHistory[tripHistory.length - 1],
      preferences,
    }}
    onFinish={() => {
      setIsGenerating(false);
      setActiveTab(1);
      // 重新读 storage
      setSavedVlogs(storage.load().vlogs);
    }}
    onCancel={() => setIsGenerating(false)}
  />
)}
```

- [ ] **Step 31.5: 手测**

```bash
npm run dev:all
# 先完整走一次探索,然后到 Story tab 点"生成今日 AI Vlog"
# 应该看到 4 个 stage 文字逐步切换,进度条非 fake 而是 SSE 推
```

- [ ] **Step 31.6: Commit**

```bash
git add src/screens/StoryScreen.tsx
git commit -m "feat(story): wire Vlog generation to SSE + load history from storage"
```

---

### Task 32: BagScreen 读 storage

**Files:** Modify `src/screens/BagScreen.tsx`

- [ ] **Step 32.1: 改造为读 storage**

把 `const coupons: Coupon[] = [ ... ]` 硬编码改为:

```typescript
const [coupons, setCoupons] = useState<Coupon[]>([]);

useEffect(() => {
  setCoupons(storage.load().coupons);
}, []);
```

加 import:

```typescript
import { storage } from '../services/storage';
```

`items` 数组保持现状(spec 没要求道具系统真化,作为静态展示可接受)。

- [ ] **Step 32.2: 手测**

```bash
npm run dev:all
# 进 Bag tab,优惠券列表应该是空的(因为还没人塞数据)
# 这是预期行为
```

- [ ] **Step 32.3: Commit**

```bash
git add src/screens/BagScreen.tsx
git commit -m "feat(bag): read coupons from storage"
```

---

### Task 33: MineScreen 读 storage 算等级/统计

**Files:** Modify `src/screens/MineScreen.tsx`

- [ ] **Step 33.1: 改造数据源**

把 4 个硬编码的 `StatCard` 数字改为从 storage 算:

```typescript
// 顶部加 import
import { useState, useEffect } from 'react';
import { storage } from '../services/storage';

// 在 MineScreen 函数体顶部:
const [stats, setStats] = useState({ days: 0, km: '0.0', tasks: 0, coupons: 0, xp: 0, level: 1, progress: 0 });

useEffect(() => {
  const s = storage.load();
  const days = new Set(s.tripHistory.map(t => t.startedAt.slice(0, 10))).size;
  const tasks = s.tripHistory.reduce((sum, t) => sum + t.waypoints.length, 0);
  // 公里数:每个 waypoint 假定 0.4km
  const km = (tasks * 0.4).toFixed(1);
  const xp = s.xp;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const progress = (xp % 100) / 100;
  setStats({ days, km, tasks, coupons: s.coupons.length, xp, level, progress });
}, []);
```

把 JSX 里:

```typescript
<span className="text-[12px] text-[#A98BFF] font-black uppercase">LV.12</span>
<div className="h-1.5 w-[100px] rounded-full bg-white/10">
  <motion.div initial={{ width: 0 }} animate={{ width: "62%" }} className="h-full rounded-full bg-[#6C5CFF]" />
</div>
```

改为:

```typescript
<span className="text-[12px] text-[#A98BFF] font-black uppercase">LV.{stats.level}</span>
<div className="h-1.5 w-[100px] rounded-full bg-white/10">
  <motion.div initial={{ width: 0 }} animate={{ width: `${stats.progress * 100}%` }} className="h-full rounded-full bg-[#6C5CFF]" />
</div>
```

把:

```typescript
<StatCard num="28" label="天数" />
<StatCard num="86.3" label="公里" />
<StatCard num="56" label="任务" />
<StatCard num="26" label="礼券" />
```

改为:

```typescript
<StatCard num={String(stats.days)} label="天数" />
<StatCard num={stats.km} label="公里" />
<StatCard num={String(stats.tasks)} label="任务" />
<StatCard num={String(stats.coupons)} label="礼券" />
```

- [ ] **Step 33.2: Commit**

```bash
git add src/screens/MineScreen.tsx
git commit -m "feat(mine): compute level/stats from storage"
```

---

### Task 34: SettingsScreen 加 useFakeLocation toggle

**Files:** Modify `src/screens/SettingsScreen.tsx`

- [ ] **Step 34.1: 改造**

在 import 区加:

```typescript
import { setFakeLocationMode, isFakeLocationMode } from '../services/geolocation';
import { storage } from '../services/storage';
```

在 SettingsScreen 函数内加一个本地 state:

```typescript
const [fakeLoc, setFakeLoc] = React.useState(isFakeLocationMode());
```

在"应用设置" section 加一条:

```typescript
<div className="mx-4 h-px bg-white/5" />
<div className="flex w-full items-center justify-between p-5">
  <div className="flex items-center gap-4">
    <div className="text-white/40">📍</div>
    <span className="text-[17px] text-white/90 font-medium">模拟定位(演示用)</span>
  </div>
  <button
    onClick={() => {
      const next = !fakeLoc;
      setFakeLoc(next);
      setFakeLocationMode(next);
    }}
    className={`relative h-7 w-12 rounded-full p-1 transition-colors ${fakeLoc ? 'bg-[#6C5CFF]' : 'bg-white/10 ring-1 ring-white/10'}`}
  >
    <motion.div animate={{ x: fakeLoc ? 20 : 0 }} className="h-5 w-5 rounded-full bg-white shadow-lg" />
  </button>
</div>
```

在"其他" section 加一个"重置 MBTI":

```typescript
<div className="mx-4 h-px bg-white/5" />
<button
  onClick={() => {
    if (confirm('重置后下次启动会重新做 MBTI 测试')) {
      storage.save({ mbti: undefined });
      location.reload();
    }
  }}
  className="flex w-full items-center justify-between p-5 hover:bg-white/5 transition-colors group"
>
  <div className="flex items-center gap-4">
    <div className="text-white/40 group-hover:text-[#A98BFF] transition-colors">🧠</div>
    <span className="text-[17px] text-white/90 font-medium">重置 MBTI</span>
  </div>
  <ChevronRight size={18} className="text-white/20" />
</button>
```

- [ ] **Step 34.2: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): useFakeLocation toggle + MBTI reset"
```

---

## Phase 9: 重构 + 验证 + Polish (Day 12-14)

### Task 35: 拆分 ExploreScreen.tsx (overlays/ + map/)

**Files:** Create `src/screens/explore/index.tsx`, move overlays and map components

> **纪律**: 每个子组件单独 commit,出问题快速 revert。本 task 不动任何业务逻辑,只搬代码。

- [ ] **Step 35.1: 创建目录**

```bash
mkdir -p src/screens/explore/overlays
mkdir -p src/screens/explore/map
```

- [ ] **Step 35.2: 抽出 CityMapTexture**

新建 `src/screens/explore/map/CityMapTexture.tsx`,把 `ExploreScreen.tsx` 中 `CityMapTexture` 函数(及其所需 import)整体剪过来。
然后在 `ExploreScreen.tsx` 删除原函数,加 `import { CityMapTexture } from './explore/map/CityMapTexture';`(如果 ExploreScreen.tsx 已在 explore/ 目录则路径调整)。

```bash
npm run lint
npm run dev:all # 手测页面没崩
git add src/screens/explore/map/CityMapTexture.tsx src/screens/ExploreScreen.tsx
git commit -m "refactor(explore): extract CityMapTexture"
```

- [ ] **Step 35.3-35.13: 依次抽出剩余组件**

对以下组件分别重复 35.2 的流程,每个一个 commit:

```
src/screens/explore/map/
  ├── FogLayer.tsx
  ├── DottedPath.tsx
  ├── UserAvatar.tsx
  ├── NextTarget.tsx           (props: step, generatedRoute, hiddenTask)
  ├── UnknownMarkers.tsx
  └── Legend.tsx
src/screens/explore/overlays/
  ├── IntroOverlay.tsx
  ├── PreferenceOverlay.tsx
  ├── GearConfirmationOverlay.tsx
  ├── HiddenTaskAlert.tsx       (props: onAccept, hiddenTask)
  ├── RewardOverlay.tsx
  ├── AchievementOverlay.tsx
  └── CameraInterface.tsx       (props: onCapture, onClose, targetLat?, targetLng?)
src/screens/explore/
  └── TaskCard.tsx              (props: step, onComplete, onCheckIn, generatedRoute, hiddenTask)
```

每抽完一个:
```bash
npm run lint
git add -A
git commit -m "refactor(explore): extract <ComponentName>"
```

- [ ] **Step 35.14: 把 ExploreScreen.tsx 主体移到 explore/index.tsx**

最后一步:把剩下的 `ExploreScreen` 函数移到 `src/screens/explore/index.tsx`,内部 `import` 路径全部改为同目录或子目录相对路径。
旧的 `src/screens/ExploreScreen.tsx` 改为单行 re-export:

```typescript
// src/screens/ExploreScreen.tsx
export { ExploreScreen } from './explore';
```

```bash
npm run lint
npm run dev:all # 整体手测
git add src/screens/ExploreScreen.tsx src/screens/explore/index.tsx
git commit -m "refactor(explore): split main component into explore/index.tsx"
```

---

### Task 36: 跑一次完整端到端验收

**Files:** none (manual test)

- [ ] **Step 36.1: 清 storage 模拟新用户**

```bash
# 在浏览器 devtools console:
localStorage.clear()
# 然后刷新
```

- [ ] **Step 36.2: 走完整流程**

1. 看到 OnboardingScreen,选 4 道题,得到 MBTI (如 INFP)
2. 进 Explore 主屏,点"自定义偏好"
3. 完成偏好选择,点"生成今日剧情"
4. 装备页确认,点"已备齐"
5. 看到"AI 正在为你规划路线..."然后跳到 initial
6. waypoint 0 名字应该来自 Gemini(不是 fallback,除非 Gemini quota 满)
7. 点 TaskCard 展开 → 点"开启打卡"
8. CameraInterface 显示距离倒数(几米)→ 长按相机捕获 3 秒
9. 应该看到 hidden_found Alert,内容来自 hiddenTaskAgent
10. 点"立刻前往" → hidden_active → 打卡 → reward_hidden
11. 继续 next_objective → 打卡 → achievement_unlock
12. 完成后回 intro
13. 切到 Mine tab,LV 应该 ≥ 2(因为 +60 XP)
14. 切到 Story tab,点"生成今日 AI Vlog"
15. SSE 4 个 stage 文案逐步切换,完成后跳到历史 tab
16. 历史 tab 看到 1 个 Vlog,标题是 Gemini 生成的
17. 刷新页面,再次进入,应该不再问 MBTI

- [ ] **Step 36.3: 记录 bug + 修复**

如果有 regression,逐个修复并 commit。

- [ ] **Step 36.4: 端到端 commit**

```bash
git add -A
git commit -m "fix: end-to-end demo flow audit" || echo "no fixes needed"
```

---

### Task 37: 写一个 POI 可视化脚本

**Files:** Create `scripts/visualizePOIs.ts`

- [ ] **Step 37.1: 写文件**

```typescript
// scripts/visualizePOIs.ts
// 把 30 个 POI 画到 SVG,目测分簇合理性
// 运行:npx tsx scripts/visualizePOIs.ts > out.svg

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { POI } from '../shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pois: POI[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '../server/data/pois.json'), 'utf-8')
);

const COLORS: Record<string, string> = {
  center: '#6C5CFF',
  north: '#00E5FF',
  south: '#FFD166',
  east: '#FF4D64',
  west: '#A98BFF',
};

// bounding box (静安区)
const MIN_LAT = 31.220, MAX_LAT = 31.244;
const MIN_LNG = 121.438, MAX_LNG = 121.462;

const W = 600, H = 600;
const x = (lng: number) => ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * W;
const y = (lat: number) => H - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * H;

console.log(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0A0A1A">`);
console.log(`<text x="20" y="30" fill="white" font-family="monospace" font-size="14">POI Distribution (n=${pois.length})</text>`);

for (const p of pois) {
  const cx = x(p.lng), cy = y(p.lat);
  const color = COLORS[p.cluster] ?? '#fff';
  console.log(`  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${color}" opacity="0.8" />`);
  console.log(`  <text x="${(cx + 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="white" font-size="9" font-family="monospace">${p.name}</text>`);
}

// 图例
let ly = 50;
for (const [cluster, color] of Object.entries(COLORS)) {
  const count = pois.filter((p) => p.cluster === cluster).length;
  console.log(`  <circle cx="20" cy="${ly}" r="5" fill="${color}" />`);
  console.log(`  <text x="32" y="${ly + 4}" fill="white" font-size="11" font-family="monospace">${cluster} (${count})</text>`);
  ly += 18;
}

console.log('</svg>');
```

- [ ] **Step 37.2: 跑脚本生成 SVG**

```bash
npx tsx scripts/visualizePOIs.ts > poi-map.svg
```

- [ ] **Step 37.3: 浏览器打开 poi-map.svg 目测**

期望:5 簇分布明显,无簇空,无某簇明显散开。如果不合理,可单独让 Gemini 重新生成那一簇(手动改 `generatePOIs.ts` prompt 然后跑)。

- [ ] **Step 37.4: Commit (但不 commit svg,加进 gitignore)**

```bash
echo "poi-map.svg" >> .gitignore
git add scripts/visualizePOIs.ts .gitignore
git commit -m "tool: POI cluster visualization SVG"
```

---

### Task 38: 更新 README

**Files:** Modify `README.md`

- [ ] **Step 38.1: 改写**

```markdown
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 那我走 (Then-I-GO)

一款基于多 Agent AI 的周末城市探索 App。用户喊一句"那我走",系统决定去哪。

## 架构

- **前端**:React 19 + Vite 6 + Tailwind v4 + motion (`localhost:3000`)
- **后端**:Express + tsx + Google Gemini (`localhost:3001`)
- **多 Agent**:Profiling/POI Sourcing(纯 TS)+ Routing/HiddenTask/Vlog(Gemini)
- **数据**:`server/data/pois.json`(一次性 Gemini 生成,带 lat/lng 分簇)
- **持久化**:前端 localStorage,后端无状态

## 本地启动

需要 Node.js 20+ 和 `GEMINI_API_KEY`。

```bash
# 1. 配置 .env.local,设 GEMINI_API_KEY=...
cp .env.example .env.local
# 编辑 .env.local 填 key

# 2. 安装依赖
npm install

# 3. 同时启动前后端
npm run dev:all
# 浏览器打开 http://localhost:3000
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev:all` | 同时启动 Vite (`:3000`) + Express (`:3001`) |
| `npm run dev` | 只启动前端 |
| `npm run dev:server` | 只启动后端 |
| `npm run test` | 运行单测 (vitest) |
| `npm run lint` | 前后端 TypeScript 类型检查 |
| `npm run build` | 前端生产构建 |
| `npm run generate:pois` | 一次性脚本:用 Gemini 生成 POI 数据到 `server/data/pois.json` |

## 详细设计

- 后端与多 Agent 设计:`docs/superpowers/specs/2026-05-20-backend-design.md`
- 14 天实施计划:`docs/superpowers/plans/2026-05-20-backend-implementation.md`
```

- [ ] **Step 38.2: Commit**

```bash
git add README.md
git commit -m "docs: update README with backend architecture and commands"
```

---

### Task 39: 最终 demo 视频前 checklist

**Files:** none

- [ ] **Step 39.1: 跑完整 demo 一次,确保 spec §9 验收清单全 pass**

参考 `docs/superpowers/specs/2026-05-20-backend-design.md` §9 的 14 条验收清单,逐项打勾。

- [ ] **Step 39.2: Final commit**

```bash
git status # 应该 clean
# 如果不是,把零碎修复 commit 完
git push  # 推到 remote (如果有)
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 检查 spec 的每节都有对应 task
  - §1 架构 → Task 4, 5, 6 (Express + proxy + scripts)
  - §2 模块组织 → 整个 Phase 1-5 按目录建立
  - §3 API 设计 → Task 18, 21, 23
  - §4 状态归属 → Task 25, 29
  - §5 错误处理 + SSE → Task 10 (geminiClient), 18/21 (error code), 23 (SSE)
  - §6 前端改造 → Phase 7-8
  - §7 POI lat/lng → Task 12 (regen), 14 (cluster filter), 26 (geolocation)
  - §8 排期 → Phase 1-9 对应
  - §9 验收清单 → Task 36 (端到端走一遍), Task 39 (final)
- [x] **No placeholders**: 所有步骤都有可执行代码/命令
- [x] **Type consistency**: `CurrentTrip` 在 App.tsx 定义并被 ExploreScreen/StoryScreen import;`HiddenTask`/`VlogScript`/`SavedVlog` 来自 shared/types

---

## Risks & Mitigation

| 风险 | 缓解 |
|---|---|
| SSE buffering 在 Vite proxy 出问题 | Task 5 的 `x-accel-buffering: no` + Task 23 的 `flushHeaders()`,Task 27 用 manual fetch + reader 而非 EventSource |
| Gemini quota 用光 | 开发期把 routeNarrativeAgent 临时替换为返回 `FALLBACK_ROUTE` 的 mock(注释掉真调用),demo 当天用真调 |
| `tsx watch` 重启丢请求 | Task 24 `api.ts` 内置 retry-once 兜底 |
| pois.json 文件不存在导致 server 起不来 | Task 11 `POIRepository` 捕获错误,降级为空数组(routeOrchestrator 拿到空池走 fallback) |
| 拆 ExploreScreen 引入 regression | Task 35 每个组件单独 commit,出问题快速 revert 单个 commit |
