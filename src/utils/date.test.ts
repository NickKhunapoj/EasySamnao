import { describe, expect, it } from "vitest";
import { formatCertificationDate } from "./date";

describe("Thai certification dates", () => {
  it("uses Buddhist Era for Thai formats", () => {
    expect(formatCertificationDate("2026-08-10", "thai-numeric")).toBe("10/08/2569");
    expect(formatCertificationDate("2026-08-10", "thai-long")).toBe("10 สิงหาคม 2569");
  });
  it("also supports ISO and English dates", () => {
    expect(formatCertificationDate("2026-08-10", "iso")).toBe("2026-08-10");
    expect(formatCertificationDate("2026-08-10", "english-long")).toBe("10 August 2026");
  });
});
