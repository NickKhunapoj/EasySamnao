import { describe, expect, it } from "vitest";
import { buildTemplatePlan } from "./plan";
import { createDefaultWatermark } from "../state/documentStore";
import { defaultSettings } from "../state/settingsStore";
import { wrapPurpose } from "../utils/wrap";

describe("certification templates", () => {
  it("builds the classic editable elements rather than a flattened image", () => {
    const plan = buildTemplatePlan(createDefaultWatermark(defaultSettings));
    expect(plan.elements.filter((item) => item.kind === "line")).toHaveLength(2);
    expect(plan.elements.some((item) => item.kind === "signature")).toBe(true);
    expect(plan.elements.some((item) => item.kind === "text" && item.text === "สำเนาถูกต้อง")).toBe(true);
  });
  it("uses a deterministic two-line Thai-friendly purpose wrapper", () => {
    expect(wrapPurpose("abcdefghij klmnopqrst uvwxyz", 12)).toEqual(["abcdefghij", "klmnopqrst…"]);
  });
  it("does not add purpose wording that the user did not enter", () => {
    const watermark = createDefaultWatermark(defaultSettings);
    watermark.purpose = "ใช้สมัครงาน เท่านั้น";
    const text = buildTemplatePlan(watermark).elements.filter((item) => item.kind === "text").map((item) => item.text);
    expect(text).toContain("ใช้สมัครงาน เท่านั้น");
    expect(text.join(" ")).not.toContain("ใช้สำหรับ");
  });
});
