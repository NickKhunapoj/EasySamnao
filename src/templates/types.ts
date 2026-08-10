import type { TemplateId, WatermarkInstance } from "../types";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  width: number;
  height: number;
}

export type TemplateElement =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; strokeWidth: number }
  | { kind: "text"; text: string; x: number; y: number; fontSize: number; weight: "normal" | "bold"; align: "left" | "center"; role: "text" | "heading" | "date" | "name" }
  | { kind: "signature"; x: number; y: number; width: number; height: number };

export interface TemplatePlan {
  width: number;
  height: number;
  elements: TemplateElement[];
}

export type TemplatePlanner = (watermark: WatermarkInstance) => TemplatePlan;
