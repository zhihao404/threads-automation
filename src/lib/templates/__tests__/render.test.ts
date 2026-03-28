import { describe, it, expect } from "vitest";
import {
  extractVariables,
  renderTemplate,
  BUILTIN_VARIABLES,
  getBuiltinVariableValues,
} from "../render";

// =============================================================================
// extractVariables
// =============================================================================

describe("extractVariables", () => {
  it("extracts single variable", () => {
    expect(extractVariables("Hello {{name}}!")).toEqual(["name"]);
  });

  it("extracts multiple variables", () => {
    const result = extractVariables("{{greeting}} {{name}}, today is {{day}}.");
    expect(result).toContain("greeting");
    expect(result).toContain("name");
    expect(result).toContain("day");
    expect(result).toHaveLength(3);
  });

  it("deduplicates repeated variables", () => {
    const result = extractVariables("{{name}} and {{name}} again");
    expect(result).toEqual(["name"]);
  });

  it("returns empty array when no variables present", () => {
    expect(extractVariables("No variables here")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractVariables("")).toEqual([]);
  });

  it("only matches word characters inside braces", () => {
    // Spaces inside braces should not match
    expect(extractVariables("{{ name }}")).toEqual([]);
    // Hyphens should not match
    expect(extractVariables("{{my-var}}")).toEqual([]);
  });

  it("handles variables with underscores", () => {
    expect(extractVariables("{{my_var}}")).toEqual(["my_var"]);
  });

  it("handles variables with numbers", () => {
    expect(extractVariables("{{var1}}")).toEqual(["var1"]);
  });

  it("handles adjacent variables", () => {
    const result = extractVariables("{{a}}{{b}}");
    expect(result).toContain("a");
    expect(result).toContain("b");
  });
});

// =============================================================================
// renderTemplate
// =============================================================================

describe("renderTemplate", () => {
  it("substitutes a single variable", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("substitutes multiple variables", () => {
    const result = renderTemplate("{{greeting}} {{name}}!", {
      greeting: "Hi",
      name: "Alice",
    });
    expect(result).toBe("Hi Alice!");
  });

  it("substitutes repeated occurrences of the same variable", () => {
    const result = renderTemplate("{{x}} and {{x}}", { x: "Y" });
    expect(result).toBe("Y and Y");
  });

  it("keeps undefined variables as-is with braces", () => {
    const result = renderTemplate("Hello {{name}}!", {});
    expect(result).toBe("Hello {{name}}!");
  });

  it("substitutes defined variables and keeps undefined ones", () => {
    const result = renderTemplate("{{a}} {{b}}", { a: "1" });
    expect(result).toBe("1 {{b}}");
  });

  it("handles empty content", () => {
    expect(renderTemplate("", { name: "test" })).toBe("");
  });

  it("handles content with no variables", () => {
    expect(renderTemplate("No variables", { name: "test" })).toBe("No variables");
  });

  it("handles empty string substitution", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "" });
    expect(result).toBe("Hello !");
  });

  it("handles special characters in substitution values", () => {
    const result = renderTemplate("{{content}}", {
      content: "Hello <script>alert('xss')</script>",
    });
    expect(result).toBe("Hello <script>alert('xss')</script>");
  });
});

// =============================================================================
// BUILTIN_VARIABLES
// =============================================================================

describe("BUILTIN_VARIABLES", () => {
  it("contains expected keys", () => {
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("date");
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("time");
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("year");
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("month");
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("day");
    expect(Object.keys(BUILTIN_VARIABLES)).toContain("weekday");
  });

  it("each value is a function returning a string", () => {
    for (const [, fn] of Object.entries(BUILTIN_VARIABLES)) {
      const result = fn();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("year returns a 4-digit string", () => {
    const year = BUILTIN_VARIABLES.year!();
    expect(year).toMatch(/^\d{4}$/);
  });

  it("weekday returns a Japanese day name", () => {
    const weekday = BUILTIN_VARIABLES.weekday!();
    expect(["日", "月", "火", "水", "木", "金", "土"]).toContain(weekday);
  });
});

// =============================================================================
// getBuiltinVariableValues
// =============================================================================

describe("getBuiltinVariableValues", () => {
  it("returns an object with all builtin keys", () => {
    const values = getBuiltinVariableValues();
    expect(Object.keys(values)).toContain("date");
    expect(Object.keys(values)).toContain("time");
    expect(Object.keys(values)).toContain("year");
    expect(Object.keys(values)).toContain("month");
    expect(Object.keys(values)).toContain("day");
    expect(Object.keys(values)).toContain("weekday");
  });

  it("returns string values for all keys", () => {
    const values = getBuiltinVariableValues();
    for (const [, val] of Object.entries(values)) {
      expect(typeof val).toBe("string");
    }
  });
});
