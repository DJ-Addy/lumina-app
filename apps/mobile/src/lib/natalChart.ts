import * as Astronomy from "astronomy-engine";
import {
  PLANET_KEYS,
  ZODIAC_SIGNS,
  type NatalChart,
  type Placement,
  type PlanetKey,
  type ZodiacSign,
} from "@lumina/shared";

const PLANET_TO_BODY: Record<Exclude<PlanetKey, "ascendant">, Astronomy.Body> = {
  sun: Astronomy.Body.Sun,
  moon: Astronomy.Body.Moon,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

export interface NatalInput {
  birthDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function computeNatalChartLocal(input: NatalInput): NatalChart {
  const hasExactTime = Boolean(input.birthTime);
  const date = new Date(buildIso(input.birthDate, input.birthTime, input.longitude));

  const placements: Placement[] = [];
  for (const key of PLANET_KEYS) {
    if (key === "ascendant") continue;
    const longitude = ecLon(key, date);
    placements.push({
      planet: key,
      sign: signOf(longitude),
      degree: longitude % 30,
      retrograde: isRetro(key, date),
      house: null,
    });
  }

  if (hasExactTime && typeof input.latitude === "number" && typeof input.longitude === "number") {
    const ascLon = ascendant(date, input.latitude, input.longitude);
    placements.push({
      planet: "ascendant",
      sign: signOf(ascLon),
      degree: ascLon % 30,
      retrograde: false,
      house: 1,
    });
  }

  return {
    birthDate: input.birthDate,
    birthTime: input.birthTime ?? null,
    birthPlace: input.birthPlace ?? null,
    hasExactTime,
    placements,
    generatedAt: new Date().toISOString(),
  };
}

export function todaysMoon(date: Date = new Date()): { sign: ZodiacSign; phase: string } {
  const moonLon = ecLon("moon", date);
  const sunLon = ecLon("sun", date);
  return { sign: signOf(moonLon), phase: phaseOf(moonLon, sunLon) };
}

export function quickSunSignLocal(birthDate: string): ZodiacSign {
  return signOf(ecLon("sun", new Date(`${birthDate}T12:00:00Z`)));
}

function ecLon(key: Exclude<PlanetKey, "ascendant">, date: Date): number {
  const body = PLANET_TO_BODY[key];
  if (!body) return 0;
  const v = Astronomy.GeoVector(body, date, true);
  const e = Astronomy.Ecliptic(v);
  return norm(e.elon);
}

function isRetro(key: Exclude<PlanetKey, "ascendant">, date: Date): boolean {
  if (key === "sun" || key === "moon") return false;
  const day = 86400000;
  const before = ecLon(key, new Date(date.getTime() - day));
  const after = ecLon(key, new Date(date.getTime() + day));
  let delta = after - before;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

function ascendant(date: Date, lat: number, lng: number): number {
  const gmst = Astronomy.SiderealTime(date);
  const lst = norm(gmst * 15 + lng);
  const eps = deg(23.4392911);
  const ramc = deg(lst);
  const phi = deg(lat);
  const y = -Math.cos(ramc);
  const x = Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
  let asc = norm(rad(Math.atan2(y, x)));
  if (norm(asc - lst) < 180) asc = norm(asc + 180);
  return asc;
}

function buildIso(date: string, time: string | null | undefined, lng: number | null | undefined): string {
  if (time) {
    const offsetH = typeof lng === "number" ? Math.round(lng / 15) : 0;
    const sign = offsetH >= 0 ? "+" : "-";
    const absH = String(Math.abs(offsetH)).padStart(2, "0");
    return `${date}T${time}:00${sign}${absH}:00`;
  }
  return `${date}T12:00:00Z`;
}

function signOf(longitude: number): ZodiacSign {
  return ZODIAC_SIGNS[Math.floor(norm(longitude) / 30) % 12]!;
}

function phaseOf(moonLon: number, sunLon: number): string {
  const angle = norm(moonLon - sunLon);
  if (angle < 22.5 || angle > 337.5) return "New Moon";
  if (angle < 67.5) return "Waxing Crescent";
  if (angle < 112.5) return "First Quarter";
  if (angle < 157.5) return "Waxing Gibbous";
  if (angle < 202.5) return "Full Moon";
  if (angle < 247.5) return "Waning Gibbous";
  if (angle < 292.5) return "Last Quarter";
  return "Waning Crescent";
}

function norm(d: number): number {
  let v = d % 360;
  if (v < 0) v += 360;
  return v;
}
function deg(d: number): number {
  return (d * Math.PI) / 180;
}
function rad(r: number): number {
  return (r * 180) / Math.PI;
}
