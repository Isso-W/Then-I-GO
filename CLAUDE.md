# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**那我走 (Then-I-GO)** is a hackathon project for the local-life track. The core concept: the user says "let's go" — the system figures out where.

**What it does**: A weekend walk recommendation app powered by a multi-agent AI backend. Instead of the user planning a route, the system generates a personalized exploration itinerary on demand, then guides the user through it with check-in tasks and rewards.

**Key differentiators**:
- **Multi-agent route generation**: Multiple AI agents collaborate to produce a route — one agent handles user profiling (MBTI, past exploration history, stated mood/preferences), another sources nearby POIs, another assembles the narrative and task sequence. The Gemini API (`@google/genai`) is the AI backbone.
- **Personalization inputs**: MBTI personality type, mood at launch time, duration preference, transport mode, interest tags (art / outdoor / food / nightlife / family-friendly / photo spots / niche / budget), food preferences, and "how much do you want to think?" intensity level — all collected in `PreferenceOverlay` before route generation.
- **Gamified progression**: The route is structured as a sequence of tasks (`ExploreStep` state machine). Completing check-ins (photo/vlog capture) unlocks the next waypoint and awards real merchant coupons (¥金额+券名格式，如 ¥20餐饮代金券)。奖励只发优惠券/代金券，不发徽章/XP。
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
| **Vlog Agent** | Post-trip: 把今天的路线站点 + 选定风格交给 Gemini，产出 Vlog 脚本（标题/每站旁白字幕/BGM/分享文案/人格金句）。成片形态 = 真实地图路线回放 + 到站照片 Live2D 特写 + City Walk 战报卡。三种风格（赛博朋克 / 复古胶片 / 日系清新）已实现。详见 **Vlog 生成 — Implemented**。 |
| **Chat Agent** | 探索途中实时对话助手（`src/agents/chatAgent.ts`）。接收用户自然语言 + 当前路线 + 偏好 + 位置，返回回复文案 + 路线操作指令（`replace_next` 替换下一站 / `skip_current` 跳过当前站 / `add_stop` 末尾加站 / `none` 纯聊天）。候选 POI 从 `poiFilter` 实时过滤，确保推荐真实存在。详见 **探索体验 → 聊天改路线**。 |

**Preference self-learning loop**: After each trip, the Profiling Agent reads which waypoints the user actually visited, how long they stayed, and whether they triggered hidden tasks, then automatically adjusts weights in the user profile. This closes the feedback loop without requiring explicit ratings.

## Geolocation

`metadata.json` declares `requestFramePermissions: ["geolocation"]`. The intended use is LBS-based check-in validation: the system confirms the user is physically within range of a waypoint before allowing the check-in capture to proceed. The current frontend simulates this with the `CameraInterface` component. **Update:** a *simulated* proximity check is now implemented (距离取自拖动/点击得到的当前位置，30m 内才提示可打卡；见「探索体验 → 接近打卡」)。真实 `navigator.geolocation` 仍未接入。

## Planned / Not Yet Implemented

Features still not present in the current prototype:

- ~~Preference self-learning write-back~~ — 部分完成：`TripRecord` 持久化 + `buildHistorySummary` 已就绪但暂未接入 prompt��后续仔细调优）。
- **User-uploaded Vlog footage** — Vlog 画面目前用 3 张预生成占位 B-roll（见 **Vlog 生成 — Implemented**）；用户拍摄/上传真实片段的入口还没做。
- **Social sharing reward** — sharing a generated Vlog to an external platform grants in-app titles or bonus items（目前分享只复制文案到剪贴板，无奖励回写）。
- **Real GPS LBS** — the proximity check-in is currently *simulated* (see 探索体验 → 接近打卡); true `navigator.geolocation` is still not wired.

### 待办清单

已完成（✓）：
- ✓ 隐藏适配路线推荐系统（category cap + POI 多样化）
- ✓ POI 文本显示不全（TaskCard line-clamp-2 + 奖励分行）
- ✓ 开始探索栏位缩下去
- ✓ 地图缩放
- ✓ poi 调整（删洗衣 + 新增 20 个娱乐/景点/美食 POI）
- ✓ 隐藏任务优化（完成后不再瞬移回前一站）
- ✓ 首页删除日志按钮
- ✓ 故事页面删除拍摄设置按钮
- ✓ 携带装备清单没了
- ✓ 我的下侧栏位的小红点删掉
- ✓ function call 获取当天天气，天气加入今天想怎么走的图图
- ✓ 修改 MBTI
- ✓ 路线显示优化
- ✓ 奖励品类匹配（品类→奖励映射锚定 Gemini 输出）
- ✓ 导航线回头路修复（shortestPath 双端点选路）
- ✓ 别让我思考：隐藏下一站位置+奖励，正常探索：显示下一站位置
- ✓ 删除惊喜模式，增加同行人物选择（独自/情侣/朋友/亲子）
- ✓ 背包-优惠券-使用优惠券：点击弹出仿真 QR 二维码弹窗
- ✓ RewardOverlay 读取真实 hiddenTask 数据（名字/奖励/emoji），不再硬编码
- ✓ 隐藏任务奖励也必须与品类相关（prompt 约束加强）
- ✓ 偏好按钮白色背景、导航文案"xxx米后左转"格式
- ✓ 冷启动 onboarding 简化为单步 MBTI（去掉口味偏好步骤）
- ✓ 奖励统一为优惠券（¥金额格式），去掉徽章/XP
- ✓ 餐饮品类细分 9 类 + 非餐饮 9 类品类图（18 张，`public/categories/`）
- ✓ 背包成就徽章系统（连续打卡/隐藏任务/集券等 8 枚）
- ✓ TabBar 选中态改为白色背景填充

