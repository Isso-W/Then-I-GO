import { useMemo, useState, useEffect, useRef } from "react";
import streetNetwork from "../../scripts/data/street-network.json";
import terrainRaw from "../../scripts/data/terrain.json";
import {
  projectLatLng,
  bboxSizeMeters,
  computeViewBox,
  MIN_VIEW_RADIUS_METERS,
  type LatLng,
  type BBox,
} from "./mapProjection";
import { polyLenM, pointAlong, partialPoly } from "../lib/routeGeometry";
import type { VlogGeo } from "../types";
import type { Street } from "../lib/roadGraph";

const network = streetNetwork as { streets: Street[] };
interface TerrainPolygon { name: string; type: "campus" | "park" | "water" | "commercial"; points: LatLng[]; }
const terrain = terrainRaw as { polygons: TerrainPolygon[] };
const TERRAIN_STYLE: Record<TerrainPolygon["type"], { fill: string; opacity: number }> = {
  campus: { fill: "#1F1B47", opacity: 0.5 },
  park: { fill: "#0F3A24", opacity: 0.5 },
  water: { fill: "#0E3B47", opacity: 0.65 },
  commercial: { fill: "#3D3013", opacity: 0.4 },
};

const REFERENCE_WIDTH_PX = 500;

function pathStr(points: LatLng[], bbox: BBox): string {
  if (points.length === 0) return "";
  const h = projectLatLng(points[0], bbox);
  let d = `M ${h.x.toFixed(2)} ${h.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const p = projectLatLng(points[i], bbox);
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}
function polyAttr(points: LatLng[], bbox: BBox): string {
  return points.map((p) => { const xy = projectLatLng(p, bbox); return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`; }).join(" ");
}

/**
 * 路线回放：在真实地图上把今天这趟走法演一遍 —— 小人沿街逐段走、轨迹生长、到站亮针。
 * 每到一站会通过 onStopChange(i) 通知父组件切到该站的照片特写（停留期间）；
 * 离站继续走时回调 null。frozen 时画静态全貌（战报卡缩略图）。
 */
