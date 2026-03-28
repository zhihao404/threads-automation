import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("merges Tailwind classes correctly (last wins)", () => {
    // tailwind-merge should resolve conflicts: p-4 + p-2 => p-2
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("merges conflicting Tailwind text colors", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("preserves non-conflicting Tailwind classes", () => {
    const result = cn("p-4", "m-2", "text-sm");
    expect(result).toContain("p-4");
    expect(result).toContain("m-2");
    expect(result).toContain("text-sm");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles single class", () => {
    expect(cn("single")).toBe("single");
  });

  it("handles arrays of classes (clsx feature)", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles objects with boolean values (clsx feature)", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("handles mix of strings, arrays, and objects", () => {
    const result = cn("base", ["extra"], { conditional: true });
    expect(result).toContain("base");
    expect(result).toContain("extra");
    expect(result).toContain("conditional");
  });
});
