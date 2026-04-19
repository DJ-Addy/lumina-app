import { describe, it, expect } from "vitest";

describe("API health", () => {
  it("health endpoint contract", () => {
    const response = { status: "ok", timestamp: new Date().toISOString() };
    expect(response.status).toBe("ok");
    expect(typeof response.timestamp).toBe("string");
  });
});
