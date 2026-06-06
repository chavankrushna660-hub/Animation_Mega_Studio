import type { AppState } from "../types";
import { getEffectiveDrawing } from "./helpers";
import { renderDrawing } from "./canvasRenderer";

export async function exportToMp4(
  state: AppState,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { canvasWidth, canvasHeight, fps, frames, drawings, layers, exportFps } = state;
    const targetFps = exportFps || fps || 12;

    const offscreen = document.createElement("canvas");
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const ctx = offscreen.getContext("2d")!;

    const stream = offscreen.captureStream(targetFps);
    const chunks: BlobPart[] = [];

    // Try VP9 first, fall back to VP8
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.onerror = (e) => reject(e);

    recorder.start();

    const frameDuration = 1000 / targetFps;
    let frameIdx = 0;

    function renderNextFrame() {
      if (frameIdx >= frames.length) {
        recorder.stop();
        onProgress?.(100);
        return;
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Render ordered drawings
      const orderedIds: string[] = [];
      layers.forEach((layer) => {
        if (!layer.visible) return;
        layer.drawingIds.forEach((id) => orderedIds.push(id));
      });

      for (const id of orderedIds) {
        const drawing = getEffectiveDrawing(drawings, frames, id, frameIdx);
        if (!drawing || !drawing.visible) continue;
        ctx.save();
        ctx.globalAlpha = drawing.opacity;
        renderDrawing(ctx, drawing, state.fillColor);
        ctx.restore();
      }

      onProgress?.(Math.round((frameIdx / frames.length) * 100));
      frameIdx++;
      setTimeout(renderNextFrame, frameDuration);
    }

    // Small delay to let recorder start
    setTimeout(renderNextFrame, 100);
  });
}

export async function exportToGif(
  state: AppState,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // Use video export as fallback since GIF encoding needs a library
  return exportToMp4(state, onProgress);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
