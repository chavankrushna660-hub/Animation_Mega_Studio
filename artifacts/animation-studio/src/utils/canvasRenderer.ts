import type { Drawing, AnimationFrame, Layer, AppState, DrawingStroke } from "../types";
import { getEffectiveDrawing, getDrawingBoundingBox } from "./helpers";
import { localToWorld, getDrawingTransform } from "./geometry";
import { degToRad } from "./helpers";

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: AppState,
  frameIndex: number,
  options: {
    isOnionSkin?: boolean;
    onionOpacity?: number;
    onionTint?: "blue" | "red";
    selectedId?: string | null;
    handleSize?: number;
    zoom?: number;
    panX?: number;
    panY?: number;
  } = {}
) {
  const { drawings, layers, frames } = state;
  const isOnionSkin = options.isOnionSkin ?? false;
  const onionOpacity = options.onionOpacity ?? 0.3;
  const zoom = options.zoom ?? 1;
  const panX = options.panX ?? 0;
  const panY = options.panY ?? 0;

  // Build ordered drawing list from layers
  const orderedIds: string[] = [];
  layers.forEach((layer) => {
    if (!layer.visible) return;
    layer.drawingIds.forEach((id) => orderedIds.push(id));
  });

  for (const id of orderedIds) {
    const drawing = getEffectiveDrawing(drawings, frames, id, frameIndex);
    if (!drawing || !drawing.visible) continue;

    const globalAlpha = isOnionSkin ? onionOpacity : drawing.opacity;

    ctx.save();
    ctx.globalAlpha = globalAlpha;

    // Apply view transform
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    renderDrawing(ctx, drawing, state.fillColor, isOnionSkin, options.onionTint);

    ctx.restore();
  }
}

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  _globalFillColor: string,
  isOnionSkin = false,
  onionTint?: "blue" | "red"
) {
  const t = getDrawingTransform(drawing);

  ctx.save();
  // Move to drawing position
  ctx.translate(t.x + t.pivotX, t.y + t.pivotY);
  ctx.rotate(degToRad(t.rotation));
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.pivotX, -t.pivotY);

  // Apply onion skin tint
  if (isOnionSkin && onionTint) {
    ctx.filter = onionTint === "red" ? "sepia(1) saturate(5) hue-rotate(300deg)" : "sepia(1) saturate(5) hue-rotate(180deg)";
  }

  // Draw shape
  if (drawing.shapeType && drawing.shapeData) {
    renderShape(ctx, drawing);
  }

  // Draw strokes
  for (const stroke of drawing.strokes) {
    renderStroke(ctx, stroke, drawing);
  }

  // Draw text
  if (drawing.text) {
    ctx.font = `${drawing.fontSize ?? 24}px ${drawing.fontFamily ?? "sans-serif"}`;
    ctx.fillStyle = drawing.strokeColor;
    ctx.fillText(drawing.text, 0, 0);
  }

  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, drawing: Drawing) {
  if (stroke.points.length === 0) return;

  // Fill region (flood fill result)
  if (stroke.fillRegion) {
    ctx.fillStyle = stroke.fillRegion.color;
    ctx.globalAlpha *= stroke.fillRegion.opacity;
    ctx.beginPath();
    if (stroke.points.length > 0) {
      ctx.arc(stroke.points[0].x, stroke.points[0].y, 3, 0, Math.PI * 2);
    }
    ctx.fill();
    return;
  }

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
  }

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha *= stroke.opacity;

  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const mx = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const my = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mx, my);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  // Fill closed paths
  if (isStrokeClosed(stroke, 15) && drawing.fillColor) {
    ctx.fillStyle = drawing.fillColor;
    ctx.globalAlpha *= drawing.fillOpacity;
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

function isStrokeClosed(stroke: DrawingStroke, threshold: number): boolean {
  if (stroke.points.length < 3) return false;
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) <= threshold;
}

