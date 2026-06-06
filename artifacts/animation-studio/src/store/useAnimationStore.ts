import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  AppState,
  Drawing,
  DrawingStroke,
  AnimationFrame,
  Layer,
  PivotPoint,
  Bone,
  ColorLine,
  ToolType,
  Point,
  SelectionState,
} from "../types";
import { generateId, createDefaultFrame, createDefaultLayer, createDefaultDrawing } from "../utils/helpers";

interface AnimationActions {
  // Drawing management
  addDrawing: (drawing: Partial<Drawing> & { layerId?: string }) => string;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  deleteDrawing: (id: string) => void;
  duplicateDrawing: (id: string) => void;
  renameDrawing: (id: string, name: string) => void;

  // Stroke management
  addStroke: (drawingId: string, stroke: DrawingStroke) => void;
  updateLastStroke: (drawingId: string, points: Point[]) => void;
  eraseAtPoint: (drawingId: string, x: number, y: number, radius: number) => void;

  // Frame management
  addFrame: () => void;
  duplicateFrame: (index: number) => void;
  deleteFrame: (index: number) => void;
  setCurrentFrame: (index: number) => void;
  reorderFrame: (fromIndex: number, toIndex: number) => void;
  saveDrawingStateToFrame: (drawingId: string) => void;

  // Layer management
  addLayer: () => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  reorderLayer: (fromIndex: number, toIndex: number) => void;

  // Selection
  selectDrawing: (id: string | null) => void;
  handleCanvasClick: (drawingId: string | null, x: number, y: number) => void;
  multiSelectDrawing: (id: string) => void;
  clearMultiSelect: () => void;

  // Transform
  moveDrawing: (id: string, dx: number, dy: number, frameIndex?: number) => void;
  rotateDrawing: (id: string, angle: number, frameIndex?: number) => void;
  scaleDrawing: (id: string, sx: number, sy: number, frameIndex?: number) => void;
  setDrawingTransform: (id: string, x: number, y: number, rotation: number, scaleX: number, scaleY: number, frameIndex?: number) => void;
  setPivot: (id: string, px: number, py: number) => void;

  // Pivot points
  addPivotPoint: (drawingId: string, x: number, y: number, name?: string) => void;
  updatePivotPoint: (drawingId: string, pivotId: string, updates: Partial<PivotPoint>) => void;
  deletePivotPoint: (drawingId: string, pivotId: string) => void;
  lockPivotPoint: (drawingId: string, pivotId: string, locked: boolean) => void;
  setActivePivot: (drawingId: string, pivotId: string | null) => void;

  // Bones
  addBone: (drawingId: string, x: number, y: number, name?: string) => void;
  updateBone: (drawingId: string, boneId: string, updates: Partial<Bone>) => void;
  deleteBone: (drawingId: string, boneId: string) => void;
  connectBones: (sourceBoneId: string, targetBoneId: string) => void;
  setBoneConnectionSource: (boneId: string | null) => void;

  // Parent-child
  setParent: (childId: string, parentId: string | null) => void;
  setKeepAttachedTo: (drawingId: string, attachId: string | null) => void;

  // Color lines
  addColorLine: (drawingId: string, horizontal: boolean) => void;
  updateColorLine: (drawingId: string, lineId: string, updates: Partial<ColorLine>) => void;
  deleteColorLine: (drawingId: string, lineId: string) => void;
  fillColorRegion: (drawingId: string, x: number, y: number) => void;

  // Tools
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setBrushOpacity: (opacity: number) => void;

  // Canvas view
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;

  // UI
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleGrid: () => void;
  toggleOnionSkinning: () => void;
  setOnionFrames: (prev: number, next: number) => void;
  setTransformHandleSize: (size: number) => void;

  // Playback
  startPlayback: () => void;
  stopPlayback: () => void;
  setFps: (fps: number) => void;

  // Mirror
  mirrorDrawing: (id: string, horizontal: boolean) => void;

  // Reorder drawings
  reorderDrawing: (fromIndex: number, toIndex: number, layerId: string) => void;
  moveDrawingToLayer: (drawingId: string, layerId: string) => void;