未完成：
- 自然语言 feedback / 文本框？
- 跳过/修改点只通过大语言模型
- 导航模式中有一个具体的方向和路线长度
- 能量系统？
- 请求摄像头

Done since original list was written (see **探索体验 — Implemented** / **Vlog 生成 — Implemented**):
- ~~Cold-start onboarding screen~~ — done (`OnboardingScreen.tsx` + `UserProfile` + `onboarding` screen).
- ~~Binary tree route UI~~ — done (`branch_choice` step + `BranchChoiceOverlay` + `RouteBranch`).
- ~~Multi-player collaborative routing~~ — scoped out for the hackathon.
- ~~Vlog auto-generation~~ — done（`vlogAgent.ts` 生成分镜脚本 + 可播放器，见下节）。
- ~~Vlog style selection~~ — done（赛博朋克 / 复古胶片 / 日系清新 三选一 `StylePickerOverlay`）。

## 地理数据层 — Implemented

### 区域定位

项目地点已从上海静安区改为**北京五道口**（海淀区高校聚集区，清华/北林/北语周边）。
BBOX：lat 39.980~40.005，lng 116.320~116.358，以五道口地铁站为中心。

### 路网数据（`scripts/data/street-network.json`）

因国内访问 OpenStreetMap Overpass API 不稳定，改用 Gemini 生成模拟路网。

```bash
npx tsx scripts/fetchStreetNetwork.ts   # 生成 scripts/data/street-network.json
```

输出 34 条路段（主路/次路/支路/步行街），总长约 28km。
覆盖成府路、中关村北大街、学院路、清华东路、双清路、王庄路等主要街道。已删除孤立街道"清华科技园内部路"。

### 地表数据（`scripts/data/terrain.json`）

校园 / 公园 / 水体 / 商业区多边形，渲染在地图路网下方做底色（仅供地图视觉，不参与 POI 落位）。

```bash
npx tsx scripts/generateTerrain.ts   # 生成 scripts/data/terrain.json
```

与路网/POI 不同，这里是**确定性脚本**而非 Gemini 生成：地块边界是真实地理事实（清华校园、清华荷塘等），LLM 重画会失真、自交。脚本内联 11 个手工核定区域（5 校园/3 公园/1 水体/2 商业区），带 BBOX 与退化校验。仅供地图底色，不影响 POI 落位。

### POI 数据（`src/data/pois.json`）

不接入实时第三方 API（高德需付费，大众点评/美团不对外开放，Google Maps 国内受限）。改用 Gemini 分批生成，结果 commit 进仓库，demo 完全离线。

