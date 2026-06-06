import React, { useRef, useState } from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing, degToRad } from "../utils/helpers";
import { getDrawingTransform } from "../utils/geometry";

const FRAME_W = 52;
const FRAME_H = 52;

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
    <div className="flex flex-col bg-white border-t border-gray-200 select-none shrink-0" style={{ height: 100 }}>
      {/* Controls row */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-semibold text-gray-600 mr-1">Timeline</span>

        <button
          className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700"
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

        <span className="text-xs text-gray-500">
          Frame {store.currentFrameIndex + 1} / {store.frames.length}
        </span>

        <button
          className={`text-xs rounded px-2 py-0.5 font-medium ${
            store.isPlaying ? "bg-red-500 text-white" : "bg-green-500 text-white"
          }`}
          onClick={() => store.isPlaying ? store.stopPlayback() : store.startPlayback()}
        >{store.isPlaying ? "⏹ Stop" : "▶ Play"}</button>
      </div>

      {/* Frames scrollable area */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto px-2 py-1">
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
              className={`shrink-0 cursor-pointer rounded border-2 transition-all flex flex-col items-center justify-center relative ${
                isActive
                  ? "border-blue-600 bg-blue-50 shadow-md"
                  : isDragTarget
                  ? "border-yellow-400 bg-yellow-50"
                  : isDragSource
                  ? "border-gray-300 opacity-50"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
              style={{ width: FRAME_W, height: FRAME_H }}
            >
              <FrameThumbnail frameIndex={index} />

              <span className={`absolute bottom-0.5 right-1 text-[9px] font-mono font-bold ${
                isActive ? "text-blue-700" : "text-gray-400"
              }`}>
                {index + 1}
              </span>

              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
              )}
            </div>
          );
        })}

        {/* Add frame button */}
        <button
          onClick={() => store.addFrame()}
          className="shrink-0 w-10 h-10 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-lg"
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

    const W = 40;
    const H = 34;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);

    const scale = Math.min(W / store.canvasWidth, H / store.canvasHeight) * 0.9;
    const offX = (W - store.canvasWidth * scale) / 2;
    const offY = (H - store.canvasHeight * scale) / 2;

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

      for (const stroke of drawing.strokes) {
        if (stroke.tool === "eraser") continue;
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width * 0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      }

      if (drawing.shapeType && drawing.shapeData) {
        const d = drawing.shapeData;
        ctx.strokeStyle = drawing.strokeColor;
        ctx.lineWidth = drawing.strokeWidth * 0.5;
        ctx.beginPath();
        if (drawing.shapeType === "rect") ctx.rect(d.x, d.y, d.width, d.height);
        else if (drawing.shapeType === "circle") {
          ctx.ellipse(d.x + d.width / 2, d.y + d.height / 2, Math.abs(d.width / 2), Math.abs(d.height / 2), 0, 0, Math.PI * 2);
        }
        if (drawing.fillColor) { ctx.fillStyle = drawing.fillColor; ctx.fill(); }
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  });

  return <canvas ref={canvasRef} width={40} height={34} className="rounded" />;
};

export default Timeline;
