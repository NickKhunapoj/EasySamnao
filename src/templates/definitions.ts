import type { TemplateDefinition } from "./types";

export const templateDefinitions: TemplateDefinition[] = [
  { id: "classic-horizontal", name: "Classic Horizontal", description: "Two rules, certification heading, signature and date.", width: 1000, height: 610 },
  { id: "compact", name: "Compact", description: "A smaller stacked certification block for tight space.", width: 1000, height: 455 },
  { id: "minimal-diagonal", name: "Minimal Diagonal", description: "Simple certification text, signature and date.", width: 1000, height: 360 }
];

export function templateDefinition(id: TemplateDefinition["id"]): TemplateDefinition {
  const result = templateDefinitions.find((item) => item.id === id);
  if (!result) throw new Error(`Unknown certification template: ${id}`);
  return result;
}