```bash
# 完整生成流程（generateTerrain 只供地图底色，与 snap 互不依赖）：
npx tsx scripts/generatePOIs.ts          # 1. 生成 POI 内容（分3批，每批~38个，共~105个）
npx tsx scripts/generateTerrain.ts       # 2. 生成地表多边形 → scripts/data/terrain.json（地图底色用）
npx tsx scripts/snapPOIsToRoads.ts       # 3. 所有 POI 按路段长度加权吸附到路网（全部落在路上）
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

**生成策略**：Gemini 分 3 批（西北区/东北区/南部区）生成初始数据，限定每批坐标范围避免扎堆；后续人工审查 + 手工补充至 200 条，逐条校验 tags/mood_match/price_level 合理性。生成后 `snapPOIsToRoads.ts` 把所有 POI 按路段长度加权随机吸附到路网上，保证每个点都在路上、可达可打卡。

**POI 类型覆盖**（31 种，200 个）：咖啡厅(20)、奶茶甜品(13)、文创小店(12)、餐厅-日韩料理(12)、餐厅-北京风味(10)、书店(9)、餐厅(9)、景点/地标(9)、公园绿地(7)、夜宵烧烤(6)、餐厅-素食轻食(6)、共享空间/自习室(6)、宠物友好咖啡(6)、运动娱乐(6)、酒吧(5)、美术馆(5)、健身/瑜伽(5)、花店(5)、酒吧清吧(5)、livehouse(5)、餐厅-火锅(5)、餐厅-小吃(5)、桌游/密室(5)、餐厅-东北菜(4)、夜店(3)、KTV(3)、电影院(3)、美食城(3)、台球/棋牌(3)、电竞/网咖(3)、美食街(2)。洗衣/便利店已删除（低探索价值）。

**数据质量管控**（人工审查 + 脚本校验）：

- **tags 语义审查**：7 种合法 tag（`art` 文艺 / `outdoor` 户外 / `food` 美食 / `busy` 热闹 / `photo` 拍照 / `niche` 小众 / `budget` 省钱），逐条检查 tag 与实际场所是否匹配。已修正的典型问题：室内场所（健身房/VR馆/保龄球/汗蒸房等 9 个）错标 `outdoor`；连锁咖啡（星巴克/瑞幸/Tims/Peet's）错标 `art`；自习室错标 `photo`/`busy`。
- **mood_match 闭集约束**：只允许 6 种用户可选心情（`happy`/`tired`/`bored`/`relax`/`explore`/`hungry`），清理了 34 个 POI 中混入的非法值（budget/photo/art/busy/study——这些是 tag 不是 mood）。
- **price_level 一致性**：公园绿地从 0 修正为 1（price_level 定义为 1-4 档），跳蚤市场等 price_level=1 的补上 `budget` tag。
- **标签丰富度**：单标签 POI 从 15 个减至 7 个（仅健身房/运动场馆只标 `busy`，合理），补充了 15 个餐厅/娱乐场所的第二标签。
- **品类均衡**：补充了东北菜(1→4)、小吃(1→5)、火锅(2→5)、台球棋牌(1→3)、电竞网咖(1→3) 等原本偏少的品类，每种至少 2 个确保候选池有选择空间。

**统计概览**：
- Tag 分布：photo 92 / niche 83 / budget 75 / busy 75 / food 75 / art 52 / outdoor 16
- Mood 覆盖：explore 94 / relax 91 / happy 85 / hungry 63 / bored 34 / tired 32
- Price 分布：¥1 档 68 个 / ¥2 档 105 个 / ¥3 档 25 个 / ¥4 档 2 个
- Rating：3.9~4.8（均值 4.38）
- 停留时间：10~180 分钟（均值 65 分钟）
- 人流：low 56 / medium 91 / high 53

### 品类图片（`public/categories/`，`src/lib/categoryImages.ts`）

18 张品类图，分两组：

**餐饮 9 大品类**：`local-cuisine`（地方菜系）、`hotpot`（火锅）、`bbq`（烧烤烤肉）、`world-cuisine`（异国料理）、`buffet`（自助餐）、`seafood`（鱼鲜海鲜）、`snack`（小吃快餐）、`drinks`（饮品店）、`dessert`（面包蛋糕甜品）

**非餐饮 9 类**：`coffee`（咖啡/自习室）、`bar`（酒吧/livehouse/夜店）、`bookstore`（书店）、`art`（文创/美术馆/花店）、`park`（公园/景点）、`fitness`（健身/运动）、`entertainment`（电影/KTV/桌游/密室）、`bike`（骑行券）、`taxi`（打车券）

`categoryImages.ts` 的 `getCategoryImage(category)` 把 POI category 映射到对应图片路径，用于背包优惠券卡片和隐藏任务图片。

### 路由逻辑 — Implemented（含 ReAct 审查）

`routeAgent.ts` + `poiFilter.ts` + `routeReviewer.ts` 实现的工作流：

```
1. poiFilter.filterCandidates：按偏好标签/营业时间/排队时长过滤，渐进降级，每个 base category 最多 2 个（category cap），取 top 15
2. routeAgent.buildPrompt → Gemini call 1：从候选里选点 + 排序 + 写故事/任务/奖励
3. routeReviewer.reviewRoute → Gemini call 2（ReAct 审查）：
   - 品类多样性（连续同类型？整体太集中？）
   - 活动节奏（饭后紧接剧烈运动？）
   - 时间合理性（上午排酒吧？深夜排美术馆？）
   - 体验递进（节奏是否单调？）
   - 综合常识（连逛三家小卖铺？全程都在吃？）
4. 审查未通过 → routeAgent.buildPrompt(revisionNote) → Gemini call 3：带着"⚠️ 上一版路线有以下问题"重新生成
5. parseAndHydrate：解析 JSON + 用 POI 真实坐标填充 Waypoint
```

**ReAct 模式**（Reason + Act）：生成→审查→修正，最多 1 轮修正。正常路线 2 次 Gemini 调用（~4-6s），需修正时 3 次（~6-10s）。控制台打印 `🔄 ReAct` 或 `✅ 路线审查通过`。

过滤在 `poiFilter.filterCandidates`（strict→no_wait→no_tags→all 渐进降级，有单测）。排序后每个 `getBaseCategory` 最多保留 2 个进 top 10（category cap），确保候选池至少 5 种不同品类，防止"两个奶茶一个便利店"现象。`poiFilter` 还导出 `getActivityType(category)` 和 `getBaseCategory(category)` 活动类型映射（eating/drinking/browsing/sitting/outdoor/service/entertainment）。

## AI Route Generation — Implemented

### Files involved

| File | Role |
|---|---|
| `src/agents/routeAgent.ts` | ReAct 路线生成：`buildPrompt` 构建 prompt，`parseAndHydrate` 解析，`generateRoute` 编排循环。 |
| `src/agents/routeReviewer.ts` | ReAct 审查 agent：`reviewRoute` 调 Gemini 检查品类/节奏/时间/常识，返回 `{passed, issues}`。 |
| `src/agents/chatAgent.ts` | 探索中对话助手，接收用户消息 + 当前路线上下文，返回回复 + 路线操作指令。 |
| `src/agents/poiFilter.ts` | 候选过滤 + 评分 + 活动类型映射（`getActivityType`/`getBaseCategory`）。 |
| `src/types.ts` | 共享接口：`UserPreferences`、`Waypoint`、`GeneratedRoute`、`TripRecord` 等。 |
| `src/App.tsx` | 持有路线/偏好/waypointIndex 等全局 state，编排探索流程 + ReAct 调用。 |
| `src/screens/ExploreScreen.tsx` | 消费 `generatedRoute` + `waypointIndex`，驱动动态循环探索。 |

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

ExploreScreen（地图界面，动态循环）
  └── TaskCard     使用 waypoints[waypointIndex].name / task / description / reward
      · waypointIndex=0: initial / checkin_initial → hidden → branch → advance
      · waypointIndex=1..N: next_objective / checkin_next → advance 或 achievement_unlock
      · TaskCard 显示"第 N/M 站"，不再硬编码"首站"/"终点"
```

### 容错设计

