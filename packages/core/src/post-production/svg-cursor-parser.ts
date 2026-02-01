import type { CursorShape, CursorShapePath } from "./cursor-shapes.js";

const UNSUPPORTED_ELEMENTS = ["clipPath", "mask", "filter", "use", "text", "image", "foreignObject"];

/**
 * Parse an SVG string into a CursorShape for use with the cursor renderer.
 *
 * Only supports `<path>`, `<circle>`, `<rect>`, and `<line>` elements.
 * Throws on unsupported elements to ensure deterministic rendering.
 */
export function parseSvgCursor(
  svgString: string,
  hotspot?: { x: number; y: number },
): CursorShape {
  // Validate no unsupported elements
  for (const el of UNSUPPORTED_ELEMENTS) {
    const regex = new RegExp(`<${el}[\\s/>]`, "i");
    if (regex.test(svgString)) {
      throw new Error(
        `Unsupported SVG element <${el}>. Custom cursors only support <path>, <circle>, <rect>, and <line> elements.`,
      );
    }
  }

  // Extract viewBox
  const viewBoxMatch = svgString.match(/viewBox\s*=\s*"([^"]+)"/);
  const viewBox = viewBoxMatch
    ? (viewBoxMatch[1].split(/[\s,]+/).map(Number) as [number, number, number, number])
    : [0, 0, 24, 24] as [number, number, number, number];

  // Extract stroke properties from root <svg> or first element
  const strokeWidth = extractAttr(svgString, "stroke-width", 2);
  const strokeLinecap = extractStringAttr(svgString, "stroke-linecap", "round") as CursorShape["strokeLinecap"];
  const strokeLinejoin = extractStringAttr(svgString, "stroke-linejoin", "round") as CursorShape["strokeLinejoin"];

  const paths: CursorShapePath[] = [];

  // Extract <path> elements
  const pathRegex = /<path\s+([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const d = extractStringAttr(attrs, "d", "");
    if (!d) continue;

    const fill = extractStringAttr(attrs, "fill", "");
    const stroke = extractStringAttr(attrs, "stroke", "");

    paths.push({
      d,
      fill: fill !== "none" && fill !== "",
      stroke: stroke !== "none",
    });
  }

  // Extract <circle> → convert to path
  const circleRegex = /<circle\s+([^>]*?)\/?>/gi;
  while ((match = circleRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const cx = extractAttr(attrs, "cx", 0);
    const cy = extractAttr(attrs, "cy", 0);
    const r = extractAttr(attrs, "r", 0);
    if (r <= 0) continue;

    const d = `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 -${r * 2},0`;
    const fill = extractStringAttr(attrs, "fill", "");
    const stroke = extractStringAttr(attrs, "stroke", "");

    paths.push({
      d,
      fill: fill !== "none",
      stroke: stroke !== "none" && stroke !== "",
    });
  }

  // Extract <rect> → convert to path
  const rectRegex = /<rect\s+([^>]*?)\/?>/gi;
  while ((match = rectRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const x = extractAttr(attrs, "(?<!-)x", 0);
    const y = extractAttr(attrs, "(?<!-)y", 0);
    const w = extractAttr(attrs, "width", 0);
    const h = extractAttr(attrs, "height", 0);
    if (w <= 0 || h <= 0) continue;

    const d = `M${x},${y}h${w}v${h}h-${w}z`;
    const fill = extractStringAttr(attrs, "fill", "");
    const stroke = extractStringAttr(attrs, "stroke", "");

    paths.push({
      d,
      fill: fill !== "none",
      stroke: stroke !== "none" && stroke !== "",
    });
  }

  // Extract <line> → convert to path
  const lineRegex = /<line\s+([^>]*?)\/?>/gi;
  while ((match = lineRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const x1 = extractAttr(attrs, "x1", 0);
    const y1 = extractAttr(attrs, "y1", 0);
    const x2 = extractAttr(attrs, "x2", 0);
    const y2 = extractAttr(attrs, "y2", 0);

    const d = `M${x1},${y1}L${x2},${y2}`;
    paths.push({ d, fill: false, stroke: true });
  }

  if (paths.length === 0) {
    throw new Error("No renderable elements found in SVG. Expected <path>, <circle>, <rect>, or <line> elements.");
  }

  return {
    viewBox,
    paths,
    hotspot: hotspot ?? { x: 0, y: 0 },
    strokeWidth,
    strokeLinecap,
    strokeLinejoin,
  };
}

function extractAttr(str: string, attr: string, defaultVal: number): number {
  const regex = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`);
  const m = str.match(regex);
  if (!m) return defaultVal;
  const val = parseFloat(m[1]);
  return Number.isNaN(val) ? defaultVal : val;
}

function extractStringAttr(str: string, attr: string, defaultVal: string): string {
  const regex = new RegExp(`${attr}\\s*=\\s*"([^"]+)"`);
  const m = str.match(regex);
  return m ? m[1] : defaultVal;
}
