import { GoogleGenerativeAI } from "@google/generative-ai";
import * as Astronomy from "astronomy-engine";
import {
  DailyHoroscopeSchema,
  HOROSCOPE_DOMAINS,
  ZODIAC_SIGNS,
  describeAspect,
  findAspects,
  pickDomainAspects,
  type Aspect,
  type DailyHoroscope,
  type HoroscopeDomain,
  type HoroscopeSlice,
  type NatalChart,
  type ZodiacSign,
} from "@lumina/shared";
import { env } from "./env.js";
import { computeTransits } from "./transits.js";

const VIBES = ["expansive", "tender", "tense", "grounded", "luminous", "still"] as const;

interface BuildInput {
  sunSign: ZodiacSign | null;
  natal?: NatalChart | null;
  date?: Date;
}

export async function buildDailyHoroscope({
  sunSign,
  natal,
  date,
}: BuildInput): Promise<DailyHoroscope> {
  const today = date ?? new Date();
  const moonLongitude = ecliptic(Astronomy.Body.Moon, today);
  const sunLongitude = ecliptic(Astronomy.Body.Sun, today);
  const moonSign = signOf(moonLongitude);
  const moonPhase = describeMoonPhase(moonLongitude, sunLongitude);
  const dateStr = today.toISOString().slice(0, 10);

  const aspects = natal
    ? findAspects(natal.placements, computeTransits(today)).slice(0, 8)
    : [];
  const aspectByDomain = pickDomainAspects(aspects, HOROSCOPE_DOMAINS) as Record<
    HoroscopeDomain,
    Aspect | null
  >;

  let slices: HoroscopeSlice[] | null = null;
  let headline: string | null = null;

  if (env.GOOGLE_AI_API_KEY) {
    try {
      const llm = await generateWithGemini({
        sunSign,
        moonSign,
        moonPhase,
        dateStr,
        aspects,
        aspectByDomain,
      });
      slices = llm.slices;
      headline = llm.headline;
    } catch {
      // fall through to deterministic
    }
  }

  if (!slices) {
    const seed = seedFromDate(dateStr) + zodiacIdx(sunSign ?? moonSign) * 7 + zodiacIdx(moonSign);
    slices = HOROSCOPE_DOMAINS.map((domain: HoroscopeDomain, i: number) =>
      deterministicSlice(
        domain,
        sunSign ?? moonSign,
        moonSign,
        moonPhase,
        seed + i * 13,
        aspectByDomain[domain],
      ),
    );
    headline = deterministicHeadline(sunSign, moonSign, moonPhase, seed, aspects[0] ?? null);
  }

  return DailyHoroscopeSchema.parse({
    date: dateStr,
    sunSign,
    moonSign,
    moonPhase,
    headline: headline ?? "Today is asking you to slow down.",
    slices,
  });
}