所有 waypoint 字段读取均使用 `??` 降级（如 `wp0?.name ?? "前往第一站"`），保证 API 出错或超时时 UI 不崩溃，回退到原始硬编码文案。

### Gemini 调用规范

- 模型：`gemini-2.5-flash-lite`（`gemini-2.5-flash` 在国内高峰期频繁 503，lite 版稳定性更好）
- 要求 Gemini **只返回 JSON**，用正则 `/\{[\s\S]*\}/` 或 `/\[[\s\S]*\]/` 从响应文本中提取，防止 Gemini 在 JSON 前后多说话导致解析失败。
- **Vertex AI 代理**：前端 agent 不直接调 SDK，统一通过 `src/lib/gemini.ts` 的 `generateContent(model, prompt)` → `POST /api/generate`。Vite 插件 `vite-plugin-gemini-proxy.ts` 在 dev server 的 Node.js 层读 `GOOGLE_APPLICATION_CREDENTIALS`（服务账号 JSON）调 Vertex AI，自动从凭据文件提取 `project_id`。无凭据时回退到 `GEMINI_API_KEY`（AI Studio）。
- 脚本层通过 `$env:GOOGLE_APPLICATION_CREDENTIALS="..."; npx tsx scripts/xxx.ts` 传入。
- **奖励品类锚定**：`buildCandidateBlock` 给每个候选 POI 附 `推荐奖励` 字段（由 `CATEGORY_REWARDS` 品类→奖励映射表推导，含具体金额如 `¥15饮品抵扣券`），prompt 要求奖励格式为"¥金额+券名"，只发优惠券/代金券，不发徽章。Gemini 仍自由编写文案，但有品类锚点和金额参考（如咖啡厅→¥15饮品抵扣券，书店→¥20购书折扣券）。

### 天气 API

Vite 插件同时提供 `/api/weather` 端点，调 `wttr.in` 获取五道口实时天气（温度/体感/天气描述/湿度/风速），英文→中文映射，失败时回退默认值。`src/lib/useWeather.ts` 提供 `useWeather()` hook + `weatherEmoji()` / `weatherAdvice()` 辅助函数。天气卡背景使用本地图片（`public/weather/{sunny,cloudy,rainy,snowy,foggy}.jpg`）按天气代码映射。

### 隐藏任务生成

隐藏任务不再由 Gemini 独立生成，而是从主路线的 selections 中取最后一个 `pop()` 出来。Gemini 一次调用生成 N+1 个站点（多 1 个用于隐藏任务），最后一个的奖励要求更好、任务更有挑战。这保证隐藏任务与主线品类不冲突、坐标真实。

**隐藏任务位置连续性**：完成隐藏任务（`reward_hidden`）后推进到下一步时，`overridePosition` 设为隐藏任务坐标（而非清空），避免 avatar 从隐藏任务位置瞬移回主线前一站。`derivePosition.ts` 的 `branch_choice` 步骤同理——有隐藏任务时用隐藏任务坐标作为当前位置。

### 路线审查 ReAct

`routeAgent.ts` 内置 ReAct 循环：生成路线 → `routeReviewer.ts` 审查（品类多样性/活动节奏/时间合理性/体验递进）→ 未通过则带审查意见重新生成（最多 1 轮修正）。

### 历史记录影响路线

`generateRoute` 接收 `tripHistory: TripRecord[]`，`buildHistorySummary` 提取最近 5 次记录（去过/跳过的地点、反馈倾向、岔路偏好、聊天调整次数），注入 prompt 避免重复推荐。

### 导航系统

- **实时导航线**：`Map.tsx` 用 Dijkstra 从 avatar 到当前目标沿路网寻路，渲染紫色虚线 + 方向箭头。`shortestPath` 寻路时会尝试所在路段的两个端点节点，选总距离更短的入口，避免导航线从 avatar 身后出发（回头路问题）
- **方向指示**：`DirectionPanel` 显示旋转箭头图标（实时指向目标）+ 距离 + ETA，不用文字方向
- **Heading tracking**：`ExploreScreen` 追踪用户行走方向（>2m 阈值），箭头角度 = 行走方向到目标的相对夹角
- **动态 waypointIndex**：Map 和 ExploreScreen 都使用 `waypointIndex` prop，支持任意数量站点的导航
- **缩放**：鼠标滚轮缩放地图，无按钮

### 装备确认流程

偏好确认后进入 `gear_confirmation` 步骤，`GearConfirmationOverlay` 让用户确认携带装备（手机/充电宝/雨伞/身份证），确认后保存到 `localStorage.confirmedGear`，背包页装备 tab 读取显示。

### 设置页 MBTI 修改

`SettingsScreen` 新增 MBTI 人格行，点击弹出 `MbtiPickerOverlay`（16 种 MBTI 4×4 网格），选中即保存到 `localStorage.userProfile`。

## Vlog 生成 — Implemented

把 `StoryScreen` 里原本的"假进度条"做成了**真·AI 驱动的 Vlog 生成闭环**。Vlog 的形态最终定为 **「真实地图路线回放 + 到站照片 Live2D 特写 + City Walk 战报卡」**，而不是给图片加动效的幻灯片——因为后者对用户没价值（不会为"图片会动"花积分），而"我今天这趟走法"的个人化故事才值得生成/分享。纯前端、无后端。

### 拆解视频 = 便宜的部分各自生成

