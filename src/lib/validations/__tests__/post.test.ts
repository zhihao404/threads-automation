import { describe, it, expect } from "vitest";
import { createPostSchema } from "../post";

describe("createPostSchema", () => {
  // ---------------------------------------------------------------------------
  // Valid data
  // ---------------------------------------------------------------------------

  it("accepts valid TEXT post", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello world",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid IMAGE post with media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Check this out",
      mediaType: "IMAGE",
      mediaUrls: ["https://example.com/image.jpg"],
      status: "publish",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid VIDEO post with media URL", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Watch this",
      mediaType: "VIDEO",
      mediaUrls: ["https://example.com/video.mp4"],
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid CAROUSEL post with 2+ media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Carousel post",
      mediaType: "CAROUSEL",
      mediaUrls: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
      ],
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("accepts scheduled post with scheduledAt", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Future post",
      mediaType: "TEXT",
      status: "scheduled",
      scheduledAt: "2025-06-01T09:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("defaults replyControl to everyone", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replyControl).toBe("everyone");
    }
  });

  it("accepts custom replyControl values", () => {
    for (const replyControl of ["everyone", "accounts_you_follow", "mentioned_only"] as const) {
      const result = createPostSchema.safeParse({
        accountId: "acc_123",
        content: "Hello",
        mediaType: "TEXT",
        status: "draft",
        replyControl,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional topicTag", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "TEXT",
      status: "draft",
      topicTag: "tech",
    });
    expect(result.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Invalid data - required fields
  // ---------------------------------------------------------------------------

  it("rejects missing accountId", () => {
    const result = createPostSchema.safeParse({
      content: "Hello",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty accountId", () => {
    const result = createPostSchema.safeParse({
      accountId: "",
      content: "Hello",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "",
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Invalid data - content length
  // ---------------------------------------------------------------------------

  it("rejects content over 500 characters", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "a".repeat(501),
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("accepts content at exactly 500 characters", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "a".repeat(500),
      mediaType: "TEXT",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Invalid data - topicTag length
  // ---------------------------------------------------------------------------

  it("rejects topicTag over 50 characters", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "TEXT",
      status: "draft",
      topicTag: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Invalid data - mediaType / status enums
  // ---------------------------------------------------------------------------

  it("rejects invalid mediaType", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "AUDIO",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "TEXT",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Cross-field validation (superRefine)
  // ---------------------------------------------------------------------------

  it("rejects TEXT post with media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Hello",
      mediaType: "TEXT",
      mediaUrls: ["https://example.com/img.jpg"],
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects IMAGE post without media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Check this",
      mediaType: "IMAGE",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects IMAGE post with empty media URLs array", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Check this",
      mediaType: "IMAGE",
      mediaUrls: [],
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects VIDEO post without media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Watch",
      mediaType: "VIDEO",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CAROUSEL post with fewer than 2 media URLs", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Carousel",
      mediaType: "CAROUSEL",
      mediaUrls: ["https://example.com/1.jpg"],
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects CAROUSEL post with more than 20 media URLs", () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Carousel",
      mediaType: "CAROUSEL",
      mediaUrls: urls,
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("accepts CAROUSEL post with exactly 20 media URLs", () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Carousel",
      mediaType: "CAROUSEL",
      mediaUrls: urls,
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid media URL format", () => {
    const result = createPostSchema.safeParse({
      accountId: "acc_123",
      content: "Image post",
      mediaType: "IMAGE",
      mediaUrls: ["not-a-url"],
      status: "draft",
    });
    expect(result.success).toBe(false);
  });
});
