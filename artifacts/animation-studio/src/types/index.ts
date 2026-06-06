export type ToolType =
  | "select"
  | "pen"
  | "brush"
  | "eraser"
  | "lasso"
  | "fill"
  | "paintBrush"
  | "text"
  | "rect"
  | "circle"
  | "triangle"
  | "line"
  | "pivot"
  | "bone"
  | "mirror"
  | "move"
  | "rotate"
  | "scale"
  | "continuesDraw"
  | "addColorLine"
  | "eyedropper"
  | "transform";

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface PivotPoint {
  id: string;
  name: string;
  x: number; // local space relative to drawing origin
  y: number;
  locked: boolean;
  color: string;
}

export interface Bone {
  id: string;
  name: string;
  drawingId: string;
  x: number; // local space
  y: number;
  connectionEnabled: boolean;
  connectedToBoneId: string | null;
  isParentBone: boolean; // true if this bone has a child connection
}

export interface ColorLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  horizontal: boolean;
}

export interface DrawingStroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  tool: "pen" | "brush" | "eraser" | "paintBrush";
  fillRegion?: { color: string; opacity: number };
}

export interface Drawing {
  id: string;
  name: string;
  // Stored points in local space (before transform)
  strokes: DrawingStroke[];
  // Shape type if it's a shape
  shapeType?: "rect" | "circle" | "triangle" | "line";
  shapeData?: {
    x: number;
    y: number;
    width: number;
    height: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  };
  // Text
  text?: string;
  fontSize?: number;
  fontFamily?: string;

  // Transform (world space position of drawing origin)
  x: number;
  y: number;
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;

  // Pivot point in local space (relative to bounding box center)
  pivot: { x: number; y: number };
  pivotPoints: PivotPoint[];
  activePivotId: string | null;

  // Colors
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  fillOpacity: number;
  opacity: number;

  // Parent/child
  parentId: string | null;
  childIds: string[];
  keepAttachedToId: string | null;

  // Bones
  bones: Bone[];

  // Color divider lines
  colorLines: ColorLine[];

  // State
  visible: boolean;
  locked: boolean;
  collapsed: boolean; // for left panel tree
}

export interface Layer {
  id: string;
  name: string;
  drawingIds: string[]; // ordered list of drawing ids in this layer
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface Keyframe {
  frameIndex: number;
  drawingTransforms: {
    [drawingId: string]: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      pivot: { x: number; y: number };
      visible: boolean;
    };
  };
}

export interface AnimationFrame {
  id: string;
  index: number;
  // Per-frame drawing state (overrides base drawing if set)
  drawingStates: {
    [drawingId: string]: {
      x: number;
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      pivot: { x: number; y: number };
      visible: boolean;
      opacity: number;
      strokes: DrawingStroke[];
      shapeData?: Drawing["shapeData"];
    };
  };
  thumbnail?: string;
}

export type HandleType =
  | "move"
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "mt"
  | "mb"
  | "ml"
  | "mr"
  | "rotate";

export interface TransformHandle {
  type: HandleType;
  x: number;
  y: number;
}

export interface SelectionState {
  drawingId: string | null;
  // Click counting for 3-click deselect
  clickCount: number;
  lastClickTime: number;
  lastClickDrawingId: string | null;
  // Is a transform being performed
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  handleType: HandleType | null;
}

export interface AppState {
  // Drawings (all drawings in the project)
  drawings: { [id: string]: Drawing };
  drawingOrder: string[]; // ordered by layer/z-order

  // Layers
  layers: Layer[];
  activeLayerId: string;

  // Animation frames
  frames: AnimationFrame[];
  currentFrameIndex: number;
  fps: number;
  isPlaying: boolean;

  // Tools
  activeTool: ToolType;
  previousTool: ToolType | null;

  // Colors
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  brushOpacity: number;

  // Selection
  selection: SelectionState;
  multiSelectedIds: string[]; // for left panel multi-select

  // Canvas view
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;

  // UI state
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  showGrid: boolean;
  onionSkinning: boolean;
  onionPrevFrames: number;
  onionNextFrames: number;
  showRulers: boolean;

  // Transform control size
  transformHandleSize: number; // default 20, range 10-100

  // Continues drawing mode
  continuesDrawing: boolean;

  // Bone connection mode
  boneConnectionSource: string | null; // bone id being connected

  // Playback
  playbackStartFrame: number;

  // Export
  exportWidth: number;
  exportHeight: number;
  exportFps: number;
}
