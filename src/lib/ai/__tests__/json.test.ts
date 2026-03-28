import { describe, it, expect } from "vitest";
import { extractJsonText, parseJsonResponse } from "../json";

// =============================================================================
// extractJsonText
// =============================================================================

describe("extractJsonText", () => {
  it("returns raw text when no code block present", () => {
    const input = '{"key": "value"}';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("extracts JSON from markdown code block with json tag", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("extracts JSON from markdown code block without language tag", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("trims whitespace around extracted JSON", () => {
    const input = '```json\n  {"key": "value"}  \n```';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("trims outer whitespace for plain text", () => {
    const input = '  {"key": "value"}  ';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("handles multiline JSON in code block", () => {
    const input = '```json\n{\n  "key": "value",\n  "num": 42\n}\n```';
    const result = extractJsonText(input);
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe("value");
    expect(parsed.num).toBe(42);
  });

  it("handles text before and after code block", () => {
    const input = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.';
    expect(extractJsonText(input)).toBe('{"key": "value"}');
  });

  it("returns trimmed text for empty input", () => {
    expect(extractJsonText("")).toBe("");
    expect(extractJsonText("   ")).toBe("");
  });
});

// =============================================================================
// parseJsonResponse
// =============================================================================

describe("parseJsonResponse", () => {
  const INVALID_MSG = "Invalid JSON";
  const MISSING_MSG = "No JSON found";

  it("parses valid JSON string", () => {
    const result = parseJsonResponse<{ key: string }>(
      '{"key": "value"}',
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result).toEqual({ key: "value" });
  });

  it("parses JSON from markdown code block", () => {
    const result = parseJsonResponse<{ key: string }>(
      '```json\n{"key": "value"}\n```',
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result).toEqual({ key: "value" });
  });

  it("parses nested objects", () => {
    const input = '{"outer": {"inner": 42}}';
    const result = parseJsonResponse<{ outer: { inner: number } }>(
      input,
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result.outer.inner).toBe(42);
  });

  it("parses arrays", () => {
    const input = '[1, 2, 3]';
    const result = parseJsonResponse<number[]>(
      input,
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result).toEqual([1, 2, 3]);
  });

  it("extracts JSON object embedded in surrounding text", () => {
    const input = 'Here is the result: {"key": "value"} and some more text';
    const result = parseJsonResponse<{ key: string }>(
      input,
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result).toEqual({ key: "value" });
  });

  it("throws MISSING_MSG when no JSON object present", () => {
    expect(() =>
      parseJsonResponse("no json here at all", INVALID_MSG, MISSING_MSG),
    ).toThrow(MISSING_MSG);
  });

  it("throws INVALID_MSG for malformed JSON object", () => {
    // Contains braces but invalid JSON inside
    expect(() =>
      parseJsonResponse("{not: valid json}", INVALID_MSG, MISSING_MSG),
    ).toThrow(INVALID_MSG);
  });

  it("handles JSON with special characters in values", () => {
    const input = '{"message": "Hello \\"world\\""}';
    const result = parseJsonResponse<{ message: string }>(
      input,
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result.message).toBe('Hello "world"');
  });

  it("handles whitespace-heavy JSON", () => {
    const input = `{
      "key1": "value1",
      "key2": "value2"
    }`;
    const result = parseJsonResponse<Record<string, string>>(
      input,
      INVALID_MSG,
      MISSING_MSG,
    );
    expect(result.key1).toBe("value1");
    expect(result.key2).toBe("value2");
  });
});
