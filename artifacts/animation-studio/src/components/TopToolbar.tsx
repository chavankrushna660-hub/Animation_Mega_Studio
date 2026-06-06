import React from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import type { ToolType } from "../types";

interface ToolDef {
  id: ToolType;
  label: string;
  icon: string;
  shortcut?: string;
  group?: string;
}

const TOOLS: ToolDef[] = [
  // Selection
  { id: "select", label: "Select", icon: "↖", shortcut: "S", group: "selection" },
  { id: "transform", label: "Transform", icon: "⤢", shortcut: "T", group: "selection" },
  { id: "move", label: "Move", icon: "✥", shortcut: "V", group: "selection" },
  { id: "lasso", label: "Lasso Select", icon: "⌭", shortcut: "L", group: "selection" },

  // Drawing
  { id: "pen", label: "Pen", icon: "✏", shortcut: "P", group: "draw" },
  { id: "brush", label: "Brush", icon: "🖌", shortcut: "B", group: "draw" },
  { id: "paintBrush", label: "Paint Brush", icon: "🎨", shortcut: "N", group: "draw" },
  { id: "eraser", label: "Eraser", icon: "⌫", shortcut: "E", group: "draw" },
  { id: "continuesDraw", label: "Continue Draw", icon: "⟿", shortcut: "C", group: "draw" },

  // Shapes
  { id: "rect", label: "Rectangle", icon: "▭", shortcut: "R", group: "shapes" },
  { id: "circle", label: "Circle/Ellipse", icon: "◯", shortcut: "O", group: "shapes" },
  { id: "triangle", label: "Triangle", icon: "△", shortcut: "G", group: "shapes" },
  { id: "line", label: "Line", icon: "╱", shortcut: "I", group: "shapes" },

  // Color
  { id: "fill", label: "Fill/Paint Bucket", icon: "⬛", shortcut: "F", group: "color" },
  { id: "eyedropper", label: "Eyedropper", icon: "💉", shortcut: "D", group: "color" },
  { id: "addColorLine", label: "Color Line", icon: "⁞", shortcut: "K", group: "color" },

  // Rigging
  { id: "pivot", label: "Pivot Point", icon: "⊕", shortcut: "Z", group: "rig" },
  { id: "bone", label: "Bone", icon: "🦴", shortcut: "X", group: "rig" },
  { id: "mirror", label: "Mirror", icon: "⇔", shortcut: "M", group: "rig" },

  // Text
  { id: "text", label: "Text", icon: "T", shortcut: "W", group: "other" },
];

const GROUP_LABELS: Record<string, string> = {
  selection: "Select",
  draw: "Draw",
  shapes: "Shapes",
  color: "Color",
  rig: "Rig",
  other: "Other",
};

const TopToolbar: React.FC = () => {
  const store = useAnimationStore();

  const handleToolSelect = (toolId: ToolType) => {
    store.setActiveTool(toolId);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const tool = TOOLS.find((t) => t.shortcut?.toLowerCase() === e.key.toLowerCase());
      if (tool) handleToolSelect(tool.id);
      // Space = pan (handled in canvas)
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const groups = Object.keys(GROUP_LABELS);

  return (
    <div className="flex items-center gap-0 h-12 bg-white border-b border-gray-200 px-2 overflow-x-auto shrink-0">
      {/* App title */}
      <div className="flex items-center gap-2 pr-3 border-r border-gray-200 mr-2 shrink-0">
        <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">A</div>
        <span className="text-xs font-bold text-gray-800 hidden sm:block">AnimStudio</span>
      </div>

      {/* Tool groups */}
      {groups.map((group) => {
        const groupTools = TOOLS.filter((t) => t.group === group);
        return (
          <div key={group} className="flex items-center border-r border-gray-100 px-1 gap-0.5 shrink-0">
            {groupTools.map((tool) => (
              <button
                key={tool.id}
                title={`${tool.label} (${tool.shortcut})`}
                className={`relative flex flex-col items-center justify-center w-9 h-9 rounded text-base transition-all ${
                  store.activeTool === tool.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => handleToolSelect(tool.id)}
              >
                <span className="text-base leading-none">{tool.icon}</span>
                <span className="text-[7px] leading-none mt-0.5 opacity-70">{tool.label.slice(0, 4)}</span>
              </button>
            ))}
          </div>
        );
      })}

      {/* Separator */}
      <div className="flex-1" />

      {/* Quick controls */}
      <div className="flex items-center gap-2 pl-2 border-l border-gray-200 shrink-0">
        {/* Playback */}
        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
            title="Previous Frame"
            onClick={() => store.setCurrentFrame(store.currentFrameIndex - 1)}
          >⏮</button>
          <button
            className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium ${
              store.isPlaying ? "bg-red-500 text-white" : "bg-green-500 text-white"
            }`}
            title={store.isPlaying ? "Stop" : "Play"}
            onClick={() => store.isPlaying ? store.stopPlayback() : store.startPlayback()}
          >{store.isPlaying ? "⏹" : "▶"}</button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
            title="Next Frame"
            onClick={() => store.setCurrentFrame(store.currentFrameIndex + 1)}
          >⏭</button>
        </div>

        <div className="text-xs text-gray-500 shrink-0">
          {store.currentFrameIndex + 1}/{store.frames.length} @ {store.fps}fps
        </div>

        {/* FPS */}
        <select
          className="text-xs border rounded px-1 py-0.5 bg-white"
          value={store.fps}
          onChange={(e) => store.setFps(Number(e.target.value))}
        >
          <option value={6}>6fps</option>
          <option value={12}>12fps</option>
          <option value={24}>24fps</option>
          <option value={30}>30fps</option>
          <option value={60}>60fps</option>
        </select>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => store.setZoom(store.zoom * 0.8)}>−</button>
          <span className="text-xs text-gray-600 w-12 text-center">{Math.round(store.zoom * 100)}%</span>
          <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => store.setZoom(store.zoom * 1.2)}>+</button>
          <button className="text-xs bg-gray-100 rounded px-1 hover:bg-gray-200" onClick={() => { store.setZoom(1); store.setPan(0, 0); }}>Reset</button>
        </div>

        {/* Onion skin toggle */}
        <button
          title="Toggle Onion Skinning"
          className={`w-8 h-8 flex items-center justify-center rounded text-sm ${store.onionSkinning ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500"}`}
          onClick={store.toggleOnionSkinning}
        >👁</button>

        {/* Grid toggle */}
        <button
          title="Toggle Grid"
          className={`w-8 h-8 flex items-center justify-center rounded text-sm ${store.showGrid ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}
          onClick={store.toggleGrid}
        >#</button>
      </div>
    </div>
  );
};

export default TopToolbar;
