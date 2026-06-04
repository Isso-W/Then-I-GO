import type { LatLng } from "../components/mapProjection";

export interface NavStep {
  instruction: string;
  distanceM: number;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function turnLabel(diff: number): string | null {
  const abs = Math.abs(diff);
  if (abs <= 30) return null;
  if (abs <= 70) return diff > 0 ? "右前方转" : "左前方转";
  if (abs <= 150) return diff > 0 ? "右转" : "左转";
  return null;
}

function simplify(polyline: LatLng[], minSegM: number): LatLng[] {
  if (polyline.length <= 2) return polyline;
  const result: LatLng[] = [polyline[0]];
  let acc = 0;
  for (let i = 1; i < polyline.length - 1; i++) {
    acc += haversineM(polyline[i - 1], polyline[i]);
    if (acc >= minSegM) {
      result.push(polyline[i]);
      acc = 0;
    }
  }
  result.push(polyline[polyline.length - 1]);
  return result;
}

export function buildNavSteps(polyline: LatLng[]): NavStep[] {
  if (polyline.length < 2) return [{ instruction: "直行", distanceM: 0 }];

  const simplified = simplify(polyline, 15);
  if (simplified.length < 2) return [{ instruction: "直行", distanceM: haversineM(polyline[0], polyline[polyline.length - 1]) }];

  const steps: NavStep[] = [];
  let straightDist = 0;

  for (let i = 0; i < simplified.length - 1; i++) {
    const segDist = haversineM(simplified[i], simplified[i + 1]);

    if (i < simplified.length - 2) {
      const bearingIn = bearingDeg(simplified[i], simplified[i + 1]);
      const bearingOut = bearingDeg(simplified[i + 1], simplified[i + 2]);
      const diff = angleDiff(bearingIn, bearingOut);
      const turn = turnLabel(diff);

      if (turn) {
        steps.push({ instruction: `直行${fmtDist(straightDist + segDist)}`, distanceM: straightDist + segDist });
        steps.push({ instruction: turn, distanceM: 0 });
        straightDist = 0;
      } else {
        straightDist += segDist;
      }
    } else {
      straightDist += segDist;
    }
  }

  if (straightDist > 0) {
    steps.push({ instruction: `直行${fmtDist(straightDist)}后到达`, distanceM: straightDist });
  }

  return steps.length > 0 ? steps : [{ instruction: "直行", distanceM: 0 }];
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)}米`;
  return `${(m / 1000).toFixed(1)}km`;
}
