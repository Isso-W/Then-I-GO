import React, { useMemo, useRef, useState, useEffect, type MouseEvent } from "react";
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

const ROAD_GRAPH = buildGraph(network.streets);

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

function polygonPointsAttr(points: LatLng[], bbox: BBox): string {
  return points
    .map((p) => {
      const xy = projectLatLng(p, bbox);
      return `${xy.x.toFixed(2)},${xy.y.toFixed(2)}`;
    })
    .join(" ");
}

const REFERENCE_WIDTH_PX = 500;

export function Map({
  route,
  currentPosition = ORIGIN,
  onUserDrag,
  step,
  waypointIndex = 0,
}: {
  route: GeneratedRoute | null;
  currentPosition?: LatLng;
  onUserDrag?: (p: LatLng) => void;
  step?: ExploreStep;
  waypointIndex?: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragMovedRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(1);

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
          return currentPosition;
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
    () => defaultViewBox(displayPosition, FOLLOW_RADIUS_METERS / zoomLevel),
    [displayPosition, zoomLevel]
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

  const gameActive = step && !["intro", "preference_selection", "gear_confirmation", "achievement_unlock"].includes(step);

  const waypointMarkers = useMemo(() => {
    if (!route || route.waypoints.length === 0 || !gameActive) return [];
    return route.waypoints.map((wp) => ({
      ...wp,
      pos: projectLatLng({ lat: wp.lat, lng: wp.lng }, viewBox),
    }));
  }, [route, viewBox, gameActive]);

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

  // Determine next waypoint based on explore step
  const nextWp = step === "initial" || step === "checkin_initial" ? route?.waypoints[waypointIndex]
    : step === "hidden_active" || step === "checkin_hidden" ? route?.hiddenTask
    : step === "next_objective" || step === "checkin_next" ? route?.waypoints[waypointIndex]
    : undefined;
  const nextWpPos = nextWp ? projectLatLng({ lat: nextWp.lat, lng: nextWp.lng }, viewBox) : null;
  const dirAngle = nextWpPos
    ? Math.atan2(nextWpPos.x - currentPos.x, -(nextWpPos.y - currentPos.y)) * (180 / Math.PI)
    : 0;

  // Live navigation path: Dijkstra from avatar to next waypoint
  const navPath = useMemo(() => {
    if (!nextWp) return null;
    const poly = routePolyline(
      [currentPosition, { lat: nextWp.lat, lng: nextWp.lng }],
      ROAD_GRAPH
    );
    return pointsToPath(poly, viewBox);
  }, [currentPosition, nextWp, viewBox]);

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
  }, [isDragging, onUserDrag, viewBox]);

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

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 1.4, 4));
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 1.4, 0.4));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  };

  return (
    <div className="absolute inset-0 outline-none" onWheel={handleWheel}>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full outline-none"
      style={{ cursor: onUserDrag ? "pointer" : "default" }}
      onClick={handleMapClick}
    >
      {/* Terrain */}
      <g>
        {terrainShapes.map((t) => (
          <polygon key={t.key} points={t.pts} fill={t.style.fill} opacity={t.style.opacity} stroke="none" />
        ))}
      </g>

      {/* Road network */}
      <g opacity={0.65}>
        {streetPaths.map((s) => (
          <path
            key={s.key} d={s.d} fill="none" stroke={s.style.stroke}
            strokeWidth={s.style.width} strokeDasharray={s.style.dash}
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {/* Waypoint markers */}
      {waypointMarkers.map((wp, i) => (
        <g key={i} transform={`translate(${wp.pos.x}, ${wp.pos.y}) scale(${markerScale})`}>
          <circle r={26} fill="#A98BFF" opacity={0.2} />
          <circle r={18} fill="#6C5CFF" stroke="#FFFFFF" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={20}>{wp.emoji}</text>
          <g transform="translate(14, -14)">
            <circle r={8} fill="#FFD166" />
            <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={800} fill="#0A0A1A">{i + 1}</text>
          </g>
        </g>
      ))}

      {/* Hidden task marker */}
      {showHidden && hiddenMark && (
        <g transform={`translate(${hiddenMark.x}, ${hiddenMark.y}) scale(${markerScale})`}>
          <circle r={24} fill="#F59E0B" opacity={0.2} />
          <circle r={16} fill="#D97706" stroke="#FCD34D" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={18}>{hiddenMark.emoji}</text>
        </g>
      )}

      {/* Branch choice markers */}
      {showBranch &&
        branchMarks.map((m) => (
          <g key={`branch-${m.key}`} transform={`translate(${m.x}, ${m.y}) scale(${markerScale})`}>
            <circle r={24} fill="#6C5CFF" opacity={0.2} />
            <circle r={17} fill="#5B3BFF" stroke="#A98BFF" strokeWidth={2} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={800} fill="#FFFFFF">{m.label}</text>
          </g>
        ))}

      {/* Live navigation path from avatar to next target */}
      {navPath && nextWpPos && (
        <g>
          <path
            d={navPath} fill="none" stroke="#A98BFF"
            strokeWidth={3 * markerScale} opacity={0.5}
            strokeDasharray={`${8 * markerScale} ${5 * markerScale}`}
            strokeLinecap="round"
          />
          <g transform={`translate(${currentPos.x}, ${currentPos.y}) scale(${markerScale}) rotate(${dirAngle})`}>
            <polygon points="0,-28 -5,-20 5,-20" fill="#A98BFF" opacity={0.9} />
          </g>
        </g>
      )}

      {/* Avatar */}
      <motion.g
        initial={false}
        animate={{ x: currentPos.x, y: currentPos.y }}
        transition={{ duration: 0 }}
        style={{ cursor: onUserDrag ? (isDragging ? "grabbing" : "grab") : "default" }}
        onPointerDown={(e) => {
          if (!onUserDrag) return;
          e.preventDefault();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setIsDragging(true);
        }}
      >
        <g transform={`scale(${markerScale})`}>
          <circle r={28} fill="transparent" />
          <circle r={20} fill="#6C5CFF" opacity={0.08}>
            <animate attributeName="r" values="18;26;18" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.04;0.12" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle r={14} fill="#6C5CFF" opacity={0.15}>
            <animate attributeName="r" values="13;17;13" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r={10} fill="#6C5CFF" stroke="#A98BFF" strokeWidth={1.5} />
          <circle cx={0} cy={-3} r={3} fill="white" />
          <path d="M-4,5 Q-4,0 0,0 Q4,0 4,5" fill="white" opacity={0.9} />
        </g>
      </motion.g>
    </svg>
    </div>
  );
}
