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

export interface NatalChartInput {
  birthDate: string;
  birthTime?: string | null;
  birthPlace?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function computeNatalChart(input: NatalChartInput): NatalChart {
  const hasExactTime = Boolean(input.birthTime);
  const isoDate = buildIsoDateUtc(input.birthDate, input.birthTime, input.longitude);
  const date = new Date(isoDate);

  const placements: Placement[] = [];

  for (const key of PLANET_KEYS) {
    if (key === "ascendant") continue;
    const longitude = ecliticLongitudeOf(key, date);
    const retrograde = isRetrograde(key, date);
    placements.push({
      planet: key,
      sign: signOfLongitude(longitude),
      degree: longitude % 30,
      retrograde,
      house: null,
    });
  }

  if (hasExactTime && typeof input.latitude === "number" && typeof input.longitude === "number") {
    const ascLongitude = computeAscendant(date, input.latitude, input.longitude);
    placements.push({
      planet: "ascendant",
      sign: signOfLongitude(ascLongitude),
      degree: ascLongitude % 30,
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

function buildIsoDateUtc(
  date: string,
  time: string | null | undefined,
  longitude: number | null | undefined,
): string {
  if (time) {
    // Treat the supplied time as local; approximate the UTC offset from longitude (15° per hour).
    // This is accurate enough for a natal chart when no IANA tz is provided (within ~1° of true).
    const offsetHours = typeof longitude === "number" ? Math.round(longitude / 15) : 0;
    const sign = offsetHours >= 0 ? "+" : "-";
    const absH = String(Math.abs(offsetHours)).padStart(2, "0");
    return `${date}T${time}:00${sign}${absH}:00`;
  }
  // No birth time: use noon UTC, which keeps Moon within ~6° of true value
  return `${date}T12:00:00Z`;
}

function ecliticLongitudeOf(key: Exclude<PlanetKey, "ascendant">, date: Date): number {
  const body = PLANET_TO_BODY[key];
  if (!body) return 0;
  const vec = Astronomy.GeoVector(body, date, true);
  const ecl = Astronomy.Ecliptic(vec);
  return normalize360(ecl.elon);
}

function isRetrograde(key: Exclude<PlanetKey, "ascendant">, date: Date): boolean {
  if (key === "sun" || key === "moon") return false;
  const oneDay = 24 * 60 * 60 * 1000;
  const before = ecliticLongitudeOf(key, new Date(date.getTime() - oneDay));
  const after = ecliticLongitudeOf(key, new Date(date.getTime() + oneDay));
  let delta = after - before;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

function computeAscendant(date: Date, latitude: number, longitude: number): number {
  // Local sidereal time (in degrees)
  const gmstHours = Astronomy.SiderealTime(date);
  const lstDeg = normalize360(gmstHours * 15 + longitude);

  const epsilon = degToRad(23.4392911); // mean obliquity of the ecliptic
  const ramc = degToRad(lstDeg);
  const phi = degToRad(latitude);

  // Ascendant formula (degrees)
  const y = -Math.cos(ramc);
  const x = Math.sin(ramc) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon);
  let asc = Math.atan2(y, x);
  let ascDeg = radToDeg(asc);
  ascDeg = normalize360(ascDeg);

  // Asc must be between 180–360 of MC (eastern horizon). If MC is in Q1/Q2, asc is in Q3/Q4.
  // Quick correction: if our value falls within 180° of MC going clockwise, flip 180°.
  const mc = lstDeg;
  const diff = normalize360(ascDeg - mc);
  if (diff < 180) ascDeg = normalize360(ascDeg + 180);
  return ascDeg;
}

function signOfLongitude(longitude: number): ZodiacSign {
  const idx = Math.floor(normalize360(longitude) / 30) % 12;
  return ZODIAC_SIGNS[idx]!;
}

function normalize360(d: number): number {
  let v = d % 360;
  if (v < 0) v += 360;
  return v;
}

function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}
function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

export function quickSunSign(birthDate: string): ZodiacSign {
  const longitude = ecliticLongitudeOf("sun", new Date(`${birthDate}T12:00:00Z`));
  return signOfLongitude(longitude);
}
