import { describe, expect, it } from "vitest";
import { editorPointToNormalized, normalizedToPdfTransform, rotatePdfVector } from "./coordinates";

describe("canonical watermark coordinates", () => {
  it("converts top-left editor coordinates to the PDF origin", () => {
    expect(normalizedToPdfTransform({ x: 0.5, y: 0.25, width: 0.65, rotation: -30 }, { width: 600, height: 800 })).toEqual({ centerX: 300, centerY: 600, width: 390, rotation: 30 });
  });
  it("normalizes editor points and clamps a dragged group", () => {
    expect(editorPointToNormalized(50, 25, { width: 100, height: 100 })).toEqual({ x: 0.5, y: 0.25 });
    expect(editorPointToNormalized(-20, 150, { width: 100, height: 100 })).toEqual({ x: 0, y: 1 });
  });
  it("uses positive PDF rotation for a rising -30 degree editor watermark", () => {
    const vector = rotatePdfVector(10, 0, 30);
    expect(vector.x).toBeCloseTo(8.66, 2); expect(vector.y).toBeCloseTo(5, 2);
  });
});