不调 Veo 这类按秒计费的视频模型（**per-user × per-second 成本 demo 扛不住**）。把"视频"解绑成各自便宜的部分：
- **镜头清单/叙事/里程**：路线 `waypoints` 直接当分镜表 + 沿街寻路算几何（免费，复用现成资产）。
- **旁白/字幕/标题/BGM/分享文案/人格金句**：一次文本补全（`gemini-2.5-flash-lite`）。
- **画面运动**：地图回放（小人沿街走、轨迹生长）+ 用户照片的 Live2D idle 呼吸，都是前端程序化动画（0 token）。
- **关键洞察**：「视频太贵」只适用于"每个用户每次都生成"。**3 张固定占位图是一次性资产**，故用 image-to-video 预渲染循环短片同理可行（本版未做，留作升级方向）。

### B-roll 占位图（`public/vlog/{coffee,park,bookstore}.jpg`）

仅 3 张 **demo 占位**，真实场景后续由**用户依次拍摄/上传**替换（已留好展示位）。用 `gemini-2.5-flash-image` 生成、`sharp` 压成 720×1280 JPEG（~100KB/张）。

```bash
$env:GEMINI_API_KEY="..."; npx tsx scripts/generateVlogFrames.ts   # 重新生成 3 张占位帧
```

`vlogAgent.assignFrames(stops)` 给所有站点**平衡分配**：先按站点名关键词命中（咖啡/酒→coffee、书/文创/展→bookstore、公园/绿/湖→park），剩下槽位填"用得最少"的图、并避开前后相邻帧——保证 3 张都尽量出场、不连续重复。`scene.frame` 由 agent 挂好。**接入用户上传后，直接替换 `scene.frame` 即可，回放/特写逻辑不用动**（scene[i] ↔ 站点 i 一一对应）。

### Vlog Agent（`src/agents/vlogAgent.ts`）

`generateVlog({ routeTitle, stops, style })` → `GeneratedVlog`（纯文本，一次调用）：
- 三种风格 `VlogStyle = "cyberpunk" | "retro" | "fresh"`，各自的 vibe/BGM 写进 prompt 影响旁白语气。
- 输出**按站点对齐**：每 stop 一个分镜（caption/narration/emoji/durationSec）；另出 title / bgm / shareCaption / **verdict（人格化金句，战报卡用）**。
- 兜底：缺字段用 stop 本身补；幻觉/解析失败/无 stop 时整体 `fallbackVlog` 确定性兜底（照 `routeAgent` 范式）。

### 路线几何（`src/lib/routeGeometry.ts`，纯函数 + 模块级路网图缓存）

`computeVlogGeo(route)` 从 `generatedRoute` 沿街寻路（复用 `roadGraph.shortestPath`）算出回放几何：
- `legs[]`（每段 ORIGIN/上一站→当前站的折线）、`fullPath`（拼接全程）、`stops[]`（坐标+emoji+name+reward）、`distanceKm`、`walkMin`。
- 站点 = `waypoints`（+ 隐藏任务作末站）。辅助：`polyLenM` / `pointAlong`（按长度插值取点）/ `partialPoly`（取已走子折线）。

### 地图回放（`src/components/RouteReplay.tsx`）

复用地图引擎（terrain 底色 + 真实路网 + `projectLatLng`/`computeViewBox`），框住整条路线、固定视野：
- rAF 驱动小人沿 `legs` 逐段走、轨迹按风格色生长、到站针"砰"地弹出；顶部 IG-stories 分段进度，走路时底部"前往 第N站"小条。
- `frozen` 时画静态全貌（战报卡缩略图用）。
- 到站停留（HOLD≈2.4s）经 `onStopChange(i)` 通知父组件切照片，离站走时回 `null`；全程结束 `onDone()`。
- **回调走 ref**（不进 effect deps），避免父组件切照片重渲染把动画 effect 重启。

### 到站照片 Live2D（`src/components/LivePhoto.tsx`）

一张"会呼吸"的用户照片特写：Live2D idle 运镜池（持续往返的微呼吸 scale + 微摇 x + 微浮 y + 极小 rotate，循环 easeInOut，幅度极小不露边）+ 每风格纹理层（赛博扫描线+霓虹光带 / 复古胶片噪点+暖色暗角 / 清新漏光）+ 通用暗角 + 字幕旁白 + "第 i 站 / N"角标。

### 数据类型（`src/types.ts`）

`VlogStyle`、`VlogScene{caption,narration,emoji,frame,durationSec}`、`VlogGeoStop`、`VlogGeo{fullPath,legs,stops,distanceKm,walkMin}`、`GeneratedVlog{id,title,style,scenes[],bgm,shareCaption,verdict,geo?,createdAt}`。

### UI 编排（`src/screens/StoryScreen.tsx`，状态在 `App.generatedVlogs` 跨 tab 存活）

```
点「生成今日 AI Vlog」
  → StylePickerOverlay（底部弹出，3 风格带渐变预览）
  → startGeneration(style)：有真实路线时 stops 取 waypoints(+隐藏任务)（与 geo 站点一一对应），否则退回示例素材
      → generateVlog(...)（真实 await）；有路线则 vlog.geo = computeVlogGeo(route)
      → VlogGenerationOverlay：进度条爬到 ~90% 等 Promise，ready 后冲 100%
  → VlogPlayerOverlay 两阶段：
      phase=replay：<RouteReplay>，onStopChange 到站盖上 <LivePhoto> 特写，onDone→card；右上「跳过/✕」恒在最上层
      phase=card：City Walk 战报卡（风格标签 + 标题 + verdict 金句 + 路线缩略图(frozen RouteReplay)
                  + 数据格子[里程/打卡点/奖励] + 分享文案 + 重看回放/分享）
  → onVlogGenerated(v) 存进 App.generatedVlogs
「历史记录」tab：本 session 真实生成的 Vlog（带风格徽章/BGM，可点击重播）叠在 3 条静态示例之上
```