export function RouteReplay({
  geo,
  accent,
  frozen = false,
  onDone,
  onStopChange,
}: {
  geo: VlogGeo;
  accent: string;
  frozen?: boolean;
  onDone?: () => void;
  onStopChange?: (stopIndex: number | null) => void;
}) {
  const bbox = useMemo(() => computeViewBox(geo.fullPath, MIN_VIEW_RADIUS_METERS / 2, 1.35), [geo]);
  const { width, height } = useMemo(() => bboxSizeMeters(bbox), [bbox]);
  const markerScale = width / REFERENCE_WIDTH_PX;

  const terrainShapes = useMemo(
    () => terrain.polygons.map((poly, idx) => ({ key: `t-${idx}`, pts: polyAttr(poly.points, bbox), style: TERRAIN_STYLE[poly.type] })),
    [bbox]
  );
  const streetPaths = useMemo(
    () => network.streets.map((s, idx) => ({ key: `s-${idx}`, d: pathStr(s.points, bbox) })),
    [bbox]
  );
  const fullRoutePath = useMemo(() => pathStr(geo.fullPath, bbox), [geo, bbox]);
  const stopXY = useMemo(() => geo.stops.map((s) => projectLatLng({ lat: s.lat, lng: s.lng }, bbox)), [geo, bbox]);
  const originXY = useMemo(() => (geo.fullPath[0] ? projectLatLng(geo.fullPath[0], bbox) : { x: 0, y: 0 }), [geo, bbox]);

  // 每段时长（按段长 clamp）+ 到站停留（停留期间播放该站照片特写）
  const schedule = useMemo(() => {
    const HOLD = 2.4;
    const legDur = geo.legs.map((l) => Math.min(2.4, Math.max(1.1, polyLenM(l) / 140)));
    return { HOLD, legDur };
  }, [geo]);

  const [prog, setProg] = useState(() =>
    frozen
      ? { leg: Math.max(0, geo.legs.length - 1), frac: 1, arrived: geo.stops.length }
      : { leg: 0, frac: 0, arrived: 0 }
  );

  // 回调放进 ref，避免父组件因切照片重渲染导致动画 effect 重启
  const onDoneRef = useRef(onDone);
  const onStopRef = useRef(onStopChange);
  onDoneRef.current = onDone;
  onStopRef.current = onStopChange;

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    let lastStop: number | null = -2 as number | null; // 强制首帧触发一次
    let done = false;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      let acc = 0;
      let leg = 0, frac = 1, arrived = geo.stops.length, holding = false, placed = false;
      for (let i = 0; i < schedule.legDur.length; i++) {
        const w = schedule.legDur[i];
        if (t < acc + w) { leg = i; frac = (t - acc) / w; arrived = i; holding = false; placed = true; break; }
        if (t < acc + w + schedule.HOLD) { leg = i; frac = 1; arrived = i + 1; holding = true; placed = true; break; }
        acc += w + schedule.HOLD;
      }
      if (!placed) {
        setProg({ leg: Math.max(0, geo.legs.length - 1), frac: 1, arrived: geo.stops.length });
        if (lastStop !== null) { onStopRef.current?.(null); lastStop = null; }
        if (!done) { done = true; onDoneRef.current?.(); }
        return;
      }
      setProg({ leg, frac, arrived });
      const stop = holding ? leg : null;
      if (stop !== lastStop) { onStopRef.current?.(stop); lastStop = stop; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frozen, geo, schedule]);

  const trailPath = useMemo(() => {
    const walked: LatLng[] = [];
    for (let i = 0; i < prog.leg; i++) {
      const l = geo.legs[i];
      if (walked.length === 0) walked.push(...l);
      else walked.push(...l.slice(1));
    }
    const cur = partialPoly(geo.legs[prog.leg] ?? [], prog.frac);
    if (walked.length === 0) walked.push(...cur);
    else walked.push(...cur.slice(1));
    return pathStr(walked, bbox);
  }, [prog, geo, bbox]);

  const avatar = useMemo(
    () => projectLatLng(pointAlong(geo.legs[prog.leg] ?? geo.fullPath, prog.frac), bbox),
    [prog, geo, bbox]
  );

  // 正在走路（非到站停留）时显示"前往…"小条
  const walking = !frozen && prog.arrived === prog.leg && prog.leg < geo.stops.length;
  const headingName = geo.stops[prog.leg]?.name;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g>
          {terrainShapes.map((t) => (
            <polygon key={t.key} points={t.pts} fill={t.style.fill} opacity={t.style.opacity} />
          ))}
        </g>
        <g opacity={0.5}>
          {streetPaths.map((s) => (
            <path key={s.key} d={s.d} fill="none" stroke="#2A2358" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <path d={fullRoutePath} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={trailPath} fill="none" stroke={accent} strokeWidth={9} opacity={0.25} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={trailPath} fill="none" stroke={accent} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

        {geo.stops.map((s, i) => {
          const reached = i < prog.arrived;
          return (
            <g key={i} transform={`translate(${stopXY[i].x}, ${stopXY[i].y}) scale(${markerScale})`}>
              {reached ? (
                <g>
                  <circle r={24} fill={accent} opacity={0.2} />
                  <circle r={16} fill={accent} stroke="#fff" strokeWidth={2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={17}>{s.emoji}</text>
                  <g transform="translate(13,-13)">
                    <circle r={7.5} fill="#FFD166" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={800} fill="#0A0A1A">{i + 1}</text>
                  </g>
                </g>
              ) : (
                <circle r={5} fill="#ffffff" opacity={0.3} />
              )}
            </g>
          );
        })}

        {/* 起点 */}
        {geo.fullPath.length > 0 && (
          <g transform={`translate(${originXY.x}, ${originXY.y}) scale(${markerScale})`}>
            <circle r={6} fill="#fff" opacity={0.85} />
            <circle r={11} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.5} />
          </g>
        )}

        {!frozen && (
          <g transform={`translate(${avatar.x}, ${avatar.y}) scale(${markerScale})`}>
            <circle r={13} fill="#FF4D64" opacity={0.25}>
              <animate attributeName="r" values="11;18;11" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r={6} fill="#FF4D64" stroke="#fff" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {!frozen && (
        <div className="absolute inset-x-0 top-0 px-3 pt-3">
          <div className="flex gap-1">
            {geo.stops.map((_, i) => (
              <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-linear"
                  style={{ background: accent, width: i < prog.leg ? "100%" : i === prog.leg ? `${prog.frac * 100}%` : "0%" }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {walking && headingName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-bold text-white/85 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} />
            前往 第{prog.leg + 1}站
          </div>
        </div>
      )}
    </div>
  );
}
