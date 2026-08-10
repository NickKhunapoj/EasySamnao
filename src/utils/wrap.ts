/** A deterministic, Thai-friendly fallback wrapper used consistently by preview and export. */
export function wrapPurpose(text: string, maxChars = 32, maxLines = 2): string[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return ["-"];
  const lines: string[] = [];
  let rest = normalized;
  while (rest.length > maxChars && lines.length < maxLines - 1) {
    const candidate = rest.slice(0, maxChars + 1);
    const lastSpace = candidate.lastIndexOf(" ");
    const breakAt = lastSpace > Math.floor(maxChars * 0.45) ? lastSpace : maxChars;
    lines.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }
  if (rest) lines.push(rest.length > maxChars ? `${rest.slice(0, maxChars - 1).trimEnd()}…` : rest);
  return lines;
}
