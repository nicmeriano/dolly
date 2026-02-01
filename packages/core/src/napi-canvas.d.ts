declare module "@napi-rs/canvas" {
  export interface Canvas {
    width: number;
    height: number;
    getContext(contextId: "2d"): CanvasRenderingContext2D;
    toBuffer(mimeType: "image/png"): Buffer;
  }

  export function createCanvas(width: number, height: number): Canvas;

  export class Path2D {
    constructor(path?: string | Path2D);
  }
}
