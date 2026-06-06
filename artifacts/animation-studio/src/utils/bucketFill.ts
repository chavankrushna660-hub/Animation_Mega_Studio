import type { Drawing, DrawingStroke, Point } from "../types";

export interface BucketFillTarget {
  kind: "shape" | "stroke" | "open";
  stroke?: DrawingStroke;
}

const CLOSED_PATH_THRESHOLD = 22;

export function isStrokeClosed(stroke: DrawingStroke, threshold = CLOSED_PATH_THRESHOLD): boolean {
  if (stroke.points.length < 3) return false;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) <= Math.max(threshold, stroke.width * 2 + 8);
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInShape(drawing: Drawing, point: Point): boolean {
  if (!drawing.shapeType || !drawing.shapeData || drawing.shapeType === "line") return false;
  const d = drawing.shapeData;
  if (drawing.shapeType === "rect") {
    const minX = Math.min(d.x, d.x + d.width);
    const maxX = Math.max(d.x, d.x + d.width);
    const minY = Math.min(d.y, d.y + d.height);
    const maxY = Math.max(d.y, d.y + d.height);
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }
  if (drawing.shapeType === "circle") {
    const rx = Math.abs(d.width / 2);
    const ry = Math.abs(d.height / 2);
    if (rx <= 0 || ry <= 0) return false;
    const cx = d.x + d.width / 2;
    const cy = d.y + d.height / 2;
    const nx = (point.x - cx) / rx;
    const ny = (point.y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (drawing.shapeType === "triangle") {
    return pointInPolygon(point, [
      { x: d.x + d.width / 2, y: d.y },
      { x: d.x + d.width, y: d.y + d.height },
      { x: d.x, y: d.y + d.height },
    ]);
  }
  return false;
}

export function findBucketFillTarget(drawing: Drawing, localPoint: Point): BucketFillTarget {
  if (pointInShape(drawing, localPoint)) return { kind: "shape" };

  // Check top-most/newest closed strokes first so a small closed region inside a drawing
  // receives the fill instead of an older larger path behind it.
  for (let i = drawing.strokes.length - 1; i >= 0; i--) {
    const stroke = drawing.strokes[i];
    if (stroke.fillRegion || stroke.tool === "eraser") continue;
    if (isStrokeClosed(stroke) && pointInPolygon(localPoint, stroke.points)) {
      return { kind: "stroke", stroke };
    }
  }

  return { kind: "open" };
}

export function makeFillStroke(sourceStroke: DrawingStroke, color: string, opacity: number): DrawingStroke {
  return {
    id: `fill_${sourceStroke.id}_${Date.now().toString(36)}`,
    points: sourceStroke.points.map((point) => ({ x: point.x, y: point.y })),
    color,
    width: 0,
    opacity,
    tool: "pen",
    fillRegion: { color, opacity },
  };
}

export function removeExistingFillAtPoint(strokes: DrawingStroke[], localPoint: Point): DrawingStroke[] {
  return strokes.filter((stroke) => {
    if (!stroke.fillRegion || stroke.points.length < 3) return true;
    return !pointInPolygon(localPoint, stroke.points);
  });
}
