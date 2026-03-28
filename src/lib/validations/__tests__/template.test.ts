import { describe, it, expect } from "vitest";
import {
  createTemplateSchema,
  updateTemplateSchema,
  renderTemplateSchema,
} from "../template";

// =============================================================================
// createTemplateSchema
// =============================================================================

describe("createTemplateSchema", () => {
  it("accepts valid template", () => {
    const result = createTemplateSchema.safeParse({
      name: "Morning post",
      content: "Good morning {{name}}!",
    });
    expect(result.success).toBe(true);
  });

  it("defaults mediaType to TEXT", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mediaType).toBe("TEXT");
    }
  });

  it("accepts all valid mediaType values", () => {
    for (const mediaType of ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"] as const) {
      const result = createTemplateSchema.safeParse({
        name: "Test",
        content: "Hello",
        mediaType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional category", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "Hello",
      category: "marketing",
    });
    expect(result.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Required fields
  // ---------------------------------------------------------------------------

  it("rejects missing name", () => {
    const result = createTemplateSchema.safeParse({
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createTemplateSchema.safeParse({
      name: "",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Length limits
  // ---------------------------------------------------------------------------

  it("rejects name over 100 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "a".repeat(101),
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly 100 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "a".repeat(100),
      content: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects content over 500 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts content at exactly 500 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "a".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("rejects category over 50 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "Hello",
      category: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("accepts category at exactly 50 characters", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "Hello",
      category: "a".repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mediaType", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      content: "Hello",
      mediaType: "AUDIO",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// updateTemplateSchema
// =============================================================================

describe("updateTemplateSchema", () => {
  it("accepts partial updates", () => {
    expect(
      updateTemplateSchema.safeParse({ name: "New name" }).success,
    ).toBe(true);
    expect(
      updateTemplateSchema.safeParse({ content: "New content" }).success,
    ).toBe(true);
    expect(
      updateTemplateSchema.safeParse({ category: "new-cat" }).success,
    ).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    expect(updateTemplateSchema.safeParse({}).success).toBe(true);
  });

  it("still enforces constraints on provided fields", () => {
    expect(
      updateTemplateSchema.safeParse({ name: "" }).success,
    ).toBe(false);
    expect(
      updateTemplateSchema.safeParse({ name: "a".repeat(101) }).success,
    ).toBe(false);
    expect(
      updateTemplateSchema.safeParse({ content: "a".repeat(501) }).success,
    ).toBe(false);
  });
});

// =============================================================================
// renderTemplateSchema
// =============================================================================

describe("renderTemplateSchema", () => {
  it("accepts valid variables object", () => {
    const result = renderTemplateSchema.safeParse({
      variables: { name: "Alice", greeting: "Hello" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty variables object", () => {
    const result = renderTemplateSchema.safeParse({
      variables: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing variables", () => {
    const result = renderTemplateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string variable values", () => {
    const result = renderTemplateSchema.safeParse({
      variables: { count: 42 },
    });
    expect(result.success).toBe(false);
  });
});
