import type { Drawing, TransformHandle, HandleType } from "../types";
import { getDrawingBoundingBox, degToRad } from "./helpers";

export interface WorldTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  pivotX: number;
  pivotY: number;
}

/** Transform a local-space point to world space */
export function localToWorld(lx: number, ly: number, t: WorldTransform): { x: number; y: number } {
  const rad = degToRad(t.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = (lx - t.pivotX) * t.scaleX;
  const sy = (ly - t.pivotY) * t.scaleY;
  return {
    x: t.x + t.pivotX + sx * cos - sy * sin,
    y: t.y + t.pivotY + sx * sin + sy * cos,
  };
}

/** Transform a world-space point to local space */
export function worldToLocal(wx: number, wy: number, t: WorldTransform): { x: number; y: number } {
  const rad = degToRad(-t.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = wx - t.x - t.pivotX;
  const dy = wy - t.y - t.pivotY;
  return {
    x: (dx * cos - dy * sin) / t.scaleX + t.pivotX,
    y: (dx * sin + dy * cos) / t.scaleY + t.pivotY,
  };
}

export function getDrawingTransform(drawing: Drawing): WorldTransform {
  return {
    x: drawing.x,
    y: drawing.y,
    rotation: drawing.rotation,
    scaleX: drawing.scaleX,
    scaleY: drawing.scaleY,
    pivotX: drawing.pivot.x,
    pivotY: drawing.pivot.y,
  };
}

/** Get transform handle positions in world space */
export function getTransformHandles(
  drawing: Drawing,
  handleSize: number
): TransformHandle[] {
  const bb = getDrawingBoundingBox(drawing);
  if (!bb) return [];

  const t = getDrawingTransform(drawing);
  const handles: { type: HandleType; lx: number; ly: number }[] = [
    { type: "tl", lx: bb.minX, ly: bb.minY },
    { type: "tr", lx: bb.maxX, ly: bb.minY },
    { type: "bl", lx: bb.minX, ly: bb.maxY },
    { type: "br", lx: bb.maxX, ly: bb.maxY },
    { type: "mt", lx: bb.cx, ly: bb.minY },
    { type: "mb", lx: bb.cx, ly: bb.maxY },
    { type: "ml", lx: bb.minX, ly: bb.cy },
    { type: "mr", lx: bb.maxX, ly: bb.cy },
    { type: "rotate", lx: bb.cx, ly: bb.minY - handleSize * 2.5 },
  ];

  return handles.map(({ type, lx, ly }) => {
    const w = localToWorld(lx, ly, t);
    return { type, x: w.x, y: w.y };
  });
}

/** Check if a world-space point hits a handle */
export function hitTestHandle(
  wx: number,
  wy: number,
  handles: TransformHandle[],
  hitRadius: number
): TransformHandle | null {
  for (const h of handles) {
    if (Math.hypot(wx - h.x, wy - h.y) <= hitRadius) return h;
  }
  return null;
}

/** Hit test if a world point is inside a drawing's bounding box */
export function hitTestDrawing(wx: number, wy: number, drawing: Drawing, padding = 8): boolean {
  const bb = getDrawingBoundingBox(drawing);
  if (!bb) return false;
  const t = getDrawingTransform(drawing);
  const local = worldToLocal(wx, wy, t);
  return (
    local.x >= bb.minX - padding &&
    local.x <= bb.maxX + padding &&
    local.y >= bb.minY - padding &&
    local.y <= bb.maxY + padding
  );
}

/** Hit test a stroke path */
export function hitTestStroke(
  wx: number,
  wy: number,
  drawing: Drawing,
  threshold = 10
): boolean {
  const t = getDrawingTransform(drawing);
  const local = worldToLocal(wx, wy, t);

  for (const stroke of drawing.strokes) {
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      const dist = distToSegment(local.x, local.y, p1.x, p1.y, p2.x, p2.y);
      if (dist <= threshold + stroke.width / 2) return true;
    }
    if (stroke.points.length === 1) {
      const dist = Math.hypot(local.x - stroke.points[0].x, local.y - stroke.points[0].y);
      if (dist <= threshold + stroke.width / 2) return true;
    }
  }

  // Shape hit test
  if (drawing.shapeType && drawing.shapeData) {
    const d = drawing.shapeData;
    if (drawing.shapeType === "rect") {
      return (
        local.x >= d.x - threshold &&
        local.x <= d.x + d.width + threshold &&
        local.y >= d.y - threshold &&
        local.y <= d.y + d.height + threshold
      );
    }
    if (drawing.shapeType === "circle") {
      const rx = d.width / 2;
      const ry = d.height / 2;
      const cx = d.x + rx;
      const cy = d.y + ry;
      const nx = (local.x - cx) / rx;
      const ny = (local.y - cy) / ry;
      return Math.sqrt(nx * nx + ny * ny) <= 1 + threshold / Math.min(rx, ry);
    }
    if (drawing.shapeType === "line" && d.x1 !== undefined && d.y1 !== undefined && d.x2 !== undefined && d.y2 !== undefined) {
      return distToSegment(local.x, local.y, d.x1, d.y1, d.x2, d.y2) <= threshold;
    }
    if (drawing.shapeType === "triangle") {
      return (
        local.x >= d.x - threshold &&
        local.x <= d.x + d.width + threshold &&
        local.y >= d.y - threshold &&
        local.y <= d.y + d.height + threshold
      );
    }
  }

  // Text hit test
  if (drawing.text && drawing.text.length > 0) {
    const fontSize = drawing.fontSize ?? 24;
    const w = drawing.text.length * fontSize * 0.6;
    return local.x >= -threshold && local.x <= w + threshold &&
      local.y >= -(fontSize + threshold) && local.y <= threshold + 10;
  }

  return false;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Canvas coordinates to world coordinates */
export function canvasToWorld(
  cx: number,
  cy: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: (cx - panX) / zoom,
    y: (cy - panY) / zoom,
  };
}

/** World coordinates to canvas coordinates */
export function worldToCanvas(
  wx: number,
  wy: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: wx * zoom + panX,
    y: wy * zoom + panY,
  };
}
