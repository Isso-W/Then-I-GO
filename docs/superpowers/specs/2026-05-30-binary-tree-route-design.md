# 二叉树 A/B 路线抉择 — 设计

**日期**: 2026-05-30
**状态**: 设计已定，待实现
**范围**: 在现有 React 原型上，给探索流程加入一次 A/B 路线抉择。前端 + routeAgent，无后端。

## 1. 这是什么 / 为什么

现在路线是一条定死的线（第一站 → 第二站）。本功能在走到第二站之前，弹出**两个气质明显不同的候选地点让用户二选一**（例如「安静书店」vs「热闹咖啡」），选哪个就去哪个，没选的消失。把「被 AI 带路」变成「自己探险」，是项目的招牌差异点（CLAUDE.md 里 Routing Agent 的「二叉树决策节点」）。

## 2. 已定决策

| 维度 | 决策 |
|---|---|
| 分叉数量 | **单点分叉**（一趟只一次 A/B） |
| 位置 | **第二站**：第一站打卡 +（隐藏任务流程）之后，不再是预定第二站，而是弹 A/B |
| 没选的分支 | **直接丢弃**，不复现 |
| 两个选项怎么拉开差异 | **Gemini 挑两个气质相反的点，并给这次抉择起一句标题 `axis`**（如「想安静还是想热闹？」） |
| 门控 | `intensity === "别让我思考"` 或不足 2 站 → **不分叉**，纯线性（尊重「别让我选」的人，呼应产品名「那我走」） |

## 3. 数据模型（`types.ts`）

```ts
export interface RouteBranch {
  axis: string;                   // 抉择提示，如 "想安静还是想热闹？"
  options: [Waypoint, Waypoint];  // 恰好两个候选第二站，气质相反
}

export interface GeneratedRoute {
  // ...现有 title / waypoints / hiddenTask / unknownPOIs
  branch?: RouteBranch;           // 可选：第二站的 A/B 分叉
}
```

## 4. 状态机（`ExploreStep` + `App`）

- `ExploreStep` 增加 `"branch_choice"`。
- 当前唯一通向 `next_objective` 的转移在 `RewardOverlay.onContinue`（ExploreScreen）。改为：
  `route.branch` 存在 → `branch_choice`；否则 → `next_objective`（保留无分叉时的老行为）。
- 用户在 `branch_choice` 选 index → `App.handleBranchChoice(index)`：把 `branch.options[index]` **写回 `waypoints[1]`**（不可变更新），再 `setExploreStep("next_objective")`。
- **关键**：选中项写回 `waypoints[1]` 后，下游 `NextTarget`/`TaskCard`/`positionFromStep` 全读 `waypoints[1]`，一行不用改 —— 分叉解析完重新汇入既有线性主线。

## 5. routeAgent（`routeAgent.ts`）

- 门控：`const wantsBranch = prefs.intensity !== "don't_think" && actualCount >= 2;`
- `wantsBranch` 时：prompt 要 Gemini 返回 **1 个第一站 selection** + 一个 `branch`（2 个气质相反的候选 + `axis`）+ 现有 `hidden`。三者 poi_id 互不相同。
  - 返回结构：`{ title, selections:[1], branch:{axis, options:[A,B]}, hidden:{...} }`
  - 解析：`selections[0]` → `waypoints[0]`；`branch.options[0/1]` 各 `hydrate` 成 Waypoint。
- 非 `wantsBranch`：沿用现有多站线性生成（不带 branch）。
- 兜底：Gemini 没给出合法 branch（幻觉/缺失/与已用重复）→ 从剩余候选里确定性挑 2 个在 `crowd_level`(low vs high) 或 `category` 上相反的点 + 通用 `axis`；凑不齐 → 不带 branch 返回（线性）。
- 与已有 `hiddenTask` / `unknownPOIs` 选点共用 `usedIds`，避免同一 POI 重复出现在主线/分叉/隐藏/未知标记里。

## 6. UI

- 新组件 `BranchChoiceOverlay`（仿 `HiddenTaskAlert`/`RewardOverlay`：Glass 卡 + motion + 霓虹风）：顶部 `axis`，下面两张卡（各 option 的 emoji/name/description/distanceText），点一张 → `onPick(index)`。
- `step === "branch_choice"` 时渲染该浮层，并**隐藏底部常规 TaskCard**（它读的 `waypoints[1]` 此刻还没写回）。
- `Map`：`branch_choice` 时把 `branch.options` 两个候选画成 A/B 候选标记（真坐标，沿用已加的 step-gated 标记机制）；选完即消失，`waypoints[1]` 正常渲染。

## 7. 位置推导（`derivePosition.ts`）

把 `"branch_choice"` 加进 `AT_OR_PAST_WP0` 集合（抉择时用户站在第一站 wp[0]）。一行。

## 8. 容错

- `route.branch` 不存在 → 永不进 `branch_choice`（RewardOverlay 照常 → next_objective）。30min 单站 / 别让我思考 → 无分叉。
- `BranchChoiceOverlay` 内 `if (!branch) return null`；`handleBranchChoice` 内 `if (!r?.branch) return r`。
- 选中项写回 `waypoints[1]`、无独立 chosenIndex state → 重新生成路线时无残留。

## 9. 测试（vitest，`tests/`）

抽成纯函数再测（不测 UI）：
1. `wantsBranch(prefs)` — 别让我思考→false；其余且 ≥2 站→true。
2. `commitBranchChoice(route, index)` — 把 `options[index]` 写进 `waypoints[1]`，返回新对象（不可变）。
3. `pickContrastingPair(candidates, excludeIds)` 兜底选点 — 给一组 crowd_level 不同的候选返回对比的两个；不足→null。
4. 扩 `derivePosition` 测试：`branch_choice` → `waypoints[0]`。

## 10. 验收

**路径 A（分叉出现）**：偏好选「正常探索/轻松带路」+ 时长 ≥1h → 第一站打卡后弹抉择浮层（两项气质对比明显）→ 地图显示两个候选标记 → 点一张 → 第二站变成所选项、小人朝它走 → 第二站打卡 → 成就。
**路径 B（门控）**：偏好选「别让我思考」→ 不弹抉择，直接线性。
**路径 C（兜底）**：断网 / 30min 单站 → 不崩、走线性，不卡在分叉。
**代码层**：`npm run lint` 0 错、`npm test` 全过、`npm run build` 退出 0。

## 11. 实现顺序

types → routeAgent（门控+生成+兜底）→ commitBranchChoice/wantsBranch 纯函数+测试 → derivePosition + 测试 → App（state 接线）→ BranchChoiceOverlay + ExploreScreen 接线 → Map A/B 标记 → 验收。