async function generateWithGemini(args: {
  sunSign: ZodiacSign | null;
  moonSign: ZodiacSign;
  moonPhase: string;
  dateStr: string;
  aspects: Aspect[];
  aspectByDomain: Record<HoroscopeDomain, Aspect | null>;
}): Promise<{ slices: HoroscopeSlice[]; headline: string }> {
  const client = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
    },
  });

  const aspectLines =
    args.aspects.length > 0
      ? args.aspects
          .slice(0, 5)
          .map((a) => `- ${describeAspect(a)} (orb ${a.orb.toFixed(1)}°, ${a.quality})`)
          .join("\n")
      : "- (no personal natal chart available)";

  const domainAspectLines = (Object.entries(args.aspectByDomain) as Array<
    [HoroscopeDomain, Aspect | null]
  >)
    .map(([domain, a]) =>
      a
        ? `- ${domain}: ${describeAspect(a)} (${a.quality})`
        : `- ${domain}: (no specific aspect today)`,
    )
    .join("\n");

  const prompt = `You are an astrologer in the style of Co-Star: short, sharp, second-person, slightly poetic, never preachy. Today is ${args.dateStr}. Moon is in ${args.moonSign} (${args.moonPhase}). User Sun sign: ${args.sunSign ?? "unknown"}.

ACTIVE TRANSITS-TO-NATAL ASPECTS (most exact first):
${aspectLines}

DOMAIN-RELEVANT ASPECTS to weave into each slice:
${domainAspectLines}

Return STRICT JSON with this exact shape:
{
  "headline": "string, max 80 chars, present tense, no emoji",
  "slices": [
    { "domain": "work",    "title": "max 32 chars", "body": "2 sentences max", "vibe": "expansive|tender|tense|grounded|luminous|still", "intensity": 1-5, "do": "imperative phrase", "dont": "imperative phrase", "note": "short, e.g. 'Mars trine your Sun' — omit if no aspect" },
    { "domain": "home",    "title": "...", "body": "...", "vibe": "...", "intensity": 1-5, "do": "...", "dont": "...", "note": "..." },
    { "domain": "love",    "title": "...", "body": "...", "vibe": "...", "intensity": 1-5, "do": "...", "dont": "...", "note": "..." },
    { "domain": "friends", "title": "...", "body": "...", "vibe": "...", "intensity": 1-5, "do": "...", "dont": "...", "note": "..." }
  ]
}

Tone rules: no clichés ("the universe", "manifest", "abundance"), no exclamation marks, no astrological jargon EXCEPT in the "note" field. The body should reflect the emotional flavor of the active aspect (challenging = friction or wake-up call; easy = open door or grace; neutral = focus or merge) WITHOUT naming the planets. Intensity should match orb tightness — tight aspects (orb < 2°) get 4–5, looser get 2–3.`;

  const result = await model.generateContent(prompt);
  const txt = result.response.text();
  const parsed = JSON.parse(txt) as {
    headline: string;
    slices: Array<{
      domain: string;
      title: string;
      body: string;
      vibe: string;
      intensity: number;
      do: string;
      dont: string;
      note?: string;
    }>;
  };
  const slices: HoroscopeSlice[] = parsed.slices.map((s) => {
    const slice: HoroscopeSlice = {
      domain: (HOROSCOPE_DOMAINS.includes(s.domain as HoroscopeDomain)
        ? s.domain
        : "work") as HoroscopeDomain,
      title: s.title.slice(0, 60),
      body: s.body,
      vibe: (VIBES.includes(s.vibe as (typeof VIBES)[number])
        ? s.vibe
        : "grounded") as HoroscopeSlice["vibe"],
      intensity: Math.min(5, Math.max(1, Math.round(s.intensity))),
      do: s.do,
      dont: s.dont,
    };
    if (s.note && s.note.trim().length > 0) slice.note = s.note.trim();
    return slice;
  });
  return { slices, headline: parsed.headline };
}

