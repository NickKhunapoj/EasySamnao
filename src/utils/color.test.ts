import { describe, expect, it } from "vitest";
import { colorToPdf, parseHexColor } from "./color";

describe("colour parsing", () => {
  it("parses an RGB hex colour for canvas and PDF use", () => {
    expect(parseHexColor("#1467c9")).toEqual({ r: 20, g: 103, b: 201 });
    expect(colorToPdf("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
  });
  it("rejects unsupported colour formats", () => expect(() => parseHexColor("red")).toThrow("Invalid RGB"));
});
