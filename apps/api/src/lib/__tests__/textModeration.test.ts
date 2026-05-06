import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  env: {
    OPENAI_API_KEY: "sk-test-moderation",
  },
}));

import { moderateText } from "../textModeration.js";

function mockModerationResponse(categoryScores: Record<string, number>) {
  return {
    id: "modreq_test",
    model: "omni-moderation-latest",
    results: [
      {
        flagged: Object.values(categoryScores).some((s) => s >= 0.5),
        categories: Object.fromEntries(
          Object.entries(categoryScores).map(([k, v]) => [k, v >= 0.5]),
        ),
        category_scores: categoryScores,
      },
    ],
  };
}

describe("moderateText", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fail-open when OpenAI returns non-OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const out = await moderateText("anything here");
    expect(out.severity).toBe("allow");
    expect(out.labels).toEqual([]);
  });

  it("fail-open when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const out = await moderateText("hello");
    expect(out.severity).toBe("allow");
  });

  it("returns crisis when self-harm scores are high", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        mockModerationResponse({
          "self-harm": 0.9,
          "self-harm/intent": 0.2,
        }),
    }) as unknown as typeof fetch;

    const out = await moderateText("I do not want to be here anymore");
    expect(out.severity).toBe("crisis");
    expect(out.labels.some((l) => l.label === "self_harm")).toBe(true);
    expect(out.reason).toBeDefined();
  });

  it("returns block for high hate score", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        mockModerationResponse({
          hate: 0.95,
        }),
    }) as unknown as typeof fetch;

    const out = await moderateText("slurs and hate");
    expect(out.severity).toBe("block");
    expect(out.labels.some((l) => l.label === "hate")).toBe(true);
  });

  it("returns warn for borderline harassment", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        mockModerationResponse({
          harassment: 0.55,
        }),
    }) as unknown as typeof fetch;

    const out = await moderateText("mildly hostile");
    expect(out.severity).toBe("warn");
  });

  it("maps OpenAI keys to shared labels", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        mockModerationResponse({
          "sexual/minors": 0.99,
        }),
    }) as unknown as typeof fetch;

    const out = await moderateText("test");
    expect(out.severity).toBe("block");
    expect(out.labels.some((l) => l.label === "sexual_minors")).toBe(true);
  });
});