function deterministicSlice(
  domain: HoroscopeDomain,
  sun: ZodiacSign,
  moon: ZodiacSign,
  moonPhase: string,
  seed: number,
  aspect: Aspect | null,
): HoroscopeSlice {
  const pool = DOMAIN_POOL[domain];
  // Bias pool by aspect quality if present
  const filtered = aspect
    ? pool.filter((p) => matchesQuality(p.vibe, aspect.quality))
    : pool;
  const usePool = filtered.length > 0 ? filtered : pool;
  const pick = usePool[seed % usePool.length]!;

  // Intensity from orb tightness if aspect available, else from seed
  const intensity = aspect
    ? clamp(Math.round((1 - aspect.tightness) * 4) + 1)
    : (((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5);

  const slice: HoroscopeSlice = {
    domain,
    title: pick.title,
    body: pick.body
      .replaceAll("{sun}", sun)
      .replaceAll("{moon}", moon)
      .replaceAll("{phase}", moonPhase.toLowerCase()),
    vibe: pick.vibe,
    intensity: intensity as 1 | 2 | 3 | 4 | 5,
    do: pick.do,
    dont: pick.dont,
  };
  if (aspect) slice.note = describeAspect(aspect);
  return slice;
}

function matchesQuality(
  vibe: HoroscopeSlice["vibe"],
  quality: "easy" | "challenging" | "neutral",
): boolean {
  if (quality === "easy") return vibe === "expansive" || vibe === "luminous" || vibe === "tender";
  if (quality === "challenging") return vibe === "tense" || vibe === "still" || vibe === "grounded";
  return true;
}

function clamp(n: number): number {
  return Math.max(1, Math.min(5, n));
}

function deterministicHeadline(
  sun: ZodiacSign | null,
  moon: ZodiacSign,
  moonPhase: string,
  seed: number,
  topAspect: Aspect | null,
): string {
  if (topAspect && topAspect.tightness < 0.5) {
    const flavor =
      topAspect.quality === "easy"
        ? "an open door"
        : topAspect.quality === "challenging"
          ? "a friction worth respecting"
          : "a focused merge";
    return `${describeAspect(topAspect)} — ${flavor}.`;
  }
  const pick = HEADLINES[seed % HEADLINES.length] ?? "Today is asking for honesty.";
  return pick
    .replaceAll("{sun}", sun ?? moon)
    .replaceAll("{moon}", moon)
    .replaceAll("{phase}", moonPhase.toLowerCase());
}

function ecliptic(body: Astronomy.Body, date: Date): number {
  const v = Astronomy.GeoVector(body, date, true);
  const e = Astronomy.Ecliptic(v);
  return ((e.elon % 360) + 360) % 360;
}

function signOf(longitude: number): ZodiacSign {
  return ZODIAC_SIGNS[Math.floor(longitude / 30) % 12]!;
}

function zodiacIdx(s: ZodiacSign): number {
  return ZODIAC_SIGNS.indexOf(s);
}

function describeMoonPhase(moonLon: number, sunLon: number): string {
  const angle = (((moonLon - sunLon) % 360) + 360) % 360;
  if (angle < 22.5 || angle > 337.5) return "New Moon";
  if (angle < 67.5) return "Waxing Crescent";
  if (angle < 112.5) return "First Quarter";
  if (angle < 157.5) return "Waxing Gibbous";
  if (angle < 202.5) return "Full Moon";
  if (angle < 247.5) return "Waning Gibbous";
  if (angle < 292.5) return "Last Quarter";
  return "Waning Crescent";
}

function seedFromDate(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return h;
}

const HEADLINES = [
  "Today is asking for honesty, not hustle.",
  "The {moon} moon is loosening something you've been gripping.",
  "Quieter than yesterday. That's the assignment.",
  "Your {sun} stubbornness is a feature today, not a flaw.",
  "Notice what feels heavy. Don't try to fix it.",
  "Less performance. More presence.",
  "{phase} energy: small moves, real ones.",
  "You don't owe anyone an explanation today.",
  "Soft is not the same as weak.",
];

const DOMAIN_POOL: Record<
  HoroscopeDomain,
  Array<{ title: string; body: string; vibe: HoroscopeSlice["vibe"]; do: string; dont: string }>
> = {
  work: [
    {
      title: "Slow code, fewer regrets",
      body: "The {moon} moon makes today bad for big decisions. Good for noticing what you keep avoiding in your inbox.",
      vibe: "grounded",
      do: "Finish one thing fully",
      dont: "Open seven new tabs",
    },
    {
      title: "Money speaks quietly",
      body: "A small financial truth wants your attention. {phase} energy supports facing the number, not the feeling.",
      vibe: "still",
      do: "Open the bank app",
      dont: "Promise yourself you'll do it tomorrow",
    },
    {
      title: "Don't perform competence",
      body: "Your {sun} brain wants to look impressive. Today rewards the person who asks the dumb question first.",
      vibe: "tender",
      do: "Say I don't know",
      dont: "Pretend you read the doc",
    },
    {
      title: "Pressure is a clue",
      body: "Where it tightens, look. The work you resist most is the one with the highest leverage.",
      vibe: "tense",
      do: "Pick the hard task",
      dont: "Reorganize your desk again",
    },
    {
      title: "Build, don't broadcast",
      body: "Skip the post. The {moon} moon prefers things that compound in private.",
      vibe: "luminous",
      do: "Ship without announcing",
      dont: "Refresh the metrics",
    },
    {
      title: "An open door",
      body: "Something easy is being handed to you. The {sun} habit of overworking it is the real risk.",
      vibe: "expansive",
      do: "Take the easy yes",
      dont: "Make it harder than it is",
    },
  ],
  home: [
    {
      title: "Soft chores count",
      body: "Folding the laundry is a love letter to tomorrow-you. The {phase} moon agrees.",
      vibe: "tender",
      do: "Make the bed",
      dont: "Wait for inspiration",
    },
    {
      title: "Family is a frequency",
      body: "Someone in your house is broadcasting their mood. You don't have to absorb it to honor it.",
      vibe: "still",
      do: "Listen without fixing",
      dont: "Take it personally",
    },
    {
      title: "Light the room you live in",
      body: "Your space is reflecting back what you've been outsourcing. {sun} energy wants beauty, not perfection.",
      vibe: "luminous",
      do: "Light a candle",
      dont: "Doomscroll on the couch",
    },
    {
      title: "An old conversation returns",
      body: "Something unsaid in your family is asking to be said now. The {moon} moon makes you braver than usual.",
      vibe: "tense",
      do: "Send the text",
      dont: "Rehearse it for two more days",
    },
    {
      title: "Rest is infrastructure",
      body: "You are not behind. You are tired. {phase} hours reward people who lie down on purpose.",
      vibe: "grounded",
      do: "Nap without guilt",
      dont: "Optimize your evening",
    },
    {
      title: "Stretch the walls a little",
      body: "Home doesn't have to feel small today. {phase} energy invites a small expansion — a window open, a door propped.",
      vibe: "expansive",
      do: "Move one piece of furniture",
      dont: "Tolerate the dim light",
    },
  ],
  love: [
    {
      title: "Want what you actually want",
      body: "The {moon} moon strips out the polite version. What does your body want before your manners answer?",
      vibe: "expansive",
      do: "Name the desire",
      dont: "Apologize for it",
    },
    {
      title: "Tenderness over strategy",
      body: "Stop running the numbers on the relationship. {phase} energy rewards the unguarded sentence.",
      vibe: "tender",
      do: "Tell them one true thing",
      dont: "Wait for them to start",
    },
    {
      title: "Your {sun} pattern is showing",
      body: "The thing you do when you feel unsure — they noticed. That's not a problem yet, but it's a clue.",
      vibe: "still",
      do: "Sit with the discomfort",
      dont: "Pick a fight to escape it",
    },
    {
      title: "Touch is a language",
      body: "Words are tired today. The body is fluent. The {moon} moon turns up the volume on skin.",
      vibe: "luminous",
      do: "Initiate the contact",
      dont: "Wait for permission to want",
    },
    {
      title: "Solitude is not rejection",
      body: "If you're alone today, it isn't a verdict. {phase} hours are for being your own first choice.",
      vibe: "grounded",
      do: "Take yourself out",
      dont: "Compare your timeline",
    },
    {
      title: "Friction with affection",
      body: "Something they do is grating today. It's data, not a verdict. Don't post about it. Talk to them.",
      vibe: "tense",
      do: "Say it kindly and once",
      dont: "Subtweet",
    },
  ],
  friends: [
    {
      title: "Send the unprompted text",
      body: "Someone you love is having a quietly hard week. The {moon} moon is asking you to be the one who notices.",
      vibe: "tender",
      do: "Reach out first",
      dont: "Assume they're fine",
    },
    {
      title: "Less group chat, more eye contact",
      body: "Group energy is loud and shallow today. {phase} hours reward the one-on-one.",
      vibe: "still",
      do: "Call one person",
      dont: "Heart-react and move on",
    },
    {
      title: "Boundaries are the gift",
      body: "Saying no kindly today is more loving than saying yes resentfully. Your {sun} loyalty does not require self-betrayal.",
      vibe: "grounded",
      do: "Decline the thing",
      dont: "Ghost",
    },
    {
      title: "Old friends, new shape",
      body: "A friendship is asking to evolve, not end. The {moon} moon makes the conversation easier than you think.",
      vibe: "expansive",
      do: "Be honest about the change",
      dont: "Pretend nothing's different",
    },
    {
      title: "Receive something",
      body: "You are very good at giving. {phase} energy wants you to accept help without paying for it in apology.",
      vibe: "luminous",
      do: "Say thank you and stop there",
      dont: "Volunteer to repay it",
    },
    {
      title: "An honest disagreement",
      body: "A small misalignment with a friend is asking to be aired. {phase} energy holds the conversation softly.",
      vibe: "tense",
      do: "Use I-statements",
      dont: "Score the point",
    },
  ],
};