容错：分享走 `navigator.clipboard`（失败也吞掉只提示）；无真实路线（示例日期）时跳过地图回放、直接出战报卡（数据格子退化为分镜数/时长/BGM）。

## 探索体验 — Implemented

把原型从"线性写死流程"做成了真实数据驱动、intensity 分档的可玩闭环。所有数据都来自当前 session（`generatedRoute` / `preferences` / `profile` / localStorage），**无后端**。

### 冷启动 onboarding（`src/screens/OnboardingScreen.tsx`）
首启仅收集 MBTI（单步，16 型四列网格），存 localStorage `userProfile`（`UserProfile`）。口味偏好步骤已移除。`App.tsx` 首启无 profile → `onboarding`，否则直接 `explore`。`routeAgent` 把长期画像（MBTI）与当下偏好分两块写进 prompt。

### 二叉树 A/B 抉择（`branch_choice` step）
第一站打卡后弹两个**气质相反**的候选第二站 + 一句抉择提示 `axis`，二选一。

| 件 | 角色 |
|---|---|
| `types.ts` → `RouteBranch { axis, options:[Waypoint,Waypoint] }` + `GeneratedRoute.branch?` | 数据模型 |
| `src/lib/branch.ts`（纯函数，有单测）| `wantsBranch(prefs,stops)` 门控、`commitBranchChoice(route,i)` 把选中项写回 `waypoints[1]`（不可变）、`pickContrastingPair` 兜底挑对比对 |
| `routeAgent.ts` | 分叉时 prompt 要 1 个第一站 + branch（2 候选 + axis）；幻觉/缺失时确定性兜底 |
| `ExploreScreen` → `BranchChoiceOverlay` | 抉择浮层；`App.handleBranchChoice` 写回后进 `next_objective`，下游照常读 `waypoints[1]`（无需改） |
| `Map` | `branch_choice` 时把 A/B 候选画在真坐标上 |

### 安排程度梯子（`intensity`，2 档）
偏好第 5 项「想被安排什么程度？」两档选择，标题旁 `?` hover 出 tooltip：

- **别让我思考**（`don't_think`，默认/推荐）：**隐藏下一站名字和奖励**（到达才揭晓）、无岔路、直线
- **正常探索**（`normal`）：显示下一站名字和奖励 + A/B 岔路

惊喜模式（`relaxed`）已删除。`mystery = preferences?.intensity === "don't_think"`（App 计算）下传给 `TaskCard` / `BranchChoiceOverlay` / `HiddenTaskAlert` 做名字+奖励遮罩；故事/任务/emoji/距离仍作预告，导航照常。

### 同行人（`companion`）
偏好选择第 3 项「有没有特别想要」下方新增同行人单选：独自(`solo`) / 情侣(`couple`) / 朋友(`friends`) / 亲子(`family`)。传入 `routeAgent` prompt 影响选址和文案语气（如情侣偏安静浪漫、朋友偏热闹社交）。`UserPreferences.companion` 字段。

### 接近打卡（模拟 LBS）
打卡按钮**不拦截**（路上随手可记录）；走到当前目标 `CHECKIN_RADIUS_M`(30m) 内时卡头亮「✓ 到了 · 可打卡」，否则显示「距目标 Nm」。目标按 step 自动切（`initial`→wp0 / `hidden_active`→hiddenTask / `next_objective`→wp1），用 `distanceMeters(currentPosition, target)` 判定。

### 隐藏任务真实化
`GeneratedRoute.hiddenTask?: Waypoint`——Gemini 在主路线之外额外选一个真实 POI（带故事/任务/奖励），幻觉时确定性兜底。`HiddenTaskAlert`/`TaskCard` 读它（删掉了写死的"转角咖啡店"）；`Map` 画隐藏针 + amber 导航虚线（隐藏阶段显示）。

### 聊天改路线（`src/agents/chatAgent.ts` + `src/components/ChatPanel.tsx`）

探索过程中（路线已生成且非拍照阶段），右下角浮现紫色气泡按钮 `ChatBubble`，点击弹出底部半屏 `ChatPanel`。用户用自然语言与"探索助手"对话，AI 可执行路线调整：

- **`replace_next`**：替换下一站为候选 POI。`App.applyAction` 修改 `generatedRoute.waypoints` 末项。
- **`skip_current`**：跳过当前站，直接推进 `exploreStep`（initial→hidden_found / next_objective→achievement_unlock）。
- **`add_stop`**：在路线末尾追加新站点。
- **`none`**：纯聊天，不改路线。

`chatAgent.chatWithRoute()` 调 Gemini，prompt 内注入当前路线上下文 + 附近未使用的候选 POI（最多 8 个，来自 `poiFilter`），确保推荐的地点真实存在。操作结果以系统消息 `{ role: "system" }` 插入聊天记录。状态（`chatMessages` / `chatLoading`）由 `App.tsx` 持有。

### 地图层（`src/components/Map.tsx` / `mapProjection.ts` / `src/lib/roadGraph.ts`）
SVG 地图：terrain 多边形底色（仅视觉）、真实路网底图、Dijkstra 沿街寻路（`roadGraph.ts`，有单测）、镜头跟随当前位置、**拖动/点击地图 → 吸附最近路 → 走过去**。所有 POI 都落在路上（保证可达可走）。`shortestPath` 头尾先 `snapToRoad` 到路面再寻路，避免路线穿越无路区域。退役了一批旧 mockup 的固定屏幕位置覆盖层（DottedPath / UnknownMarkers / 旧 NextTarget 等）。

