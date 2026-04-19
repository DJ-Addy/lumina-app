import { z } from "zod";
import { PlanetKeySchema, type PlanetKey, type Placement } from "./astrology";

export const ASPECT_TYPES = ["conjunction", "sextile", "square", "trine", "opposition"] as const;
export const AspectTypeSchema = z.enum(ASPECT_TYPES);
export type AspectType = z.infer<typeof AspectTypeSchema>;

export const AspectSchema = z.object({
  transit: PlanetKeySchema,
  natal: PlanetKeySchema,
  type: AspectTypeSchema,
  /** angular separation between transit and natal longitudes (0–180) */
  separation: z.number(),
  /** how far from exact aspect angle (0 = exact) */
  orb: z.number(),
  /** lower = tighter aspect; for sorting */
  tightness: z.number(),
  /** "easy" (trine/sextile/conj-benefic) vs "challenging" (square/opp/conj-malefic) */
  quality: z.enum(["easy", "challenging", "neutral"]),
});
export type Aspect = z.infer<typeof AspectSchema>;

const ASPECT_ANGLES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

const ASPECT_ORBS: Record<AspectType, number> = {
  conjunction: 6,
  sextile: 3,
  square: 5,
  trine: 5,
  opposition: 6,
};

const ASPECT_QUALITY: Record<AspectType, "easy" | "challenging" | "neutral"> = {
  conjunction: "neutral",
  sextile: "easy",
  square: "challenging",
  trine: "easy",
  opposition: "challenging",
};

/**
 * Compute aspects between transiting planets (today's longitudes) and the natal chart.
 * Returns aspects sorted by tightness (most exact first).
 */
export function findAspects(
  natal: Placement[],
  transitLongitudes: Partial<Record<PlanetKey, number>>,
): Aspect[] {
  const aspects: Aspect[] = [];

  for (const [transitKey, transitLon] of Object.entries(transitLongitudes) as Array<
    [PlanetKey, number]
  >) {
    if (transitLon === undefined || transitLon === null) continue;

    for (const placement of natal) {
      if (placement.planet === "ascendant") continue; // Asc isn't a transiting body
      const natalLon = placementLongitude(placement);
      const sep = angularSeparation(transitLon, natalLon);

      for (const type of ASPECT_TYPES) {
        const target = ASPECT_ANGLES[type];
        const orbAllowed = ASPECT_ORBS[type];
        const orb = Math.abs(sep - target);
        if (orb <= orbAllowed) {
          aspects.push({
            transit: transitKey,
            natal: placement.planet,
            type,
            separation: sep,
            orb,
            tightness: orb / orbAllowed,
            quality: ASPECT_QUALITY[type],
          });
          break;
        }
      }
    }
  }

  return aspects.sort((a, b) => a.tightness - b.tightness);
}

function placementLongitude(p: Placement): number {
  // Reconstruct ecliptic longitude from sign + degree.
  // Sign order matches ZODIAC_SIGNS in astrology.ts.
  const SIGNS = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  const idx = SIGNS.indexOf(p.sign);
  return (idx >= 0 ? idx * 30 : 0) + p.degree;
}

function angularSeparation(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Domain → which natal planets matter most for that life area. */
export const DOMAIN_RULERS: Record<string, PlanetKey[]> = {
  work: ["sun", "saturn", "mercury", "mars"],
  home: ["moon", "saturn", "jupiter"],
  love: ["venus", "moon", "mars"],
  friends: ["mercury", "venus", "jupiter"],
};

/** Pick the most relevant aspect for a domain (or null if none). */
export function pickDomainAspect(aspects: Aspect[], domain: string): Aspect | null {
  const rulers = DOMAIN_RULERS[domain] ?? [];
  if (rulers.length === 0) return aspects[0] ?? null;
  for (const aspect of aspects) {
    if (rulers.includes(aspect.natal)) return aspect;
  }
  return aspects[0] ?? null;
}

/**
 * Like pickDomainAspect, but assigns a *distinct* aspect to each domain when possible.
 * Falls back to the same aspect across domains only when no other relevant aspect exists.
 */
export function pickDomainAspects(
  aspects: Aspect[],
  domains: readonly string[],
): Record<string, Aspect | null> {
  const out: Record<string, Aspect | null> = {};
  const used = new Set<Aspect>();

  // First pass: pick the tightest *unused* aspect that matches each domain's rulers.
  for (const domain of domains) {
    const rulers = DOMAIN_RULERS[domain] ?? [];
    let chosen: Aspect | null = null;
    for (const aspect of aspects) {
      if (used.has(aspect)) continue;
      if (rulers.length === 0 || rulers.includes(aspect.natal)) {
        chosen = aspect;
        break;
      }
    }
    out[domain] = chosen;
    if (chosen) used.add(chosen);
  }

  // Second pass: any domain still empty falls back to the tightest aspect (even if reused).
  for (const domain of domains) {
    if (!out[domain]) out[domain] = pickDomainAspect(aspects, domain);
  }

  return out;
}

/** Short, human descriptor of an aspect, e.g. "Mars trine your Sun". */
export function describeAspect(a: Aspect): string {
  return `${capitalize(a.transit)} ${a.type} your ${capitalize(a.natal)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
