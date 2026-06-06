import React, { useRef, useState } from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing, degToRad } from "../utils/helpers";
import { getDrawingTransform } from "../utils/geometry";

const FRAME_W = 80;
const FRAME_H = 72;
const THUMB_W = 66;
const THUMB_H = 50;

const Timeline: React.FC = () => {
  const store = useAnimationStore();
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleFrameClick = (index: number) => {
    if (store.isPlaying) return;
    store.setCurrentFrame(index);
  };

  const handleDragStart = (index: number) => setDragFromIdx(index);
  const handleDragOver = (index: number) => setDragOverIdx(index);

  const handleDragEnd = () => {
    if (dragFromIdx !== null && dragOverIdx !== null && dragFromIdx !== dragOverIdx) {
      store.reorderFrame(dragFromIdx, dragOverIdx);
    }
    setDragFromIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div
      className="flex flex-col bg-white border-t border-gray-300 select-none shrink-0"
      style={{ height: 120 }}
    >
      {/* Controls row */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="text-xs font-bold text-gray-700 mr-1">Timeline</span>

        <button
          className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 font-medium"
          onClick={() => store.addFrame()}
          title="Add Frame"
        >+ Frame</button>

        <button
          className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-0.5 hover:bg-gray-300"
          onClick={() => store.duplicateFrame(store.currentFrameIndex)}
          title="Duplicate current frame"
        >⧉ Dup</button>

        <button
          className="text-xs bg-red-100 text-red-700 rounded px-2 py-0.5 hover:bg-red-200"
          onClick={() => store.deleteFrame(store.currentFrameIndex)}
          disabled={store.frames.length <= 1}
          title="Delete current frame"
        >✕ Del</button>

        <div className="flex-1" />

        <span className="text-xs font-semibold text-gray-600">
          Frame <span className="text-blue-600">{store.currentFrameIndex + 1}</span> / {store.frames.length}
        </span>

        <button
          className={`text-xs rounded px-3 py-0.5 font-bold ${
            store.isPlaying ? "bg-red-500 text-white" : "bg-green-500 text-white"
          }`}
          onClick={() => store.isPlaying ? store.stopPlayback() : store.startPlayback()}
        >{store.isPlaying ? "⏹ Stop" : "▶ Play"}</button>
      </div>

      {/* Frames scrollable area */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto px-3 py-1.5 min-h-0">
        {store.frames.map((frame, index) => {
          const isActive = index === store.currentFrameIndex;
          const isDragSource = index === dragFromIdx;
          const isDragTarget = index === dragOverIdx;

          return (
            <div
              key={frame.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
              onDragEnd={handleDragEnd}
              onClick={() => handleFrameClick(index)}
              title={`Frame ${index + 1} — click to select`}
              className={`shrink-0 cursor-pointer rounded-lg border-2 transition-all flex flex-col items-center overflow-hidden relative shadow-sm ${
                isActive
                  ? "border-blue-600 shadow-blue-200 shadow-md"
                  : isDragTarget
                  ? "border-yellow-400 bg-yellow-50"
                  : isDragSource
                  ? "border-gray-300 opacity-40"
                  : "border-gray-300 bg-white hover:border-blue-400 hover:shadow-md"
              }`}
              style={{ width: FRAME_W, height: FRAME_H }}
            >
              {/* Thumbnail area */}
              <div
                className={`flex items-center justify-center ${isActive ? "bg-blue-50" : "bg-gray-50"}`}
                style={{ width: FRAME_W, height: THUMB_H }}
              >
                <FrameThumbnail frameIndex={index} />
              </div>

              {/* Frame number label */}
              <div
                className={`w-full text-center text-[10px] font-bold py-0.5 ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {index + 1}
              </div>

              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </div>
          );
        })}

        {/* Add frame button */}
        <button
          onClick={() => store.addFrame()}
          className="shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-2xl font-light"
          style={{ width: FRAME_W - 10, height: FRAME_H - 10 }}
          title="Add new frame"
        >+</button>
      </div>
    </div>
  );
};

const FrameThumbnail: React.FC<{ frameIndex: number }> = ({ frameIndex }) => {
  const store = useAnimationStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = THUMB_W;
    const H = THUMB_H - 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const cw = store.canvasWidth || 1280;
    const ch = store.canvasHeight || 720;
    const scale = Math.min(W / cw, H / ch) * 0.92;
    const offX = (W - cw * scale) / 2;
    const offY = (H - ch * scale) / 2;

    // Draw canvas border in thumbnail
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.strokeRect(offX, offY, cw * scale, ch * scale);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);

    const orderedIds: string[] = [];
    store.layers.forEach((l) => {
      if (!l.visible) return;
      l.drawingIds.forEach((id) => orderedIds.push(id));
    });

    for (const id of orderedIds) {
      const drawing = getEffectiveDrawing(store.drawings, store.frames, id, frameIndex);
      if (!drawing || !drawing.visible) continue;

      ctx.save();
      ctx.globalAlpha = drawing.opacity;

      const t = getDrawingTransform(drawing);
      ctx.translate(t.x + t.pivotX, t.y + t.pivotY);
      ctx.rotate(degToRad(t.rotation));
      ctx.scale(t.scaleX, t.scaleY);
      ctx.translate(-t.pivotX, -t.pivotY);

      // Render strokes with smooth bezier
      for (const stroke of drawing.strokes) {
        if (stroke.tool === "eraser" || stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(stroke.width * 0.8, 1.5 / scale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
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

      // Render shapes
      if (drawing.shapeType && drawing.shapeData) {
        const d = drawing.shapeData;
        ctx.strokeStyle = drawing.strokeColor;
        ctx.lineWidth = Math.max(drawing.strokeWidth * 0.8, 1.5 / scale);
        ctx.beginPath();
        if (drawing.shapeType === "rect") {
          ctx.rect(d.x, d.y, d.width, d.height);
        } else if (drawing.shapeType === "circle") {
          ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2, Math.abs(d.width / 2), Math.abs(d.height / 2), 0, 0, Math.PI * 2);
        } else if (drawing.shapeType === "line" && d.x1 !== undefined) {
          ctx.moveTo(d.x1!, d.y1!);
          ctx.lineTo(d.x2!, d.y2!);
        }
        if (drawing.fillColor) {
          ctx.fillStyle = drawing.fillColor;
          ctx.fill();
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  });

  return (
    <canvas
      ref={canvasRef}
      width={THUMB_W}
      height={THUMB_H - 2}
      className="block"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default Timeline;
