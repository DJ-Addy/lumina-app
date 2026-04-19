import { describe, it, expect } from "vitest";
import {
  CreateJournalEntryRequestSchema,
  JournalEntrySchema,
  CommunityFeedQuerySchema,
  CreateCommunityPostRequestSchema,
  ReportRequestSchema,
  SummarySchema,
  RequestMemoryBookExportSchema,
} from "../index";

describe("CreateJournalEntryRequestSchema", () => {
  it("accepts valid text entry", () => {
    const result = CreateJournalEntryRequestSchema.safeParse({
      mode: "text",
      content: "Tonight I felt so alone.",
      moodTags: ["lonely", "exhausted"],
      isNightEntry: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = CreateJournalEntryRequestSchema.safeParse({
      mode: "text",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 mood tags", () => {
    const result = CreateJournalEntryRequestSchema.safeParse({
      mode: "text",
      content: "Some content",
      moodTags: ["lonely", "exhausted", "grateful", "joyful", "anxious", "sad"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts micro mode", () => {
    const result = CreateJournalEntryRequestSchema.safeParse({ mode: "micro", content: "✦" });
    expect(result.success).toBe(true);
  });
});

describe("CommunityFeedQuerySchema", () => {
  it("defaults to latest tab", () => {
    const result = CommunityFeedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tab).toBe("latest");
  });

  it("accepts following tab", () => {
    const result = CommunityFeedQuerySchema.safeParse({ tab: "following" });
    expect(result.success).toBe(true);
  });

  it("enforces limit max 30", () => {
    const result = CommunityFeedQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });
});

describe("CreateCommunityPostRequestSchema", () => {
  it("accepts valid post with journal reference", () => {
    const result = CreateCommunityPostRequestSchema.safeParse({
      content: "I cried three times today. Twice from love, once from exhaustion.",
      journalEntryId: "00000000-0000-0000-0000-000000000001",
      visibility: "public",
    });
    expect(result.success).toBe(true);
  });

  it("defaults visibility to public", () => {
    const result = CreateCommunityPostRequestSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.visibility).toBe("public");
  });
});

describe("ReportRequestSchema", () => {
  it("accepts valid report", () => {
    const result = ReportRequestSchema.safeParse({
      targetType: "post",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "harmful_content",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid target type", () => {
    const result = ReportRequestSchema.safeParse({
      targetType: "unknown",
      targetId: "00000000-0000-0000-0000-000000000001",
      reason: "spam",
    });
    expect(result.success).toBe(false);
  });
});

describe("RequestMemoryBookExportSchema", () => {
  it("defaults includeLetters and includeEntries", () => {
    const result = RequestMemoryBookExportSchema.safeParse({ monthCheckpoint: 3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeLetters).toBe(true);
      expect(result.data.includeEntries).toBe(true);
      expect(result.data.coverVariant).toBe("default");
    }
  });

  it("rejects monthCheckpoint > 12", () => {
    const result = RequestMemoryBookExportSchema.safeParse({ monthCheckpoint: 13 });
    expect(result.success).toBe(false);
  });
});
