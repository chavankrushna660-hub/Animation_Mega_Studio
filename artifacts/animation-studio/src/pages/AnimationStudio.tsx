import React from "react";
import TopToolbar from "../components/TopToolbar";
import LeftPanel from "../components/LeftPanel";
import RightPanel from "../components/RightPanel";
import AnimationCanvas from "../components/AnimationCanvas";
import Timeline from "../components/Timeline";
import Toast from "../components/Toast";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing, getDrawingBoundingBox } from "../utils/helpers";
import { localToWorld, getDrawingTransform } from "../utils/geometry";

const AnimationStudio: React.FC = () => {
  const store = useAnimationStore();

  const handleCenterOnCanvas = () => {
    const selId = store.selection.drawingId;
    if (!selId) return;
    const drawing = getEffectiveDrawing(store.drawings, store.frames, selId, store.currentFrameIndex);
    if (!drawing) return;
    const bb = getDrawingBoundingBox(drawing);
    if (!bb) return;
    const t = getDrawingTransform(drawing);
    const worldCenter = localToWorld(bb.cx, bb.cy, t);
    const canvasCenterX = (store.canvasWidth ?? 1280) / 2;
    const canvasCenterY = (store.canvasHeight ?? 720) / 2;
    const dx = canvasCenterX - worldCenter.x;
    const dy = canvasCenterY - worldCenter.y;
    store.moveDrawing(selId, dx, dy);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-200 overflow-hidden select-none">
      {/* Top toolbar */}
      <TopToolbar />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel toggle button */}
        <button
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 w-4 h-12 bg-white border border-gray-300 rounded-r shadow flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all ${store.leftPanelOpen ? "left-[220px]" : "left-0"}`}
          style={{ position: "absolute", left: store.leftPanelOpen ? 220 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 30 }}
          onClick={store.toggleLeftPanel}
          title={store.leftPanelOpen ? "Close left panel" : "Open left panel"}
        >
          {store.leftPanelOpen ? "◀" : "▶"}
        </button>

        {/* Left Panel */}
        {store.leftPanelOpen && (
          <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden z-20 shadow-md">
            <LeftPanel />
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-gray-300 min-w-0">
          {/* Canvas info bar */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow text-xs text-gray-600">
            <span className="pointer-events-none">Tool: <strong>{store.activeTool}</strong></span>
            {store.selection.drawingId && (
              <span className="pointer-events-none">Selected: <strong className="text-blue-700">
                {store.drawings[store.selection.drawingId]?.name ?? "Drawing"}
              </strong></span>
            )}
            <span className="pointer-events-none">{store.currentFrameIndex + 1}/{store.frames.length}</span>
            {store.selection.drawingId && (
              <button
                onClick={handleCenterOnCanvas}
                className="ml-1 bg-blue-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-bold hover:bg-blue-700 transition-colors"
                title="Move selected drawing to canvas center"
              >
                ⊙ Center
              </button>
            )}
          </div>

          {/* Deselect hint */}
          {store.selection.drawingId && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-blue-600/90 text-white text-xs rounded-full px-3 py-1 pointer-events-none">
              Click drawing 3× to deselect · Or click its name in left panel
            </div>
          )}

          <AnimationCanvas />
        </div>

        {/* Right Panel */}
        {store.rightPanelOpen && (
          <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden z-20 shadow-md">
            <RightPanel />
          </div>
        )}

        {/* Right panel toggle button */}
        <button
          className="absolute z-30 w-4 h-12 bg-white border border-gray-300 rounded-l shadow flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
          style={{ position: "absolute", right: store.rightPanelOpen ? 224 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 30 }}
          onClick={store.toggleRightPanel}
          title={store.rightPanelOpen ? "Close right panel" : "Open right panel"}
        >
          {store.rightPanelOpen ? "▶" : "◀"}
        </button>
      </div>

      {/* Timeline */}
      <Timeline />

      {/* Toast notifications */}
      <Toast />
    </div>
  );
};

export default AnimationStudio;
