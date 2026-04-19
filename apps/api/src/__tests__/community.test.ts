import { describe, it, expect } from "vitest";

describe("Community alias generator", () => {
  const CELESTIAL_ADJECTIVES = [
    "Starlit", "Moonlit", "Golden", "Silver", "Cosmic", "Gentle", "Quiet",
    "Soft", "Warm", "Glowing", "Tender", "Radiant", "Misty", "Velvet", "Aurora",
  ];
  const CELESTIAL_NOUNS = [
    "Moon", "Star", "Dawn", "Dusk", "Nova", "Bloom", "Tide", "Glow",
    "Light", "Rose", "Fern", "Mist", "Lune", "Ember", "Sage",
  ];

  function generateAlias(): string {
    const adj = CELESTIAL_ADJECTIVES[Math.floor(Math.random() * CELESTIAL_ADJECTIVES.length)]!;
    const noun = CELESTIAL_NOUNS[Math.floor(Math.random() * CELESTIAL_NOUNS.length)]!;
    const suffix = Math.floor(Math.random() * 999) + 1;
    return `${adj}${noun}${suffix}`;
  }

  it("generates a non-empty alias", () => {
    const alias = generateAlias();
    expect(alias.length).toBeGreaterThan(0);
  });

  it("does not contain personal information patterns", () => {
    for (let i = 0; i < 50; i++) {
      const alias = generateAlias();
      expect(alias).not.toMatch(/@/);
      expect(alias).not.toMatch(/\d{4,}/);
    }
  });

  it("alias contains only alphanumeric characters", () => {
    for (let i = 0; i < 20; i++) {
      const alias = generateAlias();
      expect(alias).toMatch(/^[A-Za-z]+\d{1,3}$/);
    }
  });
});

describe("Night feed truncation", () => {
  function truncateSnippet(text: string, maxLen = 140): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + "…";
  }

  it("does not truncate short text", () => {
    const short = "Tonight I felt so alone.";
    expect(truncateSnippet(short)).toBe(short);
  });

  it("truncates long text with ellipsis", () => {
    const long = "a".repeat(200);
    const result = truncateSnippet(long);
    expect(result.length).toBeLessThanOrEqual(140);
    expect(result.endsWith("…")).toBe(true);
  });
});
