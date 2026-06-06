import type { Drawing, AnimationFrame, Layer, DrawingStroke } from "../types";

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export function createDefaultLayer(name: string): Layer {
  return {
    id: generateId(),
    name,
    drawingIds: [],
    visible: true,
    locked: false,
    opacity: 1,
  };
}

export function createDefaultFrame(index: number): AnimationFrame {
  return {
    id: generateId(),
    index,
    drawingStates: {},
    thumbnail: undefined,
  };
}

export function createDefaultDrawing(id: string, partial: Partial<Drawing> = {}): Drawing {
  return {
    id,
    name: partial.name ?? "Untitled",
    strokes: partial.strokes ?? [],
    shapeType: partial.shapeType,
    shapeData: partial.shapeData,
    text: partial.text,
    fontSize: partial.fontSize ?? 24,
    fontFamily: partial.fontFamily ?? "sans-serif",
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    rotation: partial.rotation ?? 0,
    scaleX: partial.scaleX ?? 1,
    scaleY: partial.scaleY ?? 1,
    pivot: partial.pivot ?? { x: 0, y: 0 },
    pivotPoints: partial.pivotPoints ?? [],
    activePivotId: partial.activePivotId ?? null,
    strokeColor: partial.strokeColor ?? "#000000",
    strokeWidth: partial.strokeWidth ?? 3,
    fillColor: partial.fillColor ?? null,
    fillOpacity: partial.fillOpacity ?? 1,
    opacity: partial.opacity ?? 1,
    parentId: partial.parentId ?? null,
    childIds: partial.childIds ?? [],
    keepAttachedToId: partial.keepAttachedToId ?? null,
    bones: partial.bones ?? [],
    colorLines: partial.colorLines ?? [],
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    collapsed: partial.collapsed ?? false,
  };
}

export function getEffectiveDrawing(
  drawings: { [id: string]: Drawing },
  frames: AnimationFrame[],
  drawingId: string,
  frameIndex: number
): Drawing | null {
  const drawing = drawings[drawingId];
  if (!drawing) return null;
  const frame = frames[frameIndex];
  if (!frame) return drawing;
  const fs = frame.drawingStates[drawingId];
  if (!fs) return drawing;
  return {
    ...drawing,
    x: fs.x,
    y: fs.y,
    rotation: fs.rotation,
    scaleX: fs.scaleX,
    scaleY: fs.scaleY,
    pivot: fs.pivot,
    visible: fs.visible,
    opacity: fs.opacity,
    strokes: fs.strokes,
    shapeData: fs.shapeData ?? drawing.shapeData,
  };
}

export function isPathClosed(strokes: DrawingStroke[], threshold = 15): boolean {
  for (const stroke of strokes) {
    if (stroke.points.length < 3) continue;
    const first = stroke.points[0];
    const last = stroke.points[stroke.points.length - 1];
    const dist = Math.hypot(last.x - first.x, last.y - first.y);
    if (dist <= threshold) return true;
  }
  return false;
}

export function getDrawingBoundingBox(
  drawing: Drawing
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; cx: number; cy: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasPoints = false;

  if (drawing.shapeType && drawing.shapeData) {
    const d = drawing.shapeData;
    minX = d.x; minY = d.y;
    maxX = d.x + (d.width ?? 0);
    maxY = d.y + (d.height ?? 0);
    hasPoints = true;
  }

  for (const stroke of drawing.strokes) {
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      hasPoints = true;
    }
  }

  if (drawing.text) {
    minX = Math.min(minX, 0);
    minY = Math.min(minY, -(drawing.fontSize ?? 24));
    maxX = Math.max(maxX, (drawing.text.length * (drawing.fontSize ?? 24)) * 0.6);
    maxY = Math.max(maxY, 10);
    hasPoints = true;
  }

  if (!hasPoints) return null;

  const width = maxX - minX;
  const height = maxY - minY;
  return { minX, minY, maxX, maxY, width, height, cx: minX + width / 2, cy: minY + height / 2 };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
