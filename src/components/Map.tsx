import { useMemo, useRef, useState, useEffect, type MouseEvent } from "react";
import { motion } from "motion/react";
import streetNetwork from "../../scripts/data/street-network.json";
import terrainRaw from "../../scripts/data/terrain.json";
import {
  projectLatLng,
  unprojectXY,
  bboxSizeMeters,
  defaultViewBox,
  FOLLOW_RADIUS_METERS,
  ORIGIN,
  type LatLng,
  type BBox,
} from "./mapProjection";
import { buildGraph, routePolyline, snapToRoad, type Street } from "../lib/roadGraph";
import type { GeneratedRoute, ExploreStep } from "../types";

const network = streetNetwork as { streets: Street[]; bbox: BBox };

// 路网图只构建一次（modules 顶层，模块缓存即可，无需 React state）
const ROAD_GRAPH = buildGraph(network.streets);

// 地表多边形 —— 校园 / 公园 / 水体 / 商业区
interface TerrainPolygon {
  name: string;
  type: "campus" | "park" | "water" | "commercial";
  points: LatLng[];
}
const terrain = terrainRaw as { polygons: TerrainPolygon[] };
const TERRAIN_STYLE: Record<TerrainPolygon["type"], { fill: string; opacity: number }> = {
  campus: { fill: "#1F1B47", opacity: 0.55 },
  park: { fill: "#0F3A24", opacity: 0.55 },
  water: { fill: "#0E3B47", opacity: 0.7 },
  commercial: { fill: "#3D3013", opacity: 0.45 },
};

// 不同等级道路的渲染样式（stroke 用 non-scaling-stroke，单位 = CSS px）
const HIGHWAY_STYLE: Record<string, { stroke: string; width: number; dash?: string }> = {
  primary: { stroke: "#6C5CFF", width: 2.5 },
  secondary: { stroke: "#4B40A8", width: 2 },
  tertiary: { stroke: "#3A327D", width: 1.5 },
  residential: { stroke: "#2A2358", width: 1.2 },
  service: { stroke: "#2A2358", width: 1 },
  footway: { stroke: "#3F368B", width: 1, dash: "3 3" },
  pedestrian: { stroke: "#3F368B", width: 1.2, dash: "4 3" },
};
const DEFAULT_STYLE = { stroke: "#2A2358", width: 1 };

