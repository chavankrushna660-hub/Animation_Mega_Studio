import React, { useRef, useEffect, useCallback, useState } from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing, generateId, getDrawingBoundingBox, isPathClosed, degToRad } from "../utils/helpers";
import { hitTestStroke, hitTestDrawing, canvasToWorld, worldToLocal, localToWorld, getDrawingTransform, getTransformHandles, hitTestHandle } from "../utils/geometry";
import type { Drawing, DrawingStroke, Point, HandleType } from "../types";

interface CanvasState {
  isDrawing: boolean;
  currentDrawingId: string | null;
  isDragging: boolean;
  dragHandle: HandleType | null;
  dragStartX: number;
  dragStartY: number;
  dragStartDrawing: { x: number; y: number; rotation: number; scaleX: number; scaleY: number } | null;
  isPanning: boolean;
  panStartX: number;
  panStartY: number;
  panStartPanX: number;
  panStartPanY: number;
  boneConnectionStart: string | null;
  boneConnectionStartWorld: { x: number; y: number } | null;
  boneLineEndX: number;
  boneLineEndY: number;
  movingPivotId: string | null;
  movingBoneId: string | null;
  lassoPoints: Point[];
  continueDrawingEnd: Point | null;
  shapeStartX: number;
  shapeStartY: number;
  isShapeDrawing: boolean;
}

const AnimationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [csState, setCsState] = useState<CanvasState>({
    isDrawing: false,
    currentDrawingId: null,
    isDragging: false,
    dragHandle: null,
    dragStartX: 0,
    dragStartY: 0,
    dragStartDrawing: null,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartPanX: 0,
    panStartPanY: 0,
    boneConnectionStart: null,
    boneConnectionStartWorld: null,
    boneLineEndX: 0,
    boneLineEndY: 0,
    movingPivotId: null,
    movingBoneId: null,
    lassoPoints: [],
    continueDrawingEnd: null,
    shapeStartX: 0,
    shapeStartY: 0,
    isShapeDrawing: false,
  });

  const csRef = useRef(csState);
  csRef.current = csState;

  const store = useAnimationStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  // Playback engine
  useEffect(() => {
    if (store.isPlaying) {
      const interval = 1000 / store.fps;
      playbackTimerRef.current = setInterval(() => {
        const st = storeRef.current;
        const nextFrame = (st.currentFrameIndex + 1) % st.frames.length;
        st.setCurrentFrame(nextFrame);
      }, interval);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [store.isPlaying, store.fps]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const st = storeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // White canvas background
      ctx.save();
      ctx.fillStyle = "white";
      const cw = st.canvasWidth * st.zoom;
      const ch = st.canvasHeight * st.zoom;
      ctx.shadowColor = "rgba(0,0,0,0.2)";
      ctx.shadowBlur = 10;
      ctx.fillRect(st.panX, st.panY, cw, ch);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Clip to canvas area
      ctx.save();
      ctx.beginPath();
      ctx.rect(st.panX, st.panY, cw, ch);
      ctx.clip();

      // Grid
      if (st.showGrid) {
        renderGrid(ctx, canvas.width, canvas.height, st.zoom, st.panX, st.panY);
      }

      // Onion skinning (not during playback)
      if (st.onionSkinning && !st.isPlaying) {
        for (let i = 1; i <= st.onionPrevFrames; i++) {
          const fi = st.currentFrameIndex - i;
          if (fi >= 0) {
            renderFrameDrawings(ctx, st, fi, 0.25 / i, "red");
          }
        }
        for (let i = 1; i <= st.onionNextFrames; i++) {
          const fi = st.currentFrameIndex + i;
          if (fi < st.frames.length) {
            renderFrameDrawings(ctx, st, fi, 0.25 / i, "blue");
          }
        }
      }

      // Current frame
      renderFrameDrawings(ctx, st, st.currentFrameIndex, 1, undefined);

      // Active drawing stroke being drawn
      const cs = csRef.current;
      if (cs.isDrawing && cs.currentDrawingId) {
        // Already rendered as part of the drawing state
      }

      // Selection box
      if (st.selection.drawingId && !st.isPlaying) {
        const drawing = getEffectiveDrawing(st.drawings, st.frames, st.selection.drawingId, st.currentFrameIndex);
        if (drawing) {
          renderSelectionOverlay(ctx, drawing, st.transformHandleSize, st.zoom, st.panX, st.panY);
          renderPivotOverlay(ctx, drawing, st.transformHandleSize, st.zoom, st.panX, st.panY);
          renderBonesOverlay(ctx, drawing, st.drawings, st.zoom, st.panX, st.panY, cs.boneConnectionStart, { x: cs.boneLineEndX, y: cs.boneLineEndY });
        }
      }

      // Lasso
      if (cs.lassoPoints.length > 1 && st.activeTool === "lasso") {
        ctx.strokeStyle = "#2563EB";
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cs.lassoPoints[0].x, cs.lassoPoints[0].y);
        cs.lassoPoints.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Get canvas pointer from event
  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0 && "changedTouches" in e) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return { cx: clientX - rect.left, cy: clientY - rect.top };
  }, []);

  const getWorldPos = useCallback((cx: number, cy: number) => {
    const st = storeRef.current;
    return canvasToWorld(cx, cy, st.panX, st.panY, st.zoom);
  }, []);

  const hitTestAllDrawings = useCallback((wx: number, wy: number): string | null => {
    const st = storeRef.current;
    // Test in reverse order (topmost first)
    const orderedIds: string[] = [];
    [...st.layers].reverse().forEach((layer) => {
      if (!layer.visible || layer.locked) return;
      [...layer.drawingIds].reverse().forEach((id) => orderedIds.push(id));
    });

    for (const id of orderedIds) {
      const drawing = getEffectiveDrawing(st.drawings, st.frames, id, st.currentFrameIndex);
      if (!drawing || !drawing.visible || drawing.locked) continue;
      if (hitTestStroke(wx, wy, drawing, 10 / st.zoom) || hitTestDrawing(wx, wy, drawing, 5 / st.zoom)) {
        return id;
      }
    }
    return null;
  }, []);

  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const { cx, cy } = getCanvasPos(e);
    const { x: wx, y: wy } = getWorldPos(cx, cy);
    const st = storeRef.current;
    const tool = st.activeTool;
    const selId = st.selection.drawingId;

    // Middle mouse / space+drag = pan
    if ("button" in e && e.button === 1) {
      setCsState((s) => ({ ...s, isPanning: true, panStartX: cx, panStartY: cy, panStartPanX: st.panX, panStartPanY: st.panY }));
      return;
    }

    if (tool === "select") {
      const hitId = hitTestAllDrawings(wx, wy);
      st.handleCanvasClick(hitId, wx, wy);
      return;
    }

    if (tool === "transform" || tool === "move") {
      if (selId) {
        const drawing = getEffectiveDrawing(st.drawings, st.frames, selId, st.currentFrameIndex);
        if (drawing) {
          const handles = getTransformHandles(drawing, st.transformHandleSize / st.zoom);
          const hitHandle = hitTestHandle(wx, wy, handles, st.transformHandleSize / st.zoom);
          if (hitHandle) {
            setCsState((s) => ({
              ...s, isDragging: true, dragHandle: hitHandle.type,
              dragStartX: wx, dragStartY: wy,
              dragStartDrawing: { x: drawing.x, y: drawing.y, rotation: drawing.rotation, scaleX: drawing.scaleX, scaleY: drawing.scaleY },
            }));
            return;
          }
          // Check if inside drawing for move
          if (hitTestStroke(wx, wy, drawing, 10 / st.zoom) || hitTestDrawing(wx, wy, drawing, 5 / st.zoom)) {
            setCsState((s) => ({
              ...s, isDragging: true, dragHandle: "move",
              dragStartX: wx, dragStartY: wy,
              dragStartDrawing: { x: drawing.x, y: drawing.y, rotation: drawing.rotation, scaleX: drawing.scaleX, scaleY: drawing.scaleY },
            }));
            return;
          }
        }
      }
      // Click on different drawing - select it if none selected
      if (!selId) {
        const hitId = hitTestAllDrawings(wx, wy);
        if (hitId) st.handleCanvasClick(hitId, wx, wy);
      }
      return;
    }

    if (tool === "pivot") {
      if (!selId) return;
      const drawing = getEffectiveDrawing(st.drawings, st.frames, selId, st.currentFrameIndex);
      if (!drawing) return;

      // Check if clicking existing pivot (for dragging)
      const t = getDrawingTransform(drawing);
      for (const pivot of drawing.pivotPoints) {
        if (pivot.locked) continue;
        const pw = localToWorld(pivot.x, pivot.y, t);
        if (Math.hypot(wx - pw.x, wy - pw.y) <= (st.transformHandleSize * 0.8) / st.zoom) {
          st.setActivePivot(selId, pivot.id);
          setCsState((s) => ({ ...s, movingPivotId: pivot.id }));
          return;
        }
      }

      // Add new pivot at local coordinates
      const local = worldToLocal(wx, wy, t);
      st.addPivotPoint(selId, local.x, local.y);
      return;
    }

    if (tool === "bone") {
      if (!selId) return;
      const drawing = getEffectiveDrawing(st.drawings, st.frames, selId, st.currentFrameIndex);
      if (!drawing) return;
      const t = getDrawingTransform(drawing);

      // Check if clicking existing bone (for connection dragging)
      for (const bone of drawing.bones) {
        const bw = localToWorld(bone.x, bone.y, t);
        if (Math.hypot(wx - bw.x, wy - bw.y) <= 15 / st.zoom) {
          if (bone.connectionEnabled && csRef.current.boneConnectionStart === null) {
            setCsState((s) => ({
              ...s, boneConnectionStart: bone.id,
              boneConnectionStartWorld: bw,
              boneLineEndX: wx, boneLineEndY: wy,
            }));
          } else if (csRef.current.boneConnectionStart !== null) {
            st.connectBones(csRef.current.boneConnectionStart, bone.id);
            setCsState((s) => ({ ...s, boneConnectionStart: null, boneConnectionStartWorld: null }));
          } else {
            setCsState((s) => ({ ...s, movingBoneId: bone.id }));
          }
          return;
        }
      }

      // If in connection mode, click elsewhere cancels
      if (csRef.current.boneConnectionStart) {
        setCsState((s) => ({ ...s, boneConnectionStart: null, boneConnectionStartWorld: null }));
        return;
      }

      // Add new bone
      const local = worldToLocal(wx, wy, t);
      st.addBone(selId, local.x, local.y);
      return;
    }

    if (tool === "fill") {
      if (!selId) return;
      const drawing = getEffectiveDrawing(st.drawings, st.frames, selId, st.currentFrameIndex);
      if (!drawing) return;
      const t = getDrawingTransform(drawing);
      const local = worldToLocal(wx, wy, t);
      st.fillColorRegion(selId, local.x, local.y);
      return;
    }

    if (tool === "eyedropper") {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const pixel = ctx.getImageData(cx, cy, 1, 1).data;
      const hex = `#${pixel[0].toString(16).padStart(2, "0")}${pixel[1].toString(16).padStart(2, "0")}${pixel[2].toString(16).padStart(2, "0")}`;
      st.setStrokeColor(hex);
      st.setActiveTool(st.previousTool ?? "pen");
      return;
    }

    if (tool === "mirror") {
      if (selId) st.mirrorDrawing(selId, true);
      return;
    }

    if (tool === "addColorLine") {
      if (!selId) return;
      st.addColorLine(selId, true);
      return;
    }

    if (tool === "lasso") {
      setCsState((s) => ({ ...s, isDrawing: true, lassoPoints: [{ x: cx, y: cy }] }));
      return;
    }

    // Shape tools
    if (["rect", "circle", "triangle", "line"].includes(tool)) {
      if (selId) return; // Don't draw if something selected (unless you explicitly want to)
      setCsState((s) => ({ ...s, isShapeDrawing: true, shapeStartX: wx, shapeStartY: wy }));
      return;
    }

    // Text tool
    if (tool === "text") {
      const text = prompt("Enter text:") ?? "";
      if (!text) return;
      const drawingId = st.addDrawing({
        name: `Text: ${text.slice(0, 10)}`,
        text,
        fontSize: 24,
        x: wx,
        y: wy,
        strokeColor: st.strokeColor,
        fillColor: null,
        strokes: [],
      });
      st.selectDrawing(drawingId);
      return;
    }

    // Drawing tools - only if no drawing selected OR drawing is selected (draw on it)
    if (["pen", "brush", "eraser", "paintBrush", "continuesDraw"].includes(tool)) {
      if (selId) {
        // Drawing is selected - tools apply to it (EXCEPT when selection is active, we don't draw unless unselected)
        // Per requirements: jabtak drawing selected hai, draw nahi hoga
        return;
      }

      // Create new drawing or add stroke to existing
      let drawingId = csRef.current.currentDrawingId;

      // Continues drawing mode - continue from last endpoint
      if (tool === "continuesDraw" && csRef.current.continueDrawingEnd) {
        const lastEnd = csRef.current.continueDrawingEnd;
        const dId = st.addDrawing({
          name: `Drawing ${Object.keys(st.drawings).length + 1}`,
          strokes: [],
          strokeColor: st.strokeColor,
          strokeWidth: st.strokeWidth,
          fillColor: null,
          x: 0, y: 0,
        });
        const strokeId = generateId();
        st.addStroke(dId, {
          id: strokeId,
          points: [lastEnd, getWorldPos(cx, cy)],
          color: st.strokeColor,
          width: st.strokeWidth,
          opacity: st.brushOpacity,
          tool: "pen",
        });
        setCsState((s) => ({ ...s, isDrawing: true, currentDrawingId: dId }));
        return;
      }

      // Start new drawing
      const newDrawingId = st.addDrawing({
        name: `Drawing ${Object.keys(st.drawings).length + 1}`,
        strokes: [],
        strokeColor: st.strokeColor,
        strokeWidth: st.strokeWidth,
        fillColor: st.fillColor,
        x: 0, y: 0,
      });
      const strokeId = generateId();
      const pos = getWorldPos(cx, cy);
      st.addStroke(newDrawingId, {
        id: strokeId,
        points: [pos],
        color: st.strokeColor,
        width: tool === "brush" ? st.strokeWidth * 2.5 : st.strokeWidth,
        opacity: st.brushOpacity,
        tool: tool === "eraser" ? "eraser" : tool === "brush" ? "brush" : "pen",
      });
      setCsState((s) => ({ ...s, isDrawing: true, currentDrawingId: newDrawingId }));
      return;
    }
  }, [getCanvasPos, getWorldPos, hitTestAllDrawings]);

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const { cx, cy } = getCanvasPos(e);
    const { x: wx, y: wy } = getWorldPos(cx, cy);
    const st = storeRef.current;
    const cs = csRef.current;

    // Pan
    if (cs.isPanning) {
      const dx = cx - cs.panStartX;
      const dy = cy - cs.panStartY;
      st.setPan(cs.panStartPanX + dx, cs.panStartPanY + dy);
      return;
    }

    // Bone connection line preview
    if (cs.boneConnectionStart) {
      setCsState((s) => ({ ...s, boneLineEndX: wx, boneLineEndY: wy }));
    }

    // Moving pivot
    if (cs.movingPivotId && st.selection.drawingId) {
      const drawing = getEffectiveDrawing(st.drawings, st.frames, st.selection.drawingId, st.currentFrameIndex);
      if (drawing) {
        const t = getDrawingTransform(drawing);
        const local = worldToLocal(wx, wy, t);
        const pivot = drawing.pivotPoints.find((p) => p.id === cs.movingPivotId);
        if (pivot && !pivot.locked) {
          st.updatePivotPoint(st.selection.drawingId, cs.movingPivotId, { x: local.x, y: local.y });
        }
      }
      return;
    }

    // Moving bone
    if (cs.movingBoneId && st.selection.drawingId) {
      const drawing = getEffectiveDrawing(st.drawings, st.frames, st.selection.drawingId, st.currentFrameIndex);
      if (drawing) {
        const t = getDrawingTransform(drawing);
        const local = worldToLocal(wx, wy, t);
        st.updateBone(st.selection.drawingId, cs.movingBoneId, { x: local.x, y: local.y });
      }
      return;
    }

    // Transform drag
    if (cs.isDragging && st.selection.drawingId && cs.dragStartDrawing) {
      const drawing = getEffectiveDrawing(st.drawings, st.frames, st.selection.drawingId, st.currentFrameIndex);
      if (!drawing) return;

      const dx = wx - cs.dragStartX;
      const dy = wy - cs.dragStartY;

      if (cs.dragHandle === "move") {
        st.setDrawingTransform(
          st.selection.drawingId,
          cs.dragStartDrawing.x + dx,
          cs.dragStartDrawing.y + dy,
          drawing.rotation,
          drawing.scaleX,
          drawing.scaleY
        );
        // Move children too
        drawing.childIds.forEach((childId) => {
          const child = st.drawings[childId];
          if (child) {
            const childFrame = st.frames[st.currentFrameIndex]?.drawingStates[childId];
            const baseX = childFrame ? childFrame.x : child.x;
            const baseY = childFrame ? childFrame.y : child.y;
            // Children have been moved relatively since dragStart
          }
        });
      } else if (cs.dragHandle === "rotate") {
        const bb = getDrawingBoundingBox(drawing);
        if (bb) {
          const t = getDrawingTransform(drawing);
          const pivotW = localToWorld(bb.cx, bb.cy, t);
          const angle = Math.atan2(wy - pivotW.y, wx - pivotW.x) * 180 / Math.PI;
          const startAngle = Math.atan2(cs.dragStartY - pivotW.y, cs.dragStartX - pivotW.x) * 180 / Math.PI;
          st.setDrawingTransform(
            st.selection.drawingId,
            drawing.x, drawing.y,
            cs.dragStartDrawing.rotation + (angle - startAngle),
            drawing.scaleX, drawing.scaleY
          );
        }
      } else if (["tl", "tr", "bl", "br", "mt", "mb", "ml", "mr"].includes(cs.dragHandle ?? "")) {
        const bb = getDrawingBoundingBox(drawing);
        if (bb) {
          let newSx = cs.dragStartDrawing.scaleX;
          let newSy = cs.dragStartDrawing.scaleY;
          const w = bb.width || 1;
          const h = bb.height || 1;
          if (["tr", "mr", "br"].includes(cs.dragHandle ?? "")) newSx = cs.dragStartDrawing.scaleX + dx / w;
          if (["tl", "ml", "bl"].includes(cs.dragHandle ?? "")) newSx = cs.dragStartDrawing.scaleX - dx / w;
          if (["bl", "mb", "br"].includes(cs.dragHandle ?? "")) newSy = cs.dragStartDrawing.scaleY + dy / h;
          if (["tl", "mt", "tr"].includes(cs.dragHandle ?? "")) newSy = cs.dragStartDrawing.scaleY - dy / h;
          st.setDrawingTransform(
            st.selection.drawingId,
            drawing.x, drawing.y,
            drawing.rotation,
            Math.max(0.05, newSx),
            Math.max(0.05, newSy)
          );
        }
      }
      return;
    }

    // Shape drawing
    if (cs.isShapeDrawing && ["rect", "circle", "triangle", "line"].includes(st.activeTool)) {
      // Will finalize on pointerUp
      return;
    }

    // Lasso
    if (cs.isDrawing && st.activeTool === "lasso") {
      setCsState((s) => ({ ...s, lassoPoints: [...s.lassoPoints, { x: cx, y: cy }] }));
      return;
    }

    // Free drawing
    if (cs.isDrawing && cs.currentDrawingId) {
      const pos = getWorldPos(cx, cy);
      const drawing = st.drawings[cs.currentDrawingId];
      if (!drawing || drawing.strokes.length === 0) return;
      const lastStroke = drawing.strokes[drawing.strokes.length - 1];
      const newPoints = [...lastStroke.points, pos];
      st.updateLastStroke(cs.currentDrawingId, newPoints);
    }
  }, [getCanvasPos, getWorldPos]);

  const onPointerUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const { cx, cy } = getCanvasPos(e);
    const { x: wx, y: wy } = getWorldPos(cx, cy);
    const st = storeRef.current;
    const cs = csRef.current;

    if (cs.isPanning) {
      setCsState((s) => ({ ...s, isPanning: false }));
      return;
    }

    if (cs.isDragging) {
      setCsState((s) => ({ ...s, isDragging: false, dragHandle: null, dragStartDrawing: null }));
      // Move children along with parent
      if (st.selection.drawingId) {
        const drawing = getEffectiveDrawing(st.drawings, st.frames, st.selection.drawingId, st.currentFrameIndex);
        if (drawing && cs.dragHandle === "move" && cs.dragStartDrawing) {
          const dx = drawing.x - cs.dragStartDrawing.x;
          const dy = drawing.y - cs.dragStartDrawing.y;
          drawing.childIds.forEach((childId) => {
            const child = getEffectiveDrawing(st.drawings, st.frames, childId, st.currentFrameIndex);
            if (child) {
              st.setDrawingTransform(childId, child.x + dx, child.y + dy, child.rotation, child.scaleX, child.scaleY);
            }
          });
        }
      }
      return;
    }

    if (cs.movingPivotId) {
      setCsState((s) => ({ ...s, movingPivotId: null }));
      return;
    }
    if (cs.movingBoneId) {
      setCsState((s) => ({ ...s, movingBoneId: null }));
      return;
    }

    // Shape drawing finalize
    if (cs.isShapeDrawing) {
      const tool = st.activeTool as "rect" | "circle" | "triangle" | "line";
      const sx = cs.shapeStartX;
      const sy = cs.shapeStartY;
      const w = wx - sx;
      const h = wy - sy;
      if (Math.abs(w) > 5 || Math.abs(h) > 5) {
        const drawingId = st.addDrawing({
          name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} ${Object.keys(st.drawings).length + 1}`,
          shapeType: tool,
          shapeData: tool === "line"
            ? { x: Math.min(sx, wx), y: Math.min(sy, wy), width: Math.abs(w), height: Math.abs(h), x1: sx, y1: sy, x2: wx, y2: wy }
            : { x: Math.min(sx, wx), y: Math.min(sy, wy), width: Math.abs(w), height: Math.abs(h) },
          strokeColor: st.strokeColor,
          strokeWidth: st.strokeWidth,
          fillColor: st.fillColor,
          strokes: [],
          x: 0, y: 0,
        });
        st.selectDrawing(drawingId);
      }
      setCsState((s) => ({ ...s, isShapeDrawing: false }));
      return;
    }

    // Lasso finalize
    if (cs.isDrawing && st.activeTool === "lasso") {
      setCsState((s) => ({ ...s, isDrawing: false, lassoPoints: [] }));
      return;
    }

    // Drawing finalize
    if (cs.isDrawing && cs.currentDrawingId) {
      const drawing = st.drawings[cs.currentDrawingId];
      const lastEnd = drawing?.strokes[drawing.strokes.length - 1]?.points.slice(-1)[0];
      setCsState((s) => ({
        ...s,
        isDrawing: false,
        currentDrawingId: null,
        continueDrawingEnd: lastEnd ?? null,
      }));
    }
  }, [getCanvasPos, getWorldPos]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const st = storeRef.current;
    const { cx, cy } = { cx: e.clientX - canvasRef.current!.getBoundingClientRect().left, cy: e.clientY - canvasRef.current!.getBoundingClientRect().top };
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, st.zoom * zoomFactor));
    const newPanX = cx - (cx - st.panX) * (newZoom / st.zoom);
    const newPanY = cy - (cy - st.panY) * (newZoom / st.zoom);
    st.setZoom(newZoom);
    st.setPan(newPanX, newPanY);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none"
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
      onWheel={handleWheel}
      style={{ cursor: getCursor(store.activeTool, store.selection.drawingId) }}
    />
  );
};

function getCursor(tool: string, selectedId: string | null): string {
  if (tool === "select") return "default";
  if (tool === "transform" || tool === "move") return selectedId ? "move" : "default";
  if (tool === "pivot") return "crosshair";
  if (tool === "bone") return "cell";
  if (tool === "eraser") return "cell";
  if (tool === "eyedropper") return "crosshair";
  if (["pen", "brush", "paintBrush", "continuesDraw"].includes(tool)) return selectedId ? "not-allowed" : "crosshair";
  return "crosshair";
}

// Render helpers
function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const gridSize = 50 * zoom;
  const ox = panX % gridSize;
  const oy = panY % gridSize;
  ctx.save();
  ctx.strokeStyle = "rgba(200,200,200,0.4)";
  ctx.lineWidth = 0.5;
  for (let x = ox; x <= width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = oy; y <= height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.restore();
}

function renderFrameDrawings(
  ctx: CanvasRenderingContext2D,
  st: ReturnType<typeof useAnimationStore.getState>,
  frameIndex: number,
  opacity: number,
  tint?: "red" | "blue"
) {
  const orderedIds: string[] = [];
  st.layers.forEach((layer) => {
    if (!layer.visible) return;
    layer.drawingIds.forEach((id) => orderedIds.push(id));
  });

  for (const id of orderedIds) {
    const drawing = getEffectiveDrawing(st.drawings, st.frames, id, frameIndex);
    if (!drawing || !drawing.visible) continue;

    ctx.save();
    ctx.globalAlpha = opacity * drawing.opacity;

    ctx.translate(st.panX, st.panY);
    ctx.scale(st.zoom, st.zoom);

    renderSingleDrawing(ctx, drawing, tint);
    ctx.restore();
  }
}

function renderSingleDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  tint?: "red" | "blue"
) {
  const t = getDrawingTransform(drawing);

  ctx.save();
  ctx.translate(t.x + t.pivotX, t.y + t.pivotY);
  ctx.rotate(degToRad(t.rotation));
  ctx.scale(t.scaleX, t.scaleY);
  ctx.translate(-t.pivotX, -t.pivotY);

  if (tint) {
    ctx.filter = tint === "red"
      ? "sepia(1) saturate(3) hue-rotate(300deg) opacity(0.7)"
      : "sepia(1) saturate(3) hue-rotate(180deg) opacity(0.7)";
  }

  // Shape
  if (drawing.shapeType && drawing.shapeData) {
    const d = drawing.shapeData;
    ctx.strokeStyle = drawing.strokeColor;
    ctx.lineWidth = drawing.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    switch (drawing.shapeType) {
      case "rect":
        ctx.rect(d.x, d.y, d.width, d.height);
        break;
      case "circle": {
        const rx = d.width / 2, ry = d.height / 2;
        ctx.ellipse(d.x + rx, d.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        break;
      }
      case "triangle":
        ctx.moveTo(d.x + d.width / 2, d.y);
        ctx.lineTo(d.x + d.width, d.y + d.height);
        ctx.lineTo(d.x, d.y + d.height);
        ctx.closePath();
        break;
      case "line":
        if (d.x1 !== undefined) { ctx.moveTo(d.x1, d.y1!); ctx.lineTo(d.x2!, d.y2!); }
        break;
    }
    if (drawing.fillColor && drawing.shapeType !== "line") {
      ctx.fillStyle = drawing.fillColor;
      ctx.globalAlpha *= drawing.fillOpacity;
      ctx.fill();
    }
    ctx.stroke();
  }

  // Strokes
  for (const stroke of drawing.strokes) {
    if (stroke.fillRegion) {
      ctx.fillStyle = stroke.fillRegion.color;
      ctx.beginPath();
      ctx.arc(stroke.points[0]?.x ?? 0, stroke.points[0]?.y ?? 0, 3, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (stroke.tool === "eraser") ctx.globalCompositeOperation = "destination-out";

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
    } else if (stroke.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const mx = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const my = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, mx, my);
      }
      ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
      ctx.stroke();

      // Fill closed path
      if (isStrokeClosed(stroke.points, drawing.fillColor ?? null)) {
        if (drawing.fillColor) {
          ctx.fillStyle = drawing.fillColor;
          ctx.globalAlpha *= drawing.fillOpacity;
          ctx.fill();
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  // Text
  if (drawing.text) {
    ctx.font = `${drawing.fontSize ?? 24}px ${drawing.fontFamily ?? "sans-serif"}`;
    ctx.fillStyle = drawing.strokeColor;
    ctx.fillText(drawing.text, 0, 0);
  }

  ctx.restore();
}

function isStrokeClosed(points: Point[], fillColor: string | null): boolean {
  if (!fillColor || points.length < 3) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) <= 20;
}

function renderSelectionOverlay(
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
  const hs = handleSize / zoom;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  const corners = [
    { x: bb.minX, y: bb.minY }, { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY }, { x: bb.minX, y: bb.maxY },
  ].map((c) => localToWorld(c.x, c.y, t));

  // Bounding box
  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([5 / zoom, 3 / zoom]);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  corners.forEach((c) => ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Handles
  const hPoints = [
    localToWorld(bb.minX, bb.minY, t),
    localToWorld(bb.maxX, bb.minY, t),
    localToWorld(bb.minX, bb.maxY, t),
    localToWorld(bb.maxX, bb.maxY, t),
    localToWorld(bb.cx, bb.minY, t),
    localToWorld(bb.cx, bb.maxY, t),
    localToWorld(bb.minX, bb.cy, t),
    localToWorld(bb.maxX, bb.cy, t),
  ];
  hPoints.forEach((p) => {
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.rect(p.x - hs / 2, p.y - hs / 2, hs, hs);
    ctx.fill();
    ctx.stroke();
  });

  // Rotation handle
  const topCenter = localToWorld(bb.cx, bb.minY, t);
  const rotHandle = localToWorld(bb.cx, bb.minY - handleSize * 2.5 / zoom, t);
  ctx.strokeStyle = "#2563EB";
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.moveTo(topCenter.x, topCenter.y);
  ctx.lineTo(rotHandle.x, rotHandle.y);
  ctx.stroke();

  ctx.fillStyle = "#22C55E";
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2 / zoom;
  ctx.beginPath();
  ctx.arc(rotHandle.x, rotHandle.y, hs / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function renderPivotOverlay(
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
    const w = localToWorld(pivot.x, pivot.y, t);
    const isActive = pivot.id === drawing.activePivotId;
    const color = pivot.locked ? "#888" : (isActive ? "#FF0000" : "#FF6666");

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(w.x - ps, w.y); ctx.lineTo(w.x + ps, w.y);
    ctx.moveTo(w.x, w.y - ps); ctx.lineTo(w.x, w.y + ps);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(255,68,68,0.15)";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(w.x, w.y, ps * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `bold ${11 / zoom}px sans-serif`;
    ctx.fillText(pivot.name + (pivot.locked ? " 🔒" : ""), w.x + ps + 3 / zoom, w.y - 2 / zoom);
  });

  ctx.restore();
}

function renderBonesOverlay(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  allDrawings: { [id: string]: Drawing },
  zoom: number,
  panX: number,
  panY: number,
  boneConnectionStart: string | null,
  boneLineEnd: { x: number; y: number }
) {
  const t = getDrawingTransform(drawing);
  const bs = 14 / zoom;

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  drawing.bones.forEach((bone) => {
    const w = localToWorld(bone.x, bone.y, t);

    // Draw connection line to target
    if (bone.connectedToBoneId) {
      Object.values(allDrawings).forEach((d) => {
        const tb = d.bones.find((b) => b.id === bone.connectedToBoneId);
        if (tb) {
          const tt = getDrawingTransform(d);
          const tw = localToWorld(tb.x, tb.y, tt);
          ctx.strokeStyle = "#FBBF24";
          ctx.lineWidth = 3 / zoom;
          ctx.setLineDash([6 / zoom, 3 / zoom]);
          ctx.beginPath();
          ctx.moveTo(w.x, w.y);
          ctx.lineTo(tw.x, tw.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    // Draw bone dot
    const isConnSrc = bone.id === boneConnectionStart;
    ctx.fillStyle = isConnSrc ? "#F59E0B" : (bone.connectionEnabled ? "#3B82F6" : "#93C5FD");
    ctx.strokeStyle = "#1D4ED8";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(w.x, w.y, bs / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1E40AF";
    ctx.font = `${10 / zoom}px sans-serif`;
    ctx.fillText(bone.name, w.x + bs / 2 + 2 / zoom, w.y - 2 / zoom);
  });

  // Connection line being drawn
  if (boneConnectionStart) {
    const srcBone = drawing.bones.find((b) => b.id === boneConnectionStart);
    if (srcBone) {
      const sw = localToWorld(srcBone.x, srcBone.y, t);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 2 / zoom]);
      ctx.beginPath();
      ctx.moveTo(sw.x, sw.y);
      ctx.lineTo(boneLineEnd.x, boneLineEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

export default AnimationCanvas;
