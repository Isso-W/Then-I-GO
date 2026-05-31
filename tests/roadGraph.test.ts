import { describe, it, expect } from "vitest";
import { buildGraph, shortestPath, routePolyline, nearestNode } from "../src/lib/roadGraph";
import type { Street } from "../src/lib/roadGraph";

// 一个简单的"十字路口"路网：两条直线在 (0, 0) 附近相交
//   南北路：(0, -0.01) → (0, 0) → (0, 0.01)
//   东西路：(-0.01, 0) → (0, 0) → (0.01, 0)
// 经纬度数字小一点，距离换算后大概在百米级
const cross: Street[] = [
  {
    name: "南北路",
    highway: "primary",
    points: [
      { lat: 39.99, lng: 116.34 },
      { lat: 39.992, lng: 116.34 },
      { lat: 39.994, lng: 116.34 },
    ],
  },
  {
    name: "东西路",
    highway: "primary",
    points: [
      { lat: 39.992, lng: 116.338 },
      { lat: 39.992, lng: 116.34 },
      { lat: 39.992, lng: 116.342 },
    ],
  },
];

describe("buildGraph", () => {
  it("合并重合端点为同一节点", () => {
    const g = buildGraph(cross);
    // 两条街共 6 个原始点，中心点合并 → 5 个节点
    expect(g.nodes.length).toBe(5);
  });

  it("十字路网应该完全连通（mainComponent 覆盖全部节点）", () => {
    const g = buildGraph(cross);
    expect(g.mainComponent.size).toBe(g.nodes.length);
  });

  it("断开的路网会被切分为多个分量，mainComponent 只含最大的那个", () => {
    const split: Street[] = [
      {
        name: "A 路",
        highway: "primary",
        points: [
          { lat: 39.99, lng: 116.34 },
          { lat: 39.991, lng: 116.34 },
          { lat: 39.992, lng: 116.34 },
        ],
      },
      {
        name: "B 路（远离 A）",
        highway: "primary",
        points: [
          { lat: 40.0, lng: 116.35 },
          { lat: 40.001, lng: 116.35 },
        ],
      },
    ];
    const g = buildGraph(split);
    expect(g.mainComponent.size).toBeLessThan(g.nodes.length);
    expect(g.mainComponent.size).toBe(3); // A 路 3 节点
  });
});

describe("shortestPath", () => {
  it("同一条路上的两点：路径直达", () => {
    const g = buildGraph(cross);
    const path = shortestPath(
      { lat: 39.99, lng: 116.34 },   // 南北路南端
      { lat: 39.994, lng: 116.34 },  // 南北路北端
      g
    );
    // 头尾是 snap 到路面后的坐标（可能有微小浮点偏移），不再是严格输入坐标
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path[0].lat).toBeCloseTo(39.99, 4);
    expect(path[0].lng).toBeCloseTo(116.34, 4);
    expect(path[path.length - 1].lat).toBeCloseTo(39.994, 4);
    expect(path[path.length - 1].lng).toBeCloseTo(116.34, 4);
  });

  it("拐弯：从南北路一端到东西路一端，路径会经过交叉口", () => {
    const g = buildGraph(cross);
    const path = shortestPath(
      { lat: 39.99, lng: 116.34 },    // 南北路南端
      { lat: 39.992, lng: 116.342 },  // 东西路东端
      g
    );
    // 至少需要 3 个点（起点、交叉口、终点）才能拐这一下
    expect(path.length).toBeGreaterThanOrEqual(3);
    // 中间必须包含交叉口附近的点（lat≈39.992, lng≈116.34）
    const passesIntersection = path.some(
      (p) => Math.abs(p.lat - 39.992) < 0.0005 && Math.abs(p.lng - 116.34) < 0.0005
    );
    expect(passesIntersection).toBe(true);
  });

  it("不连通时退回直线（fallback）", () => {
    const empty: Street[] = [];
    const g = buildGraph(empty);
    const path = shortestPath(
      { lat: 39.99, lng: 116.34 },
      { lat: 39.994, lng: 116.34 },
      g
    );
    expect(path).toEqual([
      { lat: 39.99, lng: 116.34 },
      { lat: 39.994, lng: 116.34 },
    ]);
  });
});

describe("routePolyline", () => {
  it("多 waypoint 串联，相邻段不重复衔接点", () => {
    const g = buildGraph(cross);
    const stops = [
      { lat: 39.99, lng: 116.34 },
      { lat: 39.992, lng: 116.34 },
      { lat: 39.992, lng: 116.342 },
    ];
    const poly = routePolyline(stops, g);
    // 头尾是 snap 后的坐标，与输入近似相等
    expect(poly[0].lat).toBeCloseTo(stops[0].lat, 4);
    expect(poly[0].lng).toBeCloseTo(stops[0].lng, 4);
    expect(poly[poly.length - 1].lat).toBeCloseTo(stops[stops.length - 1].lat, 4);
    expect(poly[poly.length - 1].lng).toBeCloseTo(stops[stops.length - 1].lng, 4);
    // 长度 ≥ stops 数（中间会有节点）
    expect(poly.length).toBeGreaterThanOrEqual(stops.length);
  });

  it("空 / 单点输入：原样返回", () => {
    const g = buildGraph(cross);
    expect(routePolyline([], g)).toEqual([]);
    expect(routePolyline([{ lat: 0, lng: 0 }], g)).toEqual([{ lat: 0, lng: 0 }]);
  });
});

describe("nearestNode", () => {
  it("返回 mainComponent 内距离最近的节点", () => {
    const g = buildGraph(cross);
    const id = nearestNode({ lat: 39.99, lng: 116.34 }, g);
    expect(id).not.toBeNull();
    const n = g.nodes[id!];
    expect(Math.abs(n.lat - 39.99)).toBeLessThan(0.0001);
  });
});
