export interface CursorShapePath {
  d: string;
  fill?: boolean;
  stroke?: boolean;
}

export interface CursorShape {
  viewBox: [number, number, number, number];
  paths: CursorShapePath[];
  hotspot: { x: number; y: number };
  strokeWidth: number;
  strokeLinecap: "round" | "butt" | "square";
  strokeLinejoin: "round" | "bevel" | "miter";
}

/**
 * Built-in cursor shapes derived from Lucide icon SVG paths.
 *
 * pointer     — mouse-pointer-2 (filled arrow)
 * pointer-alt — mouse-pointer (arrow with line)
 * hand        — pointer (hand/finger)
 * dot         — simple filled circle
 */
export const CURSOR_SHAPES: Record<string, CursorShape> = {
  pointer: {
    viewBox: [0, 0, 24, 24],
    paths: [
      {
        d: "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z",
        fill: true,
        stroke: true,
      },
    ],
    hotspot: { x: 0.17, y: 0.2 },
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },

  "pointer-alt": {
    viewBox: [0, 0, 24, 24],
    paths: [
      {
        d: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z",
        fill: true,
        stroke: true,
      },
      {
        d: "M13 13l6 6",
        fill: false,
        stroke: true,
      },
    ],
    hotspot: { x: 0.125, y: 0.125 },
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },

  hand: {
    viewBox: [0, 0, 24, 24],
    paths: [
      { d: "M14 4.1L12 6", fill: false, stroke: true },
      { d: "M5.1 8l-2.9-.8", fill: false, stroke: true },
      { d: "M6 12l-1.9 2", fill: false, stroke: true },
      { d: "M7.2 2.2L8 5.1", fill: false, stroke: true },
      {
        d: "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a2 2 0 0 0-1.434 1.434l-1.041 4.349a.5.5 0 0 1-.95.074z",
        fill: true,
        stroke: true,
      },
    ],
    hotspot: { x: 0.38, y: 0.4 },
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },

  dot: {
    viewBox: [0, 0, 24, 24],
    paths: [
      {
        // Circle centered at (12,12) with radius 8
        d: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z",
        fill: true,
        stroke: false,
      },
    ],
    hotspot: { x: 0.5, y: 0.5 },
    strokeWidth: 0,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
};

export function getCursorShape(style: string): CursorShape {
  return CURSOR_SHAPES[style] ?? CURSOR_SHAPES.pointer;
}
