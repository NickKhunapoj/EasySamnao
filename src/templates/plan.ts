import type { WatermarkInstance } from "../types";
import { formatCertificationDate } from "../utils/date";
import { wrapPurpose } from "../utils/wrap";
import type { TemplateElement, TemplatePlan } from "./types";
import { templateDefinition } from "./definitions";

// TH Sarabun New has larger apparent glyphs than the prior Windows fallback.
const EMBEDDED_FONT_SCALE = 0.63;
const centered = (text: string, y: number, fontSize: number, weight: "normal" | "bold", role: "text" | "heading" | "date" | "name" = "text"): TemplateElement => ({
  kind: "text", text, x: 500, y, fontSize: fontSize * EMBEDDED_FONT_SCALE, weight, align: "center", role
});

function signatureElements(watermark: WatermarkInstance, y: number, height: number): TemplateElement[] {
  const elements: TemplateElement[] = [{ kind: "signature", x: 350, y, width: 300, height }];
  if (watermark.showSignerName && watermark.signerName.trim()) {
    elements.push(centered(watermark.signerName.trim(), y + height + 45, 34, "normal", "name"));
  }
  if (watermark.showDate) {
    elements.push(centered(formatCertificationDate(watermark.date, watermark.dateFormat), y + height + (watermark.showSignerName && watermark.signerName.trim() ? 85 : 45), 36, "bold", "date"));
  }
  return elements;
}

export function buildTemplatePlan(watermark: WatermarkInstance): TemplatePlan {
  const definition = templateDefinition(watermark.templateId);
  // Purpose is intentionally verbatim: the user controls both opening and closing wording.
  // Use nearly the full width between the two rules before wrapping the purpose text.
  const purpose = watermark.purpose.trim() ? wrapPurpose(watermark.purpose.trim(), 60) : [];
  if (watermark.templateId === "classic-horizontal") {
    const topPadding = 30;
    const purposeFontSize = 38;
    const purposeLineHeight = 56;
    const purposeStart = 22 + topPadding + purposeFontSize / 2;
    const renderedPurposeLines = Math.max(1, purpose.length);
    // Equal 30-unit whitespace above the first and below the final purpose line.
    const secondRuleY = purposeStart + (renderedPurposeLines - 1) * purposeLineHeight + purposeFontSize / 2 + topPadding;
    const headingY = secondRuleY + 62;
    const signatureY = headingY + 40;
    const signatureHeight = 105;
    const tailY = signatureY + signatureHeight + (watermark.showSignerName && watermark.signerName.trim() ? 72 : 30);
    const elements: TemplateElement[] = [
      { kind: "line", x1: 90, y1: 22, x2: 910, y2: 22, strokeWidth: 2.5 },
      ...purpose.map((line, index) => centered(line, purposeStart + index * purposeLineHeight, purposeFontSize, "bold")),
      { kind: "line", x1: 90, y1: secondRuleY, x2: 910, y2: secondRuleY, strokeWidth: 2.5 },
      centered(watermark.certificationText.trim() || "สำเนาถูกต้อง", headingY, 66, "normal", "heading"),
      ...signatureElements(watermark, signatureY, signatureHeight).map((element) => element.kind === "text" && element.role === "date" ? { ...element, y: tailY } : element)
    ];
    return { width: definition.width, height: Math.max(definition.height, tailY + 34), elements };
  }
  if (watermark.templateId === "compact") {
    const elements: TemplateElement[] = [
      { kind: "line", x1: 110, y1: 22, x2: 890, y2: 22, strokeWidth: 2.5 },
      centered(watermark.certificationText.trim() || "สำเนาถูกต้อง", 88, 64, "normal", "heading"),
      ...purpose.map((line, index) => centered(line, 148 + index * 38, 34, "bold")),
      ...signatureElements(watermark, 210, 86)
    ];
    return { width: definition.width, height: definition.height, elements };
  }
  const elements: TemplateElement[] = [
    centered(watermark.certificationText.trim() || "สำเนาถูกต้อง", 72, 72, "normal", "heading"),
    ...purpose.map((line, index) => centered(line, 128 + index * 38, 34, "bold")),
    ...signatureElements(watermark, 190, 80)
  ];
  return { width: definition.width, height: definition.height, elements };
}