function renderShape(ctx: CanvasRenderingContext2D, drawing: Drawing) {
  const d = drawing.shapeData!;
  ctx.strokeStyle = drawing.strokeColor;
  ctx.lineWidth = drawing.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (drawing.fillColor) {
    ctx.fillStyle = drawing.fillColor;
    ctx.globalAlpha *= drawing.fillOpacity;
  }

  ctx.beginPath();

  switch (drawing.shapeType) {
    case "rect":
      ctx.rect(d.x, d.y, d.width, d.height);
      break;
    case "circle": {
      const rx = d.width / 2;
      const ry = d.height / 2;
      ctx.ellipse(d.x + rx, d.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      break;
    }
    case "triangle": {
      ctx.moveTo(d.x + d.width / 2, d.y);
      ctx.lineTo(d.x + d.width, d.y + d.height);
      ctx.lineTo(d.x, d.y + d.height);
      ctx.closePath();
      break;
    }
    case "line":
      if (d.x1 !== undefined && d.y1 !== undefined && d.x2 !== undefined && d.y2 !== undefined) {
        ctx.moveTo(d.x1, d.y1);
        ctx.lineTo(d.x2, d.y2);
      }
      break;
  }

  if (drawing.fillColor && drawing.shapeType !== "line") {
    ctx.fill();
  }
  ctx.stroke();
}

export function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  handleSize: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const bb = getDrawingBoundingBox(drawing);
  if (!bb) return;

  const t = getDrawingTransform(drawing);
  const rad = degToRad(t.rotation);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // Draw bounding box
  const corners = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ];

  const worldCorners = corners.map((c) => localToWorld(c.x, c.y, t));

  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.beginPath();
  ctx.moveTo(worldCorners[0].x, worldCorners[0].y);
  worldCorners.forEach((c) => ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw handles
  const hs = handleSize / zoom;
  const handlePositions = [
    localToWorld(bb.minX, bb.minY, t),
    localToWorld(bb.maxX, bb.minY, t),
    localToWorld(bb.minX, bb.maxY, t),
    localToWorld(bb.maxX, bb.maxY, t),
    localToWorld(bb.cx, bb.minY, t),
    localToWorld(bb.cx, bb.maxY, t),
    localToWorld(bb.minX, bb.cy, t),
    localToWorld(bb.maxX, bb.cy, t),
  ];

  handlePositions.forEach((p) => {
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.rect(p.x - hs / 2, p.y - hs / 2, hs, hs);
    ctx.fill();
    ctx.stroke();
  });

  // Rotation handle
  const rotHandleLocal = localToWorld(bb.cx, bb.minY - handleSize * 2 / zoom, t);
  const topCenter = localToWorld(bb.cx, bb.minY, t);
  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(rotHandleLocal.x, rotHandleLocal.y);
  ctx.stroke();

  ctx.fillStyle = "#22C55E";
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.arc(rotHandleLocal.x, rotHandleLocal.y, hs / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function renderPivotPoints(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  handleSize: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const t = getDrawingTransform(drawing);
  const ps = handleSize / zoom;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  drawing.pivotPoints.forEach((pivot) => {
    const world = localToWorld(pivot.x, pivot.y, t);
    const isActive = pivot.id === drawing.activePivotId;

    // Cross hair
    ctx.strokeStyle = pivot.locked ? "#888888" : (isActive ? "#FF0000" : "#FF6666");
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(world.x - ps, world.y);
    ctx.lineTo(world.x + ps, world.y);
    ctx.moveTo(world.x, world.y - ps);
    ctx.lineTo(world.x, world.y + ps);
    ctx.stroke();

    // Circle
    ctx.strokeStyle = pivot.locked ? "#888888" : "#FF0000";
    ctx.fillStyle = "rgba(255,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(world.x, world.y, ps * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label
    if (isActive) {
      ctx.fillStyle = "#FF0000";
      ctx.font = `${12 / zoom}px sans-serif`;
      ctx.fillText(pivot.name, world.x + ps + 2 / zoom, world.y - 2 / zoom);
    }
  });

  ctx.restore();
}

export function renderBones(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  allDrawings: { [id: string]: Drawing },
  zoom: number,
  panX: number,
  panY: number
) {
  const t = getDrawingTransform(drawing);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  drawing.bones.forEach((bone) => {
    const world = localToWorld(bone.x, bone.y, t);
    const boneSize = 12 / zoom;

    // Bone dot
    ctx.fillStyle = bone.connectionEnabled ? "#3B82F6" : "#60A5FA";
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(world.x, world.y, boneSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bone name
    ctx.fillStyle = "#1D4ED8";
    ctx.font = `${10 / zoom}px sans-serif`;
    ctx.fillText(bone.name, world.x + boneSize / 2 + 2 / zoom, world.y - 2 / zoom);

    // Draw connection line
    if (bone.connectedToBoneId) {
      // Find target bone
      let targetWorld: { x: number; y: number } | null = null;
      Object.values(allDrawings).forEach((d) => {
        const tb = d.bones.find((b) => b.id === bone.connectedToBoneId);
        if (tb) {
          const tt = getDrawingTransform(d);
          targetWorld = localToWorld(tb.x, tb.y, tt);
        }
      });

      if (targetWorld) {
        ctx.strokeStyle = "#FBBF24";
        ctx.lineWidth = 3 / zoom;
        ctx.setLineDash([6 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.moveTo(world.x, world.y);
        ctx.lineTo((targetWorld as {x:number;y:number}).x, (targetWorld as {x:number;y:number}).y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });

  ctx.restore();
}

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const gridSize = 50 * zoom;
  const offsetX = panX % gridSize;
  const offsetY = panY % gridSize;

  ctx.save();
  ctx.strokeStyle = "rgba(200,200,200,0.4)";
  ctx.lineWidth = 0.5;

  for (let x = offsetX; x <= canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }
  for (let y = offsetY; y <= canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
  ctx.restore();
}