  // Toast
  showToast: (message: string) => void;
  dismissToast: () => void;

  // Group move (sets absolute positions for multiple drawings at once)
  setPositionsAbsolute: (positions: Record<string, { x: number; y: number }>) => void;
}

const initialSelectionState: SelectionState = {
  drawingId: null,
  clickCount: 0,
  lastClickTime: 0,
  lastClickDrawingId: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  handleType: null,
};

const DESELECT_CLICK_COUNT = 3;
const CLICK_TIMEOUT = 600; // ms between clicks for counting

function getDrawingFromFrame(state: AppState, drawingId: string, frameIndex: number): Drawing | null {
  const drawing = state.drawings[drawingId];
  if (!drawing) return null;
  const frame = state.frames[frameIndex];
  if (!frame) return drawing;
  const frameState = frame.drawingStates[drawingId];
  if (!frameState) return drawing;
  return {
    ...drawing,
    x: frameState.x,
    y: frameState.y,
    rotation: frameState.rotation,
    scaleX: frameState.scaleX,
    scaleY: frameState.scaleY,
    pivot: frameState.pivot,
    visible: frameState.visible,
    opacity: frameState.opacity,
    strokes: frameState.strokes,
    shapeData: frameState.shapeData ?? drawing.shapeData,
  };
}

