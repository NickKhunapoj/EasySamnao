const allowedElements = new Set(["svg", "g", "defs", "filter", "fecolormatrix", "clippath", "mask", "image", "use", "path", "line", "polyline", "polygon", "rect", "circle", "ellipse", "title", "desc"]);
const allowedAttributes = new Set([
  "xmlns", "xmlns:xlink", "viewbox", "width", "height", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "d", "points", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
  "opacity", "fill-opacity", "stroke-opacity", "transform", "preserveaspectratio", "aria-label", "role", "id", "href", "xlink:href",
  "filter", "mask", "clip-path", "clip-rule", "values", "color-interpolation-filters", "version", "zoomandpan"
]);
const styleProperties = new Set(["fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity"]);

function unsafeValue(value: string): boolean {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  return normalized.includes("javascript:") || normalized.includes("data:text/html") || normalized.includes("file:") || normalized.includes("http:") || normalized.includes("https:") || normalized.includes("url(") || normalized.includes("expression(");
}

function isSafeLocalReference(value: string): boolean {
  return /^#[A-Za-z_][\w:.-]*$/.test(value) || /^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/.test(value);
}

function isSafeEmbeddedPng(value: string): boolean {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  // Limit encoded content to roughly 2 MB; no remote or SVG-in-SVG payloads are accepted.
  return Boolean(match && match[1].replace(/\s/g, "").length <= 2_700_000);
}

/** Converts a deliberately narrow subset of local SVG class CSS into presentation attributes. */
function inlineSafeClassStyles(document: XMLDocument): void {
  const classes = new Map<string, Map<string, string>>();
  for (const style of [...document.querySelectorAll("style")]) {
    const rules = style.textContent ?? "";
    for (const match of rules.matchAll(/\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g)) {
      const declarations = new Map<string, string>();
      for (const declaration of match[2].split(";")) {
        const [property, ...rest] = declaration.split(":");
        const name = property?.trim().toLowerCase();
        const value = rest.join(":").trim();
        if (name && styleProperties.has(name) && value && !unsafeValue(value) && !/[{};]/.test(value)) declarations.set(name, value);
      }
      if (declarations.size) classes.set(match[1], declarations);
    }
    style.remove();
  }
  for (const element of [...document.querySelectorAll("[class]")]) {
    for (const className of (element.getAttribute("class") ?? "").split(/\s+/)) {
      for (const [property, value] of classes.get(className) ?? []) if (!element.hasAttribute(property)) element.setAttribute(property, value);
    }
    element.removeAttribute("class");
  }
}

/** Produces a graphics-only SVG suitable for data URL preview and local storage. */
export function sanitizeSvg(input: string): string {
  if (input.length > 2_000_000) throw new Error("The SVG is too large to import safely.");
  const parser = new DOMParser();
  const document = parser.parseFromString(input, "image/svg+xml");
  if (document.querySelector("parsererror")) throw new Error("The SVG is malformed.");
  const root = document.documentElement;
  if (root.localName.toLowerCase() !== "svg") throw new Error("The imported file is not an SVG document.");
  inlineSafeClassStyles(document);

  const visit = (element: Element): void => {
    for (const child of [...element.children]) {
      const name = child.localName.toLowerCase();
      if (!allowedElements.has(name)) {
        child.remove();
        continue;
      }
      visit(child);
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const isReference = name === "href" || name === "xlink:href";
      const validReference = isSafeLocalReference(attribute.value) || isSafeEmbeddedPng(attribute.value);
      const isLocalEffectReference = ["filter", "mask", "clip-path"].includes(name) && isSafeLocalReference(attribute.value);
      if (name.startsWith("on") || !allowedAttributes.has(name) || (isReference && !validReference) || (!isLocalEffectReference && unsafeValue(attribute.value))) {
        element.removeAttribute(attribute.name);
      }
    }
    if (element.localName.toLowerCase() === "image" && !element.getAttribute("href") && !element.getAttribute("xlink:href")) element.remove();
  };
  visit(root);
  root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  root.removeAttribute("style");
  const sanitized = new XMLSerializer().serializeToString(root);
  if (!root.querySelector("path,line,polyline,polygon,rect,circle,ellipse,use,image[href],image[xlink\\:href]")) throw new Error("The SVG has no usable graphics after security filtering.");
  return sanitized;
}

export function svgDataUrl(svg: string, color?: string): string {
  const colored = color ? svg.replace(/<svg\b([^>]*)>/i, `<svg$1 color="${color}">`) : svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colored)}`;
}

/** Blob URLs avoid WebView-specific limitations with encoded SVG data URLs. Call revokeObjectURL when finished. */
export function svgObjectUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}
