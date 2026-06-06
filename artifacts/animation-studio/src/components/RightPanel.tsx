import React, { useState } from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing } from "../utils/helpers";

const RightPanel: React.FC = () => {
  const store = useAnimationStore();
  const [activeTab, setActiveTab] = useState<"transform" | "color" | "pivot" | "bone" | "export">("transform");
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const selectedId = store.selection.drawingId;
  const drawing = selectedId
    ? getEffectiveDrawing(store.drawings, store.frames, selectedId, store.currentFrameIndex)
    : null;

  const handleExport = async (type: "mp4" | "gif") => {
    setExportProgress(0);
    try {
      const { exportToMp4, downloadBlob } = await import("../utils/exportUtils");
      const blob = await exportToMp4(store, (p) => setExportProgress(p));
      downloadBlob(blob, `animation.${type === "mp4" ? "webm" : "webm"}`);
    } catch (err) {
      console.error(err);
      alert("Export failed. Please try again.");
    }
    setExportProgress(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-l border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-white border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Properties</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 bg-white overflow-x-auto">
        {(["transform", "color", "pivot", "bone", "export"] as const).map((tab) => (
          <button
            key={tab}
            className={`text-xs px-2 py-1.5 capitalize whitespace-nowrap ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-700 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab)}
          >{tab}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "transform" && (
          <div className="flex flex-col gap-3">
            {!drawing ? (
              <p className="text-xs text-gray-400">Select a drawing to transform it.</p>
            ) : (
              <>
                <Section title="Position">
                  <Row label="X">
                    <NumInput value={Math.round(drawing.x)} onChange={(v) => store.moveDrawing(selectedId!, v - drawing.x, 0)} step={5} />
                  </Row>
                  <Row label="Y">
                    <NumInput value={Math.round(drawing.y)} onChange={(v) => store.moveDrawing(selectedId!, 0, v - drawing.y)} step={5} />
                  </Row>
                </Section>

                <Section title="Rotation">
                  <Row label="°">
                    <NumInput value={Math.round(drawing.rotation)} onChange={(v) => store.updateDrawing(selectedId!, { rotation: v })} step={5} />
                    <button className="text-xs bg-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-300" onClick={() => store.updateDrawing(selectedId!, { rotation: drawing.rotation - 5 })}>-5°</button>
                    <button className="text-xs bg-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-300" onClick={() => store.updateDrawing(selectedId!, { rotation: drawing.rotation + 5 })}>+5°</button>
                    <button className="text-xs bg-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-300" onClick={() => store.updateDrawing(selectedId!, { rotation: 0 })}>Reset</button>
                  </Row>
                </Section>

                <Section title="Scale">
                  <Row label="X">
                    <NumInput value={Number(drawing.scaleX.toFixed(2))} onChange={(v) => store.updateDrawing(selectedId!, { scaleX: v })} step={0.1} min={0.01} />
                  </Row>
                  <Row label="Y">
                    <NumInput value={Number(drawing.scaleY.toFixed(2))} onChange={(v) => store.updateDrawing(selectedId!, { scaleY: v })} step={0.1} min={0.01} />
                  </Row>
                  <div className="flex gap-1">
                    <button className="flex-1 text-xs bg-gray-200 rounded py-0.5 hover:bg-gray-300" onClick={() => store.updateDrawing(selectedId!, { scaleX: drawing.scaleX * 1.1, scaleY: drawing.scaleY * 1.1 })}>Scale+10%</button>
                    <button className="flex-1 text-xs bg-gray-200 rounded py-0.5 hover:bg-gray-300" onClick={() => store.updateDrawing(selectedId!, { scaleX: drawing.scaleX * 0.9, scaleY: drawing.scaleY * 0.9 })}>Scale-10%</button>
                  </div>
                </Section>

                <Section title="Opacity">
                  <Row label="%">
                    <input type="range" min="0" max="1" step="0.05" className="flex-1"
                      value={drawing.opacity}
                      onChange={(e) => store.updateDrawing(selectedId!, { opacity: Number(e.target.value) })}
                    />
                    <span className="text-xs w-10 text-right">{Math.round(drawing.opacity * 100)}%</span>
                  </Row>
                </Section>

                <Section title="Stroke Width">
                  <Row label="W">
                    <NumInput value={drawing.strokeWidth} onChange={(v) => store.updateDrawing(selectedId!, { strokeWidth: v })} step={1} min={0.5} />
                  </Row>
                </Section>

                <Section title="Mirror">
                  <div className="flex gap-1">
                    <button className="flex-1 text-xs bg-purple-100 text-purple-700 rounded py-1 hover:bg-purple-200" onClick={() => store.mirrorDrawing(selectedId!, true)}>⇔ Horizontal</button>
                    <button className="flex-1 text-xs bg-purple-100 text-purple-700 rounded py-1 hover:bg-purple-200" onClick={() => store.mirrorDrawing(selectedId!, false)}>⇕ Vertical</button>
                  </div>
                </Section>

                <Section title="Visibility">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={drawing.visible} onChange={(e) => store.updateDrawing(selectedId!, { visible: e.target.checked })} />
                    Visible
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={drawing.locked} onChange={(e) => store.updateDrawing(selectedId!, { locked: e.target.checked })} />
                    Locked
                  </label>
                </Section>
              </>
            )}

            <Section title="Transform Handle Size">
              <Row label="Size">
                <NumInput value={store.transformHandleSize} onChange={(v) => store.setTransformHandleSize(v)} step={10} min={8} max={1000} />
              </Row>
              <div className="flex gap-1">
                <button className="flex-1 text-xs bg-blue-100 text-blue-700 rounded py-0.5 hover:bg-blue-200" onClick={() => store.setTransformHandleSize(store.transformHandleSize - 10)}>Smaller</button>
                <button className="flex-1 text-xs bg-blue-100 text-blue-700 rounded py-0.5 hover:bg-blue-200" onClick={() => store.setTransformHandleSize(store.transformHandleSize + 10)}>Larger</button>
              </div>
              <div className="text-xs text-gray-400">Current: {store.transformHandleSize}px (8–1000px, touch-safe)</div>
            </Section>
          </div>
        )}

        {activeTab === "color" && (
          <div className="flex flex-col gap-3">
            <Section title="Stroke Color">
              <input
                type="color"
                className="w-full h-10 rounded cursor-pointer border"
                value={store.strokeColor}
                onChange={(e) => store.setStrokeColor(e.target.value)}
              />
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-xs font-mono"
                value={store.strokeColor}
                onChange={(e) => store.setStrokeColor(e.target.value)}
              />
            </Section>

            <Section title="Fill Color">
              <input
                type="color"
                className="w-full h-10 rounded cursor-pointer border"
                value={store.fillColor}
                onChange={(e) => store.setFillColor(e.target.value)}
              />
              <input
                type="text"
                className="w-full border rounded px-2 py-1 text-xs font-mono"
                value={store.fillColor}
                onChange={(e) => store.setFillColor(e.target.value)}
              />
            </Section>

            <Section title="Stroke Width">
              <Row label="px">
                <NumInput value={store.strokeWidth} onChange={store.setStrokeWidth} step={1} min={0.5} max={100} />
              </Row>
              <input type="range" min="0.5" max="50" step="0.5" className="w-full"
                value={store.strokeWidth}
                onChange={(e) => store.setStrokeWidth(Number(e.target.value))}
              />
            </Section>

            <Section title="Brush Opacity">
              <Row label="%">
                <input type="range" min="0" max="1" step="0.05" className="flex-1"
                  value={store.brushOpacity}
                  onChange={(e) => store.setBrushOpacity(Number(e.target.value))}
                />
                <span className="text-xs w-10 text-right">{Math.round(store.brushOpacity * 100)}%</span>
              </Row>
            </Section>

            {drawing && (
              <>
                <Section title="Drawing Fill Color">
                  <input
                    type="color"
                    className="w-full h-8 rounded cursor-pointer border"
                    value={drawing.fillColor ?? "#ffffff"}
                    onChange={(e) => store.updateDrawing(selectedId!, { fillColor: e.target.value })}
                  />
                  <div className="flex gap-1">
                    <button className="flex-1 text-xs bg-red-100 text-red-600 rounded py-0.5 hover:bg-red-200"
                      onClick={() => store.updateDrawing(selectedId!, { fillColor: null })}>
                      No Fill
                    </button>
                    <button className="flex-1 text-xs bg-blue-100 text-blue-600 rounded py-0.5 hover:bg-blue-200"
                      onClick={() => store.updateDrawing(selectedId!, { fillColor: store.fillColor })}>
                      Use Global
                    </button>
                  </div>
                </Section>

                <Section title="Fill Opacity">
                  <Row label="%">
                    <input type="range" min="0" max="1" step="0.05" className="flex-1"
                      value={drawing.fillOpacity}
                      onChange={(e) => store.updateDrawing(selectedId!, { fillOpacity: Number(e.target.value) })}
                    />
                    <span className="text-xs w-10">{Math.round(drawing.fillOpacity * 100)}%</span>
                  </Row>
                </Section>

                <Section title="Color Lines">
                  <div className="flex gap-1">
                    <button className="flex-1 text-xs bg-green-100 text-green-700 rounded py-1 hover:bg-green-200"
                      onClick={() => store.addColorLine(selectedId!, true)}>+ Horizontal</button>
                    <button className="flex-1 text-xs bg-green-100 text-green-700 rounded py-1 hover:bg-green-200"
                      onClick={() => store.addColorLine(selectedId!, false)}>+ Vertical</button>
                  </div>
                  {drawing.colorLines.map((line) => (
                    <div key={line.id} className="flex items-center gap-1 text-xs">
                      <span className="text-gray-500">{line.horizontal ? "H" : "V"} line</span>
                      <button className="text-red-400 hover:text-red-600 ml-auto"
                        onClick={() => store.deleteColorLine(selectedId!, line.id)}>✕</button>
                    </div>
                  ))}
                </Section>
              </>
            )}
          </div>
        )}

        {activeTab === "pivot" && (
          <div className="flex flex-col gap-3">
            {!drawing ? (
              <p className="text-xs text-gray-400">Select a drawing first, then use the Pivot tool.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Pivot points become the transform origin for the selected drawing.
                  Select the <strong>Pivot</strong> tool and click on the drawing to add pivot points.
                </p>
                <Section title={`Pivots (${drawing.pivotPoints.length})`}>
                  {drawing.pivotPoints.length === 0 && (
                    <p className="text-xs text-gray-400">No pivot points. Use Pivot tool to add them.</p>
                  )}
                  {drawing.pivotPoints.map((pivot) => (
                    <div key={pivot.id} className={`flex items-center gap-1 text-xs p-1 rounded ${pivot.id === drawing.activePivotId ? "bg-red-50" : "bg-gray-50"}`}>
                      <button
                        className="text-red-500 font-bold"
                        onClick={() => store.setActivePivot(selectedId!, pivot.id)}
                      >⊕</button>
                      <span className="flex-1">{pivot.name}</span>
                      <span className="text-gray-400">{Math.round(pivot.x)},{Math.round(pivot.y)}</span>
                      <button
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => store.lockPivotPoint(selectedId!, pivot.id, !pivot.locked)}
                      >{pivot.locked ? "🔒" : "🔓"}</button>
                      <button className="text-red-400" onClick={() => store.deletePivotPoint(selectedId!, pivot.id)}>✕</button>
                    </div>
                  ))}
                </Section>

                <Section title="Active Pivot Transform">
                  {drawing.activePivotId ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Active pivot: {drawing.pivotPoints.find((p) => p.id === drawing.activePivotId)?.name}</p>
                      <p className="text-xs text-gray-400">This pivot point is the rotation center. Transforms rotate around this point.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No active pivot selected.</p>
                  )}
                </Section>
              </>
            )}
          </div>
        )}

        {activeTab === "bone" && (
          <div className="flex flex-col gap-3">
            {!drawing ? (
              <p className="text-xs text-gray-400">Select a drawing first, then use the Bone tool.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Bones create a rig for animating the drawing.
                  Use the <strong>Bone</strong> tool to add bones.
                </p>
                <Section title={`Bones (${drawing.bones.length})`}>
                  {drawing.bones.length === 0 && (
                    <p className="text-xs text-gray-400">No bones. Use Bone tool to add them.</p>
                  )}
                  {drawing.bones.map((bone) => (
                    <div key={bone.id} className="flex flex-col gap-1 p-1 bg-blue-50 rounded text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-blue-600">🦴</span>
                        <span className="flex-1 font-medium">{bone.name}</span>
                        <button className="text-red-400" onClick={() => store.deleteBone(selectedId!, bone.id)}>✕</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bone.connectionEnabled}
                            onChange={() => store.updateBone(selectedId!, bone.id, { connectionEnabled: !bone.connectionEnabled })}
                          />
                          Enable Connection
                        </label>
                      </div>
                      {bone.connectionEnabled && (
                        <div className="flex gap-1">
                          <button
                            className="flex-1 text-xs bg-yellow-100 text-yellow-700 rounded py-0.5 hover:bg-yellow-200"
                            onClick={() => { store.setActiveTool("bone"); store.setBoneConnectionSource(bone.id); }}
                          >Start Connection</button>
                          {bone.connectedToBoneId && (
                            <button
                              className="text-red-400 text-xs"
                              onClick={() => store.updateBone(selectedId!, bone.id, { connectedToBoneId: null })}
                            >Disconnect</button>
                          )}
                        </div>
                      )}
                      {bone.connectedToBoneId && (
                        <span className="text-green-600">↳ Connected</span>
                      )}
                    </div>
                  ))}
                </Section>
              </>
            )}
          </div>
        )}

        {activeTab === "export" && (
          <div className="flex flex-col gap-3">
            <Section title="Canvas Size">
              <Row label="W">
                <NumInput value={store.exportWidth || store.canvasWidth} onChange={(_v) => {}} step={10} />
              </Row>
              <Row label="H">
                <NumInput value={store.exportHeight || store.canvasHeight} onChange={(_v) => {}} step={10} />
              </Row>
            </Section>

            <Section title="Export FPS">
              <Row label="FPS">
                <NumInput value={store.fps} onChange={(v) => store.setFps(v)} step={1} min={1} max={60} />
              </Row>
            </Section>

            <Section title="Export Video">
              {exportProgress !== null ? (
                <div>
                  <div className="w-full bg-gray-200 rounded h-2 mb-1">
                    <div className="bg-blue-600 h-2 rounded" style={{ width: `${exportProgress}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">{exportProgress}% - Exporting...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    className="w-full text-sm bg-blue-600 text-white rounded py-2 hover:bg-blue-700 font-medium"
                    onClick={() => handleExport("mp4")}
                  >⬇ Export WebM/MP4</button>
                  <p className="text-xs text-gray-400">
                    Video is recorded in real-time. Make sure all {store.frames.length} frames are ready.
                    Export records the canvas in real-time as a WebM file playable in all browsers.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Canvas Settings">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={store.showGrid} onChange={store.toggleGrid} />
                Show Grid
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={store.onionSkinning} onChange={store.toggleOnionSkinning} />
                Onion Skinning
              </label>
              {store.onionSkinning && (
                <div className="flex gap-1 text-xs">
                  <span className="text-gray-500">Prev frames:</span>
                  <NumInput value={store.onionPrevFrames} onChange={(v) => store.setOnionFrames(v, store.onionNextFrames)} step={1} min={0} max={5} />
                  <span className="text-gray-500">Next:</span>
                  <NumInput value={store.onionNextFrames} onChange={(v) => store.setOnionFrames(store.onionPrevFrames, v)} step={1} min={0} max={5} />
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</div>
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-1">
    <span className="text-xs text-gray-500 w-8">{label}</span>
    {children}
  </div>
);

const NumInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}> = ({ value, onChange, step = 1, min, max }) => (
  <div className="flex items-center gap-0.5 flex-1">
    <button
      className="text-xs bg-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-300 shrink-0"
      onClick={() => onChange(min !== undefined ? Math.max(min, value - step) : value - step)}
    >-</button>
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      className="flex-1 border rounded px-1 py-0.5 text-xs text-center min-w-0"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <button
      className="text-xs bg-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-300 shrink-0"
      onClick={() => onChange(max !== undefined ? Math.min(max, value + step) : value + step)}
    >+</button>
  </div>
);

export default RightPanel;