export const useAnimationStore = create<AppState & AnimationActions>()(
  immer((set, get) => {
    const defaultLayer = createDefaultLayer("Layer 1");
    const defaultFrame = createDefaultFrame(0);

    const initialState: AppState = {
      drawings: {},
      drawingOrder: [],
      layers: [defaultLayer],
      activeLayerId: defaultLayer.id,
      frames: [defaultFrame],
      currentFrameIndex: 0,
      fps: 12,
      isPlaying: false,
      toast: null,
      activeTool: "pen",
      previousTool: null,
      strokeColor: "#000000",
      fillColor: "#FF5733",
      strokeWidth: 3,
      brushOpacity: 1,
      selection: initialSelectionState,
      multiSelectedIds: [],
      canvasWidth: 1280,
      canvasHeight: 720,
      zoom: 1,
      panX: 0,
      panY: 0,
      leftPanelOpen: true,
      rightPanelOpen: true,
      showGrid: false,
      onionSkinning: true,
      onionPrevFrames: 1,
      onionNextFrames: 1,
      showRulers: false,
      transformHandleSize: 20,
      continuesDrawing: false,
      boneConnectionSource: null,
      playbackStartFrame: 0,
      exportWidth: 1280,
      exportHeight: 720,
      exportFps: 24,
    };

    return {
      ...initialState,

      addDrawing: (partial) => {
        const id = generateId();
        const layerId = partial.layerId ?? get().activeLayerId;
        const drawing = createDefaultDrawing(id, partial);
        set((state) => {
          state.drawings[id] = drawing;
          state.drawingOrder.push(id);
          const layer = state.layers.find((l) => l.id === layerId);
          if (layer) layer.drawingIds.push(id);
          // Also initialize in current frame
          const frame = state.frames[state.currentFrameIndex];
          if (frame) {
            frame.drawingStates[id] = {
              x: drawing.x,
              y: drawing.y,
              rotation: drawing.rotation,
              scaleX: drawing.scaleX,
              scaleY: drawing.scaleY,
              pivot: { ...drawing.pivot },
              visible: drawing.visible,
              opacity: drawing.opacity,
              strokes: [...drawing.strokes],
              shapeData: drawing.shapeData ? { ...drawing.shapeData } : undefined,
            };
          }
        });
        return id;
      },

      updateDrawing: (id, updates) => {
        set((state) => {
          if (state.drawings[id]) {
            Object.assign(state.drawings[id], updates);
            // Sync to current frame state as well
            const frame = state.frames[state.currentFrameIndex];
            if (frame && frame.drawingStates[id]) {
              if (updates.x !== undefined) frame.drawingStates[id].x = updates.x;
              if (updates.y !== undefined) frame.drawingStates[id].y = updates.y;
              if (updates.rotation !== undefined) frame.drawingStates[id].rotation = updates.rotation;
              if (updates.scaleX !== undefined) frame.drawingStates[id].scaleX = updates.scaleX;
              if (updates.scaleY !== undefined) frame.drawingStates[id].scaleY = updates.scaleY;
              if (updates.visible !== undefined) frame.drawingStates[id].visible = updates.visible;
              if (updates.opacity !== undefined) frame.drawingStates[id].opacity = updates.opacity;
              if (updates.strokes !== undefined) frame.drawingStates[id].strokes = updates.strokes as DrawingStroke[];
              if (updates.pivot !== undefined) frame.drawingStates[id].pivot = { ...updates.pivot };
              if (updates.shapeData !== undefined) frame.drawingStates[id].shapeData = updates.shapeData ? { ...updates.shapeData } : undefined;
            }
          }
        });
      },

      deleteDrawing: (id) => {
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing) return;
          // Remove from parent
          if (drawing.parentId && state.drawings[drawing.parentId]) {
            state.drawings[drawing.parentId].childIds = state.drawings[drawing.parentId].childIds.filter(
              (cid) => cid !== id
            );
          }
          // Remove children's parent ref
          drawing.childIds.forEach((childId) => {
            if (state.drawings[childId]) {
              state.drawings[childId].parentId = null;
            }
          });
          // Remove from layers
          state.layers.forEach((layer) => {
            layer.drawingIds = layer.drawingIds.filter((did) => did !== id);
          });
          // Remove from all frames
          state.frames.forEach((frame) => {
            delete frame.drawingStates[id];
          });
          // Remove from drawingOrder
          state.drawingOrder = state.drawingOrder.filter((did) => did !== id);
          // Remove drawing
          delete state.drawings[id];
          // Clear selection
          if (state.selection.drawingId === id) {
            state.selection = { ...initialSelectionState };
          }
          state.multiSelectedIds = state.multiSelectedIds.filter((did) => did !== id);
        });
      },

      duplicateDrawing: (id) => {
        const state = get();
        const drawing = state.drawings[id];
        if (!drawing) return;
        const newId = generateId();
        set((st) => {
          const newDrawing: Drawing = JSON.parse(JSON.stringify(drawing));
          newDrawing.id = newId;
          newDrawing.name = drawing.name + " copy";
          newDrawing.x += 20;
          newDrawing.y += 20;
          newDrawing.parentId = null;
          newDrawing.childIds = [];
          newDrawing.bones = [];
          newDrawing.pivotPoints = [];
          newDrawing.activePivotId = null;
          st.drawings[newId] = newDrawing;
          st.drawingOrder.push(newId);
          const layer = st.layers.find((l) => l.id === st.activeLayerId);
          if (layer) layer.drawingIds.push(newId);
          // Init in current frame
          const frame = st.frames[st.currentFrameIndex];
          if (frame) {
            frame.drawingStates[newId] = {
              x: newDrawing.x,
              y: newDrawing.y,
              rotation: newDrawing.rotation,
              scaleX: newDrawing.scaleX,
              scaleY: newDrawing.scaleY,
              pivot: { ...newDrawing.pivot },
              visible: newDrawing.visible,
              opacity: newDrawing.opacity,
              strokes: JSON.parse(JSON.stringify(newDrawing.strokes)),
              shapeData: newDrawing.shapeData ? { ...newDrawing.shapeData } : undefined,
            };
          }
        });
      },

      renameDrawing: (id, name) => {
        set((state) => {
          if (state.drawings[id]) state.drawings[id].name = name;
        });
      },

      addStroke: (drawingId, stroke) => {
        set((state) => {
          if (!state.drawings[drawingId]) return;
          state.drawings[drawingId].strokes.push(stroke);
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[drawingId]) {
            frame.drawingStates[drawingId].strokes.push(stroke);
          }
        });
      },

      updateLastStroke: (drawingId, points) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing || drawing.strokes.length === 0) return;
          const lastIdx = drawing.strokes.length - 1;
          drawing.strokes[lastIdx].points = points;
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[drawingId]) {
            const strokes = frame.drawingStates[drawingId].strokes;
            if (strokes.length > 0) {
              strokes[strokes.length - 1].points = points;
            }
          }
        });
      },

      eraseAtPoint: (drawingId, x, y, radius) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          drawing.strokes = drawing.strokes
            .map((stroke) => ({
              ...stroke,
              points: stroke.points.filter((p) => Math.hypot(p.x - x, p.y - y) > radius),
            }))
            .filter((s) => s.points.length > 1);
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[drawingId]) {
            frame.drawingStates[drawingId].strokes = state.drawings[drawingId].strokes.map((s) =>
              JSON.parse(JSON.stringify(s))
            );
          }
        });
      },

      addFrame: () => {
        set((state) => {
          const newIndex = state.frames.length;
          const newFrame = createDefaultFrame(newIndex);
          // Copy current frame state for continuity
          const currentFrame = state.frames[state.currentFrameIndex];
          if (currentFrame) {
            Object.keys(currentFrame.drawingStates).forEach((did) => {
              newFrame.drawingStates[did] = JSON.parse(JSON.stringify(currentFrame.drawingStates[did]));
            });
          }
          state.frames.push(newFrame);
          state.currentFrameIndex = newIndex;
        });
      },

      duplicateFrame: (index) => {
        set((state) => {
          const sourceFrame = state.frames[index];
          if (!sourceFrame) return;
          const newFrame: AnimationFrame = JSON.parse(JSON.stringify(sourceFrame));
          newFrame.id = generateId();
          newFrame.index = index + 1;
          state.frames.splice(index + 1, 0, newFrame);
          // Re-index
          state.frames.forEach((f, i) => { f.index = i; });
          state.currentFrameIndex = index + 1;
        });
      },

      deleteFrame: (index) => {
        set((state) => {
          if (state.frames.length <= 1) return;
          state.frames.splice(index, 1);
          state.frames.forEach((f, i) => { f.index = i; });
          state.currentFrameIndex = Math.min(state.currentFrameIndex, state.frames.length - 1);
        });
      },

      setCurrentFrame: (index) => {
        set((state) => {
          state.currentFrameIndex = Math.max(0, Math.min(index, state.frames.length - 1));
        });
      },

      reorderFrame: (fromIndex, toIndex) => {
        set((state) => {
          const [removed] = state.frames.splice(fromIndex, 1);
          state.frames.splice(toIndex, 0, removed);
          state.frames.forEach((f, i) => { f.index = i; });
          state.currentFrameIndex = toIndex;
        });
      },

      saveDrawingStateToFrame: (drawingId) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const frame = state.frames[state.currentFrameIndex];
          if (!frame) return;
          frame.drawingStates[drawingId] = {
            x: drawing.x,
            y: drawing.y,
            rotation: drawing.rotation,
            scaleX: drawing.scaleX,
            scaleY: drawing.scaleY,
            pivot: { ...drawing.pivot },
            visible: drawing.visible,
            opacity: drawing.opacity,
            strokes: JSON.parse(JSON.stringify(drawing.strokes)),
            shapeData: drawing.shapeData ? { ...drawing.shapeData } : undefined,
          };
        });
      },

      addLayer: () => {
        set((state) => {
          const layer = createDefaultLayer(`Layer ${state.layers.length + 1}`);
          state.layers.push(layer);
          state.activeLayerId = layer.id;
        });
      },

      updateLayer: (id, updates) => {
        set((state) => {
          const layer = state.layers.find((l) => l.id === id);
          if (layer) Object.assign(layer, updates);
        });
      },

      deleteLayer: (id) => {
        set((state) => {
          if (state.layers.length <= 1) return;
          const layer = state.layers.find((l) => l.id === id);
          if (!layer) return;
          // Delete all drawings in this layer
          layer.drawingIds.forEach((did) => {
            state.drawingOrder = state.drawingOrder.filter((d) => d !== did);
            delete state.drawings[did];
            state.frames.forEach((f) => { delete f.drawingStates[did]; });
          });
          state.layers = state.layers.filter((l) => l.id !== id);
          if (state.activeLayerId === id) {
            state.activeLayerId = state.layers[0]?.id ?? "";
          }
        });
      },

      setActiveLayer: (id) => {
        set((state) => { state.activeLayerId = id; });
      },

      reorderLayer: (fromIndex, toIndex) => {
        set((state) => {
          const [removed] = state.layers.splice(fromIndex, 1);
          state.layers.splice(toIndex, 0, removed);
        });
      },

      selectDrawing: (id) => {
        set((state) => {
          state.selection = {
            ...initialSelectionState,
            drawingId: id,
          };
        });
      },

      handleCanvasClick: (drawingId, x, y) => {
        const state = get();
        const now = Date.now();
        const sel = state.selection;

        set((st) => {
          if (drawingId === null) {
            // Click on empty space - don't deselect unless no drawing is selected
            if (!sel.drawingId) {
              st.selection = { ...initialSelectionState };
            }
            // Don't deselect on canvas background click - keep selection
            return;
          }

          // A drawing was clicked
          if (sel.drawingId === null) {
            // Select this drawing
            st.selection = {
              drawingId,
              clickCount: 1,
              lastClickTime: now,
              lastClickDrawingId: drawingId,
              isDragging: false,
              dragStartX: x,
              dragStartY: y,
              handleType: null,
            };
            return;
          }

          if (sel.drawingId !== drawingId) {
            // Different drawing clicked while another is selected - DON'T change selection
            // (strictly enforced: while one drawing is selected, no other can be selected)
            return;
          }

          // Same drawing clicked
          const timeDiff = now - sel.lastClickTime;
          const newCount = timeDiff < CLICK_TIMEOUT ? sel.clickCount + 1 : 1;

          if (newCount >= DESELECT_CLICK_COUNT) {
            // 3 clicks = deselect
            st.selection = { ...initialSelectionState };
          } else {
            st.selection = {
              ...sel,
              clickCount: newCount,
              lastClickTime: now,
              lastClickDrawingId: drawingId,
            };
          }
        });
      },

      multiSelectDrawing: (id) => {
        set((state) => {
          const idx = state.multiSelectedIds.indexOf(id);
          if (idx === -1) state.multiSelectedIds.push(id);
          else state.multiSelectedIds.splice(idx, 1);
        });
      },

      clearMultiSelect: () => {
        set((state) => { state.multiSelectedIds = []; });
      },

      moveDrawing: (id, dx, dy, frameIndex) => {
        const fi = frameIndex ?? get().currentFrameIndex;
        set((state) => {
          // Helper: find root of the parent-child group
          function getRootId(drawingId: string, depth = 0): string {
            const d = state.drawings[drawingId];
            if (!d || !d.parentId || depth > 50) return drawingId;
            return getRootId(d.parentId, depth + 1);
          }
          // Helper: collect all descendant IDs from root
          function collectGroup(drawingId: string): string[] {
            const d = state.drawings[drawingId];
            if (!d) return [];
            return [drawingId, ...d.childIds.flatMap(collectGroup)];
          }

          const rootId = getRootId(id);
          const allMembers = collectGroup(rootId);
          const frame = state.frames[fi];

          // Also include keepAttachedTo targets
          const extra: string[] = [];
          allMembers.forEach((mid) => {
            const d = state.drawings[mid];
            if (d?.keepAttachedToId && !allMembers.includes(d.keepAttachedToId)) {
              extra.push(d.keepAttachedToId);
            }
          });

          [...allMembers, ...extra].forEach((memberId) => {
            const d = state.drawings[memberId];
            if (!d || d.locked) return;
            d.x += dx;
            d.y += dy;
            if (frame && frame.drawingStates[memberId]) {
              frame.drawingStates[memberId].x = d.x;
              frame.drawingStates[memberId].y = d.y;
            }
          });
        });
      },

      rotateDrawing: (id, angle, frameIndex) => {
        const fi = frameIndex ?? get().currentFrameIndex;
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing || drawing.locked) return;
          drawing.rotation += angle;
          const frame = state.frames[fi];
          if (frame && frame.drawingStates[id]) {
            frame.drawingStates[id].rotation = drawing.rotation;
          }
        });
      },

      scaleDrawing: (id, sx, sy, frameIndex) => {
        const fi = frameIndex ?? get().currentFrameIndex;
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing || drawing.locked) return;
          drawing.scaleX *= sx;
          drawing.scaleY *= sy;
          const frame = state.frames[fi];
          if (frame && frame.drawingStates[id]) {
            frame.drawingStates[id].scaleX = drawing.scaleX;
            frame.drawingStates[id].scaleY = drawing.scaleY;
          }
        });
      },

      setDrawingTransform: (id, x, y, rotation, scaleX, scaleY, frameIndex) => {
        const fi = frameIndex ?? get().currentFrameIndex;
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing) return;
          drawing.x = x; drawing.y = y;
          drawing.rotation = rotation;
          drawing.scaleX = scaleX; drawing.scaleY = scaleY;
          const frame = state.frames[fi];
          if (frame && frame.drawingStates[id]) {
            Object.assign(frame.drawingStates[id], { x, y, rotation, scaleX, scaleY });
          }
        });
      },

      setPivot: (id, px, py) => {
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing) return;
          drawing.pivot = { x: px, y: py };
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[id]) {
            frame.drawingStates[id].pivot = { x: px, y: py };
          }
        });
      },

      addPivotPoint: (drawingId, x, y, name) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const id = generateId();
          const pivot: PivotPoint = {
            id,
            name: name ?? `Pivot ${drawing.pivotPoints.length + 1}`,
            x,
            y,
            locked: false,
            color: "#FF4444",
          };
          drawing.pivotPoints.push(pivot);
          drawing.activePivotId = id;
          // Update main pivot
          drawing.pivot = { x, y };
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[drawingId]) {
            frame.drawingStates[drawingId].pivot = { x, y };
          }
        });
      },

      updatePivotPoint: (drawingId, pivotId, updates) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const pivot = drawing.pivotPoints.find((p) => p.id === pivotId);
          if (pivot) Object.assign(pivot, updates);
          // If active pivot updated, update main pivot too
          if (drawing.activePivotId === pivotId && (updates.x !== undefined || updates.y !== undefined)) {
            const p = drawing.pivotPoints.find((pv) => pv.id === pivotId);
            if (p) {
              drawing.pivot = { x: p.x, y: p.y };
              const frame = state.frames[state.currentFrameIndex];
              if (frame && frame.drawingStates[drawingId]) {
                frame.drawingStates[drawingId].pivot = { x: p.x, y: p.y };
              }
            }
          }
        });
      },

      deletePivotPoint: (drawingId, pivotId) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          drawing.pivotPoints = drawing.pivotPoints.filter((p) => p.id !== pivotId);
          if (drawing.activePivotId === pivotId) {
            drawing.activePivotId = drawing.pivotPoints[0]?.id ?? null;
          }
        });
      },

      lockPivotPoint: (drawingId, pivotId, locked) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const pivot = drawing.pivotPoints.find((p) => p.id === pivotId);
          if (pivot) pivot.locked = locked;
        });
      },

      setActivePivot: (drawingId, pivotId) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          drawing.activePivotId = pivotId;
          if (pivotId) {
            const pivot = drawing.pivotPoints.find((p) => p.id === pivotId);
            if (pivot) {
              drawing.pivot = { x: pivot.x, y: pivot.y };
              const frame = state.frames[state.currentFrameIndex];
              if (frame && frame.drawingStates[drawingId]) {
                frame.drawingStates[drawingId].pivot = { x: pivot.x, y: pivot.y };
              }
            }
          }
        });
      },

      addBone: (drawingId, x, y, name) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const id = generateId();
          const bone: Bone = {
            id,
            name: name ?? `Bone ${drawing.bones.length + 1}`,
            drawingId,
            x,
            y,
            connectionEnabled: false,
            connectedToBoneId: null,
            isParentBone: false,
          };
          drawing.bones.push(bone);
        });
      },

      updateBone: (drawingId, boneId, updates) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const bone = drawing.bones.find((b) => b.id === boneId);
          if (bone) Object.assign(bone, updates);
        });
      },

      deleteBone: (drawingId, boneId) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          drawing.bones = drawing.bones.filter((b) => b.id !== boneId);
          // Disconnect references
          drawing.bones.forEach((b) => {
            if (b.connectedToBoneId === boneId) b.connectedToBoneId = null;
          });
          if (state.boneConnectionSource === boneId) state.boneConnectionSource = null;
        });
      },

      connectBones: (sourceBoneId, targetBoneId) => {
        set((state) => {
          // Find source bone in all drawings
          let sourceBone: Bone | null = null;
          let sourceDrawingId: string | null = null;
          Object.values(state.drawings).forEach((d) => {
            const b = d.bones.find((b) => b.id === sourceBoneId);
            if (b) { sourceBone = b; sourceDrawingId = d.id; }
          });
          if (!sourceBone || !sourceDrawingId) return;
          (sourceBone as Bone).connectedToBoneId = targetBoneId;
          (sourceBone as Bone).isParentBone = true;

          // Make sourceDrawing parent of targetBone's drawing
          let targetDrawingId: string | null = null;
          Object.values(state.drawings).forEach((d) => {
            if (d.bones.find((b) => b.id === targetBoneId)) targetDrawingId = d.id;
          });
          if (targetDrawingId && sourceDrawingId !== targetDrawingId) {
            const targetDrawing = state.drawings[targetDrawingId];
            const sourceDrawing = state.drawings[sourceDrawingId];
            if (targetDrawing && sourceDrawing) {
              targetDrawing.parentId = sourceDrawingId;
              if (!sourceDrawing.childIds.includes(targetDrawingId)) {
                sourceDrawing.childIds.push(targetDrawingId);
              }
            }
          }
          state.boneConnectionSource = null;
        });
      },

      setBoneConnectionSource: (boneId) => {
        set((state) => { state.boneConnectionSource = boneId; });
      },

      setParent: (childId, parentId) => {
        set((state) => {
          const child = state.drawings[childId];
          if (!child) return;

          // Remove from old parent
          if (child.parentId && state.drawings[child.parentId]) {
            state.drawings[child.parentId].childIds = state.drawings[child.parentId].childIds.filter(
              (id) => id !== childId
            );
          }

          child.parentId = parentId;

          if (parentId && state.drawings[parentId]) {
            if (!state.drawings[parentId].childIds.includes(childId)) {
              state.drawings[parentId].childIds.push(childId);
            }
          }
          // DO NOT hide/remove child from canvas - just update backend relationship
        });
      },

      setKeepAttachedTo: (drawingId, attachId) => {
        set((state) => {
          if (state.drawings[drawingId]) {
            state.drawings[drawingId].keepAttachedToId = attachId;
          }
        });
      },

      addColorLine: (drawingId, horizontal) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const id = generateId();
          const line: ColorLine = horizontal
            ? { id, x1: -200, y1: 0, x2: 200, y2: 0, horizontal: true }
            : { id, x1: 0, y1: -200, x2: 0, y2: 200, horizontal: false };
          drawing.colorLines.push(line);
        });
      },

      updateColorLine: (drawingId, lineId, updates) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          const line = drawing.colorLines.find((l) => l.id === lineId);
          if (line) Object.assign(line, updates);
        });
      },

      deleteColorLine: (drawingId, lineId) => {
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          drawing.colorLines = drawing.colorLines.filter((l) => l.id !== lineId);
        });
      },

      fillColorRegion: (drawingId, x, y) => {
        // This is handled in the canvas renderer via flood fill
        set((state) => {
          const drawing = state.drawings[drawingId];
          if (!drawing) return;
          // Add a fill stroke at position
          const stroke: DrawingStroke = {
            id: generateId(),
            points: [{ x, y }],
            color: state.fillColor,
            width: 0,
            opacity: state.brushOpacity,
            tool: "pen",
            fillRegion: { color: state.fillColor, opacity: state.brushOpacity },
          };
          drawing.strokes.push(stroke);
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[drawingId]) {
            frame.drawingStates[drawingId].strokes.push(stroke);
          }
        });
      },

      setActiveTool: (tool) => {
        set((state) => {
          state.previousTool = state.activeTool;
          state.activeTool = tool;
        });
      },

      setStrokeColor: (color) => {
        set((state) => { state.strokeColor = color; });
      },

      setFillColor: (color) => {
        set((state) => { state.fillColor = color; });
      },

      setStrokeWidth: (width) => {
        set((state) => { state.strokeWidth = width; });
      },

      setBrushOpacity: (opacity) => {
        set((state) => { state.brushOpacity = opacity; });
      },

      setZoom: (zoom) => {
        set((state) => { state.zoom = Math.max(0.05, Math.min(40, zoom)); });
      },

      setPan: (x, y) => {
        set((state) => { state.panX = x; state.panY = y; });
      },

      toggleLeftPanel: () => {
        set((state) => { state.leftPanelOpen = !state.leftPanelOpen; });
      },

      toggleRightPanel: () => {
        set((state) => { state.rightPanelOpen = !state.rightPanelOpen; });
      },

      toggleGrid: () => {
        set((state) => { state.showGrid = !state.showGrid; });
      },

      toggleOnionSkinning: () => {
        set((state) => { state.onionSkinning = !state.onionSkinning; });
      },

      setOnionFrames: (prev, next) => {
        set((state) => { state.onionPrevFrames = prev; state.onionNextFrames = next; });
      },

      setTransformHandleSize: (size) => {
        set((state) => {
          state.transformHandleSize = Math.max(10, Math.min(100, size));
        });
      },

      startPlayback: () => {
        set((state) => {
          state.isPlaying = true;
          state.playbackStartFrame = state.currentFrameIndex;
        });
      },

      stopPlayback: () => {
        set((state) => { state.isPlaying = false; });
      },

      setFps: (fps) => {
        set((state) => { state.fps = fps; });
      },

      mirrorDrawing: (id, horizontal) => {
        set((state) => {
          const drawing = state.drawings[id];
          if (!drawing) return;
          drawing.strokes = drawing.strokes.map((stroke) => ({
            ...stroke,
            points: stroke.points.map((p) => ({
              x: horizontal ? -p.x : p.x,
              y: horizontal ? p.y : -p.y,
              pressure: p.pressure,
            })),
          }));
          if (drawing.shapeData) {
            if (horizontal) {
              drawing.shapeData = {
                ...drawing.shapeData,
                x: -drawing.shapeData.x - drawing.shapeData.width,
              };
            } else {
              drawing.shapeData = {
                ...drawing.shapeData,
                y: -drawing.shapeData.y - drawing.shapeData.height,
              };
            }
          }
          const frame = state.frames[state.currentFrameIndex];
          if (frame && frame.drawingStates[id]) {
            frame.drawingStates[id].strokes = JSON.parse(JSON.stringify(drawing.strokes));
            frame.drawingStates[id].shapeData = drawing.shapeData ? { ...drawing.shapeData } : undefined;
          }
        });
      },

      reorderDrawing: (fromIndex, toIndex, layerId) => {
        set((state) => {
          const layer = state.layers.find((l) => l.id === layerId);
          if (!layer) return;
          const [removed] = layer.drawingIds.splice(fromIndex, 1);
          layer.drawingIds.splice(toIndex, 0, removed);
        });
      },

      moveDrawingToLayer: (drawingId, layerId) => {
        set((state) => {
          state.layers.forEach((l) => {
            l.drawingIds = l.drawingIds.filter((id) => id !== drawingId);
          });
          const targetLayer = state.layers.find((l) => l.id === layerId);
          if (targetLayer) targetLayer.drawingIds.push(drawingId);
        });
      },

      showToast: (message) => {
        set((state) => {
          state.toast = { message, id: generateId() };
        });
      },

      dismissToast: () => {
        set((state) => { state.toast = null; });
      },

      setPositionsAbsolute: (positions) => {
        set((state) => {
          const frame = state.frames[state.currentFrameIndex];
          Object.entries(positions).forEach(([id, pos]) => {
            const d = state.drawings[id];
            if (!d || d.locked) return;
            d.x = pos.x;
            d.y = pos.y;
            if (frame && frame.drawingStates[id]) {
              frame.drawingStates[id].x = pos.x;
              frame.drawingStates[id].y = pos.y;
            }
          });
        });
      },
    };
  })
);