### 历史记录 + 偏好自学习闭环 — Implemented

探索完成后持久化 `TripRecord` 到 `localStorage("tripHistory")`，记录用户行为信号 + 显性反馈。

**数据模型**（`src/types.ts` → `TripRecord`）：
```
id, date, waypoints[{name,emoji,lat,lng,visited,isHidden?,reaction?}],
branchChosen?, chatActions[], distanceKm, durationMin, rewards[],
intensity, preferences: UserPreferences, reaction?
```

**行为信号采集**（`App.tsx`，用 `useRef` 避免无效重渲染）：
- `tripStartTime` — 路线生成时记录
- `branchChosenRef` — A/B 选择时记录
- `chatActionLog` — 聊天改路线操作累积
- `hiddenTriggered` — 进入 `hidden_active` 时标记

**反馈收集**（`src/components/TripFeedbackOverlay.tsx`）：
探索完成后弹出极轻浮层"跟我吐槽一下"，一行 emoji（🤩😎😐😩💀💸），点一个即完成，5 秒自动消失。`reaction` 字段写入 TripRecord。

**历史页面补反馈**（StoryScreen 历史 tab）：
- 整条路线：右上角 `+ 评价` 按钮，展开 emoji 选择
- 单个站点：每站右侧 `+` 按钮，展开该站 emoji 选择（`waypoints[].reaction`）
- 选完立即写回 localStorage

**StoryScreen "历史记录" tab**（替换原假数据）：
`TripRecord` 卡片列表（`TripCard` 组件）——日期 + emoji 连珠（跳过的灰色）+ 统计行 + 奖励 tags + 反馈。

**MineScreen 统计真实化**：天数/公里/任务/礼券从 `tripHistory` 聚合（预埋样本保证首次非空）。

**足迹地图**（`MineScreen` → `FootprintMap`）：
- 从 `tripHistory` 读取 visited waypoints，用 `projectLatLng` 投影到真实坐标
- 🏠 固定在 ORIGIN（五道口地铁站），周围散布去过的站点 emoji
- "查看全貌"按钮展开全屏大地图
- 展开时有**迷雾效果**（SVG mask，去过的点挖洞透出，未探索区域被迷雾覆盖）
- 迷雾颜色适配明暗主题（CSS 变量 `--fog-color`）
- 底图渲染真实路网 + 地表色块（terrain），白天模式用浅色配色

**预埋样本**（`src/data/sampleTrips.ts`）：3 条真实 POI 构成的 TripRecord，首次启动自动写入。

**Vlog 持久化**：`generatedVlogs` 同步写入 `localStorage("vlogHistory")`，跨 session 可重播。

**routeAgent 历史注入**（已实现但暂未启用）：`buildHistorySummary(history)` 函数已就绪，从最近 5 条记录提取摘要注入 prompt。目前 `generateRoute` 调用不传 history，后续仔细调优后再接入。

**流程变更**：`achievement_unlock` → `AchievementOverlay.onContinue` → `showFeedback=true` → 反馈弹窗（提交/跳过）→ 存 TripRecord → 清 chatMessages → `setStep("intro")`。

### 主题系统 — 自动时间切换

主题初始化逻辑：优先读 `localStorage("appTheme")`；无存储时按系统时间自动选择（6:00~18:00 日间，其余夜间）。手动切换后存入 localStorage，后续不再自动判断。

### Vlog 路线回放 — 镜头跟随 + 动态站点

`RouteReplay.tsx` 回放时使用 `followBbox`（以 avatar 当前位置为中心，`FOLLOW_RADIUS_METERS`=500m 半径）作为 SVG viewBox，镜头跟着小人走。`frozen` 模式（战报卡缩略图）仍使用 `fullBbox` 显示全路线。

站点顺序按实际探索路径排列：`wp[0] → hiddenTask → wp[1] → wp[2] → ...`（`routeGeometry.computeVlogGeo` 和 `StoryScreen.genStops` 同步），支持任意数量 waypoints。`vlogAgent` 生成的 scenes 与 stops 1:1 对齐，`RouteReplay.onStopChange(i)` 映射到 `scenes[i]` 的 LivePhoto 特写。

### 其它屏幕接真实数据
- **StoryScreen 今日素材集** ← `generatedRoute` 站点（出发 + waypoints + 隐藏任务），过去日期回退示例
- **BagScreen 优惠券** ← 今日各站 `reward`（从 POI 店铺名 + ¥金额格式），demo 券也来自真实 POI 店铺；顶部"探索收获"统计替换为成就徽章系统（8 枚，连续打卡/隐藏任务/集券等）
- **MineScreen** ← profile 的 MBTI 徽章；**铃铛=「通知」**(session 动态事件)、**系统消息=「系统消息」**(常驻公告)，各自弹底部面板

