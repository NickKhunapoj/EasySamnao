import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./sanitizeSvg";

describe("SVG signature sanitization", () => {
  it("keeps safe vector graphics", () => {
    expect(sanitizeSvg('<svg viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="#00f"/></svg>')).toContain("path");
  });
  it("removes executable and remote content", () => {
    const result = sanitizeSvg('<svg><script>alert(1)</script><image href="https://bad.example/a.png"/><path onload="x()" d="M0 0"/></svg>');
    expect(result).not.toMatch(/script|image|onload|https:/i);
    expect(result).toContain("path");
  });
  it("keeps safe local defs/use references used by many signature SVGs", () => {
    const result = sanitizeSvg('<svg viewBox="0 0 10 10"><defs><path id="ink" d="M0 0 L10 10"/></defs><use href="#ink" stroke="#00f"/></svg>');
    expect(result).toContain("defs");
    expect(result).toContain('href="#ink"');
  });
  it("allows a size-limited embedded PNG but rejects remote image sources", () => {
    const embedded = sanitizeSvg('<svg><image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/></svg>');
    expect(embedded).toContain("data:image/png;base64");
    const remote = sanitizeSvg('<svg><image href="https://bad.example/signature.png"/><path d="M0 0"/></svg>');
    expect(remote).not.toContain("bad.example");
  });
  it("rejects malformed SVG", () => expect(() => sanitizeSvg("<svg><path></svg>")).toThrow("malformed"));
});
