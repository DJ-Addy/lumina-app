import * as Astronomy from "astronomy-engine";
import type { PlanetKey } from "@lumina/shared";

const TRANSIT_BODIES: Array<[Exclude<PlanetKey, "ascendant">, Astronomy.Body]> = [
  ["sun", Astronomy.Body.Sun],
  ["moon", Astronomy.Body.Moon],
  ["mercury", Astronomy.Body.Mercury],
  ["venus", Astronomy.Body.Venus],
  ["mars", Astronomy.Body.Mars],
  ["jupiter", Astronomy.Body.Jupiter],
  ["saturn", Astronomy.Body.Saturn],
];

export function computeTransitsLocal(date: Date = new Date()): Partial<Record<PlanetKey, number>> {
  const out: Partial<Record<PlanetKey, number>> = {};
  for (const [key, body] of TRANSIT_BODIES) {
    const v = Astronomy.GeoVector(body, date, true);
    const e = Astronomy.Ecliptic(v);
    out[key] = norm(e.elon);
  }
  return out;
}

function norm(d: number): number {
  let v = d % 360;
  if (v < 0) v += 360;
  return v;
}