> 测试：`src/lib/*` 与 `poiFilter` 的纯逻辑有 vitest 单测（`tests/`，`npm test`）。UI/屏幕不单测。

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
npx tsx scripts/snapPOIsToRoads.ts        # POI 吸附到路网（覆盖 pois.json）
npx tsx scripts/visualizeStreetNetwork.ts # 可视化地图 → scripts/data/street-network.html
npx tsx scripts/generateVlogFrames.ts     # 生成 Vlog 占位 B-roll → public/vlog/*.jpg（gemini-2.5-flash-image + sharp）
npx tsx scripts/generateCategoryImages.ts # 生成品类图 → public/categories/*.jpg（或手动切割九宫格图）
```

Tests live in `tests/` and run with `npm test` (vitest), covering the pure routing/geo logic（`poiFilter`、`roadGraph`、`mapProjection`、`derivePosition`）。

## Environment

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The app is designed to run on Google AI Studio, which injects this key at runtime.

## Architecture

**Screen routing** is handled entirely in `src/App.tsx` via a `screen: ScreenType` React state value — there is no router library. `onNavigate(screen)` callbacks are passed down to each screen component. The six screens are: `explore`, `story`, `bag`, `mine`, `event`, `settings`.

**App-level state** includes:
- `theme`（dark/light，持久化 localStorage，首次按时间自动选）
- `tripHistory: TripRecord[]`（持久化 localStorage，预埋样本）+ `showFeedback`
- `generatedVlogs: GeneratedVlog[]`（持久化 localStorage）
- `chatMessages` + `chatLoading`（聊天面板状态）
- `generatedRoute`（AI 路线）、`preferences`（偏好）、`exploreStep`（探索状态机）、`waypointIndex`（当前站点索引）
- 行为信号追踪用 `useRef`（`tripStartTime` / `branchChosenRef` / `chatActionLog` / `hiddenTriggered` / `pendingRecord`），不触发重渲染

`ExploreScreen` 接收 `waypointIndex` / `onAdvanceWaypoint` / `showFeedback` / `onAchievementContinue` / `onFeedbackReact` / `onFeedbackDismiss`。`StoryScreen` 接收 `tripHistory` / `onTripReaction` / `onWaypointReaction`。`MineScreen` 接收 `tripHistory`。

**ExploreScreen 动态循环状态机**: `step: ExploreStep` 由 `App.tsx` 持有。`waypointIndex` 控制当前站点，支持任意数量 waypoints（不再硬编码 2 站）。流程：
```
intro → preference_selection → gear_confirmation →
  waypointIndex=0: initial → checkin_initial →
    hidden_found → hidden_active → checkin_hidden → reward_hidden →
    branch_choice（如有）→ onAdvanceWaypoint（index+1）
  waypointIndex=1..N: next_objective → checkin_next → onAdvanceWaypoint
  最后一站 checkin 完 → achievement_unlock → 反馈 → intro
```
`onAdvanceWaypoint`：如果还有下一站则 `setWaypointIndex(+1)` + `setStep("next_objective")`，否则 `setStep("achievement_unlock")`。

位置由 `positionFromStep(step, route, origin, waypointIndex)` 推导：`initial`=origin，`next_objective`=上一站位置（不瞬移），`checkin_*`=当前站位置。

**Shared layout components** (`src/components/Layout.tsx`):
- `AppLayout` — outer shell that constrains width to 500px and renders a simulated iOS status bar. Every screen wraps its content in this.
- `Glass` — glassmorphism `motion.div` card used throughout for floating panels.

**Shared UI components** (`src/components/CommonUI.tsx`):
- `BottomNav` — four-tab nav bar rendered by every main screen (`explore`, `story`, `bag`, `mine`).
- `PageTitle`, `TabBar` — used in secondary screens.

**Types** (`src/types.ts`): 所有共享接口都在这里定义。
- UI 基础类型：`ScreenType`（含 `onboarding`）、`ExploreStep`（含 `branch_choice`）、`Coupon`、`TimelineItemData`
- 用户画像：`UserProfile`（冷启动收集的 MBTI / 兴趣，持久化到 localStorage `userProfile`）
- AI 路线类型：`UserPreferences`（偏好输入）、`Waypoint`（单个打卡点）、`RouteBranch`（第二站 A/B 抉择）、`GeneratedRoute`（含 `title`、`waypoints[]`、可选 `hiddenTask`、`branch`）
- 历史记录：`TripRecord`（探索完成后存档，含行为信号 + 反馈 + 站点级评价）
- POI 数据类型：`POI`（数据库记录，含评价语料、时间约束、偏好匹配字段）

**Gear persistence**: The gear checklist confirmed in `GearConfirmationOverlay` is saved to `localStorage` under the key `confirmedGear` (JSON array of string IDs). `BagScreen` reads this to populate the Equipment tab.

## Styling conventions

- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.*` file needed).
- **主题系统**：CSS 变量定义在 `src/index.css`，通过根元素 `data-theme="dark|light"` 切换。变量包括 `--bg-base`、`--bg-card`、`--bg-nav`、`--bg-input`、`--border-subtle`、`--text-primary`/`secondary`/`muted`/`faint`、`--fog-color`（足迹地图迷雾）。主题初始化按时间自动选（6:00~18:00 日间），手动切换后持久化。共享组件（`Glass`、`BottomNav`、`TabBar`、`PageTitle`）已迁移到 CSS 变量。
- Dark neon aesthetic（默认暗色）: primary background `#05060F` / `#0A0A1A`, accent purple `#6C5CFF` / `#A98BFF`, gold `#FFD166`, cyan `#00E5FF`, alert red `#FF4D64`. Light theme: background `#F5F5FA`, text `#1A1A2E`.
- Animations use `motion/react` (`framer-motion` v12). `AnimatePresence` wraps conditional renders. `layoutId` is used on nav glow and tab underline for shared-element transitions.
- Icons come exclusively from `lucide-react`.
- The `@` path alias resolves to the project root (configured in `vite.config.ts`).