// 用一组 LatLng 生成 SVG path 字符串
function pointsToPath(points: LatLng[], bbox: BBox): string {
  if (points.length === 0) return "";
  const head = projectLatLng(points[0], bbox);
  let d = `M ${head.x.toFixed(2)} ${head.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const p = projectLatLng(points[i], bbox);
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

// 多边形 → SVG polygon 的 points 属性字符串
function polygonPointsAttr(points: LatLng[], bbox: BBox): string {
  return points
    .map((p) => {
      const xy = projectLatLng(p, bbox);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(" ");
}

// 容器宽度 ≈ 500px。marker 用这个 scale 来抵消 viewBox 缩放，保证在屏上大小恒定
const REFERENCE_WIDTH_PX = 500;

export function Map({
  route,
  currentPosition = ORIGIN,
  onUserDrag,
  step,
}: {
  route: GeneratedRoute | null;
  currentPosition?: LatLng;
  /** 用户拖动红点（测试用模拟走路）。回调收到的坐标已经吸附到路上。 */
  onUserDrag?: (p: LatLng) => void;
  /** 当前探索阶段，用来决定隐藏任务针 / "?"标记的显隐 */
  step?: ExploreStep;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // 拖动期间设为 true，用来在随后的 click 事件里识别"这是拖动结尾，不是点击"
  const dragMovedRef = useRef(false);

  // 跟随模式：视野始终以"显示位置"为中心，固定半径。
  // - 拖动时 displayPosition 1:1 跟随 currentPosition（跟手不延迟）
  // - 否则用指数平滑（每帧靠近 20%），让 check-in 这种瞬移变成 ~200ms 平滑平移
  const [displayPosition, setDisplayPosition] = useState<LatLng>(currentPosition);

  useEffect(() => {
    if (isDragging) {
      setDisplayPosition(currentPosition);
      return;
    }
    let raf = 0;
    const step = () => {
      setDisplayPosition((prev) => {
        const dy = currentPosition.lat - prev.lat;
        const dx = currentPosition.lng - prev.lng;
        const dyM = dy * 111_320;
        const dxM = dx * 111_320 * Math.cos((currentPosition.lat * Math.PI) / 180);
        if (Math.hypot(dxM, dyM) < 0.5) {
          return currentPosition; // 收敛，结束循环
        }
        raf = requestAnimationFrame(step);
        return {
          lat: prev.lat + dy * 0.2,
          lng: prev.lng + dx * 0.2,
        };
      });
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [currentPosition, isDragging]);

  const viewBox = useMemo(
    () => defaultViewBox(displayPosition, FOLLOW_RADIUS_METERS),
    [displayPosition]
  );

  const { width, height } = useMemo(() => bboxSizeMeters(viewBox), [viewBox]);
  const markerScale = width / REFERENCE_WIDTH_PX;

  const streetPaths = useMemo(() => {
    return network.streets.map((s, idx) => ({
      key: `${idx}-${s.name}`,
      d: pointsToPath(s.points, viewBox),
      style: HIGHWAY_STYLE[s.highway] ?? DEFAULT_STYLE,
    }));
  }, [viewBox]);

  const terrainShapes = useMemo(() => {
    return terrain.polygons.map((poly, idx) => ({
      key: `terrain-${idx}-${poly.name}`,
      pts: polygonPointsAttr(poly.points, viewBox),
      style: TERRAIN_STYLE[poly.type],
    }));
  }, [viewBox]);

  // 路线 polyline：用路网图寻路得到沿街折线，起点固定 ORIGIN
  const routeData = useMemo(() => {
    if (!route || route.waypoints.length === 0) return null;
    const waypointCoords = route.waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
    const routedPoly = routePolyline([ORIGIN, ...waypointCoords], ROAD_GRAPH);
    return {
      path: pointsToPath(routedPoly, viewBox),
      waypoints: route.waypoints.map((wp) => ({
        ...wp,
        pos: projectLatLng({ lat: wp.lat, lng: wp.lng }, viewBox),
      })),
    };
  }, [route, viewBox]);

  // 隐藏任务导航线：从第一站（或起点）沿街走到隐藏点（仅隐藏阶段显示）
  const hiddenRouteData = useMemo(() => {
    if (!route?.hiddenTask) return null;
    const start = route.waypoints[0] ?? ORIGIN;
    const poly = routePolyline(
      [
        { lat: start.lat, lng: start.lng },
        { lat: route.hiddenTask.lat, lng: route.hiddenTask.lng },
      ],
      ROAD_GRAPH
    );
    return pointsToPath(poly, viewBox);
  }, [route, viewBox]);

  // 隐藏任务针：真坐标投影，跟随地图平移
  const hiddenMark = useMemo(
    () =>
      route?.hiddenTask
        ? {
            ...projectLatLng({ lat: route.hiddenTask.lat, lng: route.hiddenTask.lng }, viewBox),
            emoji: route.hiddenTask.emoji,
          }
        : null,
    [route, viewBox]
  );
  const showHidden =
    step === "hidden_found" ||
    step === "hidden_active" ||
    step === "checkin_hidden" ||
    step === "reward_hidden";

  // A/B 分叉候选标记：branch_choice 时把两个候选画在真坐标上
  const branchMarks = useMemo(
    () =>
      (route?.branch?.options ?? []).map((wp, i) => ({
        key: i,
        label: i === 0 ? "A" : "B",
        ...projectLatLng({ lat: wp.lat, lng: wp.lng }, viewBox),
      })),
    [route, viewBox]
  );
  const showBranch = step === "branch_choice";

  const currentPos = projectLatLng(currentPosition, viewBox);

  // 客户端像素 → SVG 用户坐标系（米）→ 经纬度
  // 用 getScreenCTM 自动处理 viewBox / preserveAspectRatio 缩放
  function clientToLatLng(clientX: number, clientY: number): LatLng | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return unprojectXY({ x: local.x, y: local.y }, viewBox);
  }

  // 全局 pointermove/up 监听只在拖动期间挂上，避免在普通状态消耗事件
  useEffect(() => {
    if (!isDragging || !onUserDrag) return;
    const onMove = (e: PointerEvent) => {
      dragMovedRef.current = true;
      const ll = clientToLatLng(e.clientX, e.clientY);
      if (!ll) return;
      onUserDrag(snapToRoad(ll, ROAD_GRAPH));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // viewBox 变化时也要重绑，让 clientToLatLng 用最新投影
  }, [isDragging, onUserDrag, viewBox]);

  // 点击地图任意位置 → snap 到最近的路 → 瞬移过去（viewBox 平滑跟过去）
  // 拖动结尾的 pointerup 会带出一个 click，用 dragMovedRef 屏蔽
  const handleMapClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onUserDrag) return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const ll = clientToLatLng(e.clientX, e.clientY);
    if (!ll) return;
    onUserDrag(snapToRoad(ll, ROAD_GRAPH));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      style={{ cursor: onUserDrag ? "pointer" : "default" }}
      onClick={handleMapClick}
    >
      {/* 地表色块（校园/公园/水体/商业区）—— 在路网下方 */}
      <g>
        {terrainShapes.map((t) => (
          <polygon
            key={t.key}
            points={t.pts}
            fill={t.style.fill}
            opacity={t.style.opacity}
            stroke="none"
          />
        ))}
      </g>

      {/* 路网底图 */}
      <g opacity={0.65}>
        {streetPaths.map((s) => (
          <path
            key={s.key}
            d={s.d}
            fill="none"
            stroke={s.style.stroke}
            strokeWidth={s.style.width}
            strokeDasharray={s.style.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* 当前路线高亮 */}
      {routeData && (
        <g>
          {/* 外发光 */}
          <path
            d={routeData.path}
            fill="none"
            stroke="#A98BFF"
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
            vectorEffect="non-scaling-stroke"
          />
          {/* 主线（虚线表示路径） */}
          <path
            d={routeData.path}
            fill="none"
            stroke="#A98BFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8 5"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}

      {/* 隐藏任务导航线（amber 虚线，仅隐藏阶段显示） */}
      {showHidden && hiddenRouteData && (
        <path
          d={hiddenRouteData}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 6"
          opacity={0.85}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Waypoint markers — 用 scale 保持屏上大小恒定 */}
      {routeData?.waypoints.map((wp, i) => (
        <g
          key={i}
          transform={`translate(${wp.pos.x}, ${wp.pos.y}) scale(${markerScale})`}
        >
          <circle r={26} fill="#A98BFF" opacity={0.2} />
          <circle r={18} fill="#6C5CFF" stroke="#FFFFFF" strokeWidth={2} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={20}
          >
            {wp.emoji}
          </text>
          {/* 序号小徽章 */}
          <g transform="translate(14, -14)">
            <circle r={8} fill="#FFD166" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontWeight={800}
              fill="#0A0A1A"
            >
              {i + 1}
            </text>
          </g>
        </g>
      ))}

      {/* 隐藏任务针（真坐标） */}
      {showHidden && hiddenMark && (
        <g transform={`translate(${hiddenMark.x}, ${hiddenMark.y}) scale(${markerScale})`}>
          <circle r={24} fill="#F59E0B" opacity={0.2} />
          <circle r={16} fill="#D97706" stroke="#FCD34D" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={18}>
            {hiddenMark.emoji}
          </text>
        </g>
      )}

      {/* A/B 分叉候选标记（branch_choice 时显示） */}
      {showBranch &&
        branchMarks.map((m) => (
          <g key={`branch-${m.key}`} transform={`translate(${m.x}, ${m.y}) scale(${markerScale})`}>
            <circle r={24} fill="#6C5CFF" opacity={0.2} />
            <circle r={17} fill="#5B3BFF" stroke="#A98BFF" strokeWidth={2} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={16}
              fontWeight={800}
              fill="#FFFFFF"
            >
              {m.label}
            </text>
          </g>
        ))}

      {/* 当前位置：红色脉冲点。
        - 普通状态：spring 跟随 currentPos（check-in 切站时平滑）
        - 拖动中：直接置位、关掉 spring，跟手不延迟
        - 可拖拽（cursor: grab/grabbing）
      */}
      <motion.g
        initial={false}
        animate={{ x: currentPos.x, y: currentPos.y }}
        transition={
          isDragging
            ? { duration: 0 }
            : { type: "spring", damping: 18, stiffness: 90, mass: 0.8 }
        }
        style={{ cursor: onUserDrag ? (isDragging ? "grabbing" : "grab") : "default" }}
        onPointerDown={(e) => {
          if (!onUserDrag) return;
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setIsDragging(true);
        }}
      >
        <g transform={`scale(${markerScale})`}>
          {/* 拖拽热区：透明大圆，比可视点大很多，触控好按 */}
          <circle r={28} fill="transparent" />
          <circle r={14} fill="#FF4D64" opacity={0.25}>
            <animate
              attributeName="r"
              values="12;22;12"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.35;0.1;0.35"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r={6} fill="#FF4D64" stroke="#FFFFFF" strokeWidth={1.5} />
        </g>
      </motion.g>
    </svg>
  );
}
