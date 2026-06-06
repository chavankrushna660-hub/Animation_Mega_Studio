import React, { useState, useRef } from "react";
import { useAnimationStore } from "../store/useAnimationStore";
import { getEffectiveDrawing } from "../utils/helpers";
import type { Drawing, PivotPoint, Bone } from "../types";

const LeftPanel: React.FC = () => {
  const store = useAnimationStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showParentMenu, setShowParentMenu] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const finishEdit = (id: string) => {
    if (editName.trim()) store.renameDrawing(id, editName.trim());
    setEditingId(null);
  };

  const handleSelect = (id: string) => {
    if (store.selection.drawingId === id) {
      store.selectDrawing(null);
    } else {
      store.selectDrawing(id);
    }
  };

  const getDrawingList = () => {
    const allIds = new Set<string>();
    store.layers.forEach((l) => l.drawingIds.forEach((id) => allIds.add(id)));
    return Array.from(allIds);
  };

  const getRootDrawings = (layerId: string) => {
    const layer = store.layers.find((l) => l.id === layerId);
    if (!layer) return [];
    return layer.drawingIds.filter((id) => {
      const d = store.drawings[id];
      return d && !d.parentId;
    });
  };

  const renderDrawingTree = (drawingId: string, depth = 0): React.ReactNode => {
    const drawing = getEffectiveDrawing(store.drawings, store.frames, drawingId, store.currentFrameIndex);
    if (!drawing) return null;
    const isSelected = store.selection.drawingId === drawingId;
    const isExpanded = expandedIds.has(drawingId);
    const hasChildren = drawing.childIds.length > 0 || drawing.pivotPoints.length > 0 || drawing.bones.length > 0;
    const otherDrawingIds = getDrawingList().filter((id) => id !== drawingId);

    return (
      <div key={drawingId}>
        <div
          className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded text-sm group ${
            isSelected ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100 text-gray-700"
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => handleSelect(drawingId)}
        >
          {/* Expand toggle */}
          <button
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0"
            onClick={(e) => { e.stopPropagation(); toggleExpand(drawingId); }}
          >
            {hasChildren ? (isExpanded ? "▼" : "▶") : "·"}
          </button>

          {/* Visibility */}
          <button
            className="w-4 h-4 text-xs shrink-0 opacity-60 hover:opacity-100"
            title="Toggle visibility"
            onClick={(e) => { e.stopPropagation(); store.updateDrawing(drawingId, { visible: !drawing.visible }); }}
          >
            {drawing.visible ? "👁" : "🔒"}
          </button>

          {/* Name */}
          {editingId === drawingId ? (
            <input
              className="flex-1 text-xs border rounded px-1"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => finishEdit(drawingId)}
              onKeyDown={(e) => { if (e.key === "Enter") finishEdit(drawingId); }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 truncate text-xs"
              onDoubleClick={(e) => { e.stopPropagation(); startEdit(drawingId, drawing.name); }}
            >
              {drawing.shapeType ? `[${drawing.shapeType}] ` : ""}{drawing.name}
              {drawing.parentId && <span className="text-xs text-gray-400 ml-1">↳</span>}
            </span>
          )}

          {/* Actions */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              className="px-1 text-xs text-gray-500 hover:text-blue-600"
              title="Set Parent"
              onClick={(e) => { e.stopPropagation(); setShowParentMenu(showParentMenu === drawingId ? null : drawingId); setShowAttachMenu(null); }}
            >P</button>
            <button
              className="px-1 text-xs text-gray-500 hover:text-green-600"
              title="Keep Attached To"
              onClick={(e) => { e.stopPropagation(); setShowAttachMenu(showAttachMenu === drawingId ? null : drawingId); setShowParentMenu(null); }}
            >A</button>
            <button
              className="px-1 text-xs text-gray-500 hover:text-red-600"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); store.deleteDrawing(drawingId); }}
            >✕</button>
            <button
              className="px-1 text-xs text-gray-500 hover:text-purple-600"
              title="Duplicate"
              onClick={(e) => { e.stopPropagation(); store.duplicateDrawing(drawingId); }}
            >⧉</button>
          </div>
        </div>

        {/* Parent menu */}
        {showParentMenu === drawingId && (
          <div className="ml-8 mr-2 bg-white border rounded shadow-lg z-50 text-xs">
            <div className="px-2 py-1 font-medium text-gray-600 border-b">Set Parent:</div>
            <div
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-red-500"
              onClick={() => { store.setParent(drawingId, null); setShowParentMenu(null); }}
            >None (remove parent)</div>
            {otherDrawingIds.map((pid) => {
              const pd = store.drawings[pid];
              if (!pd) return null;
              return (
                <div
                  key={pid}
                  className={`px-2 py-1 hover:bg-blue-50 cursor-pointer ${drawing.parentId === pid ? "bg-blue-100 font-medium" : ""}`}
                  onClick={() => { store.setParent(drawingId, pid); setShowParentMenu(null); }}
                >{pd.name}</div>
              );
            })}
          </div>
        )}

        {/* Attach menu */}
        {showAttachMenu === drawingId && (
          <div className="ml-8 mr-2 bg-white border rounded shadow-lg z-50 text-xs">
            <div className="px-2 py-1 font-medium text-gray-600 border-b">Keep Attached To:</div>
            <div
              className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-red-500"
              onClick={() => { store.setKeepAttachedTo(drawingId, null); setShowAttachMenu(null); }}
            >None</div>
            {otherDrawingIds.map((aid) => {
              const ad = store.drawings[aid];
              if (!ad) return null;
              return (
                <div
                  key={aid}
                  className={`px-2 py-1 hover:bg-green-50 cursor-pointer ${drawing.keepAttachedToId === aid ? "bg-green-100 font-medium" : ""}`}
                  onClick={() => { store.setKeepAttachedTo(drawingId, aid); setShowAttachMenu(null); }}
                >{ad.name}</div>
              );
            })}
          </div>
        )}

        {/* Children */}
        {isExpanded && (
          <div>
            {/* Pivot points */}
            {drawing.pivotPoints.map((pivot) => (
              <PivotItem
                key={pivot.id}
                pivot={pivot}
                drawingId={drawingId}
                depth={depth + 1}
                isActive={drawing.activePivotId === pivot.id}
                onSelect={() => store.setActivePivot(drawingId, pivot.id)}
                onDelete={() => store.deletePivotPoint(drawingId, pivot.id)}
                onToggleLock={() => store.lockPivotPoint(drawingId, pivot.id, !pivot.locked)}
                onRename={(name) => store.updatePivotPoint(drawingId, pivot.id, { name })}
              />
            ))}

            {/* Bones */}
            {drawing.bones.map((bone) => (
              <BoneItem
                key={bone.id}
                bone={bone}
                drawingId={drawingId}
                depth={depth + 1}
                onDelete={() => store.deleteBone(drawingId, bone.id)}
                onToggleConnection={() => store.updateBone(drawingId, bone.id, { connectionEnabled: !bone.connectionEnabled })}
                onRename={(name) => store.updateBone(drawingId, bone.id, { name })}
                onSetConnectionSource={() => store.setBoneConnectionSource(bone.id)}
              />
            ))}

            {/* Child drawings */}
            {drawing.childIds.map((cid) => renderDrawingTree(cid, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Layers & Objects</span>
        <button
          onClick={store.addLayer}
          className="text-xs text-blue-600 hover:text-blue-800"
          title="Add Layer"
        >+ Layer</button>
      </div>

      {/* Layer tabs */}
      <div className="flex gap-1 px-2 py-1 bg-white border-b border-gray-200 overflow-x-auto">
        {store.layers.map((layer) => (
          <button
            key={layer.id}
            className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
              layer.id === store.activeLayerId
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
            onClick={() => store.setActiveLayer(layer.id)}
          >
            {layer.name}
          </button>
        ))}
      </div>

      {/* Drawing tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {store.layers.map((layer) => {
          if (layer.id !== store.activeLayerId) return null;
          const rootIds = getRootDrawings(layer.id);
          if (rootIds.length === 0) {
            return (
              <div key={layer.id} className="text-xs text-gray-400 text-center py-6 px-2">
                No drawings yet.<br />Start drawing on the canvas.
              </div>
            );
          }
          return (
            <div key={layer.id}>
              {rootIds.map((id) => renderDrawingTree(id, 0))}
            </div>
          );
        })}
      </div>

      {/* Selected drawing properties */}
      {store.selection.drawingId && (() => {
        const drawing = getEffectiveDrawing(store.drawings, store.frames, store.selection.drawingId, store.currentFrameIndex);
        if (!drawing) return null;
        return (
          <div className="border-t border-gray-200 bg-white p-2">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Selected: {drawing.name}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">X:</span>
                <input
                  type="number"
                  className="flex-1 border rounded px-1 py-0.5 text-xs"
                  value={Math.round(drawing.x)}
                  onChange={(e) => store.moveDrawing(store.selection.drawingId!, Number(e.target.value) - drawing.x, 0)}
                />
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.moveDrawing(store.selection.drawingId!, -5, 0)}>◀</button>
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.moveDrawing(store.selection.drawingId!, 5, 0)}>▶</button>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">Y:</span>
                <input
                  type="number"
                  className="flex-1 border rounded px-1 py-0.5 text-xs"
                  value={Math.round(drawing.y)}
                  onChange={(e) => store.moveDrawing(store.selection.drawingId!, 0, Number(e.target.value) - drawing.y)}
                />
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.moveDrawing(store.selection.drawingId!, 0, -5)}>▲</button>
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.moveDrawing(store.selection.drawingId!, 0, 5)}>▼</button>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">Rot:</span>
                <input
                  type="number"
                  className="flex-1 border rounded px-1 py-0.5 text-xs"
                  value={Math.round(drawing.rotation)}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { rotation: Number(e.target.value) })}
                />
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.updateDrawing(store.selection.drawingId!, { rotation: drawing.rotation - 5 })}>↺</button>
                <button className="text-gray-400 hover:text-gray-700 px-0.5" onClick={() => store.updateDrawing(store.selection.drawingId!, { rotation: drawing.rotation + 5 })}>↻</button>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">ScaleX:</span>
                <input
                  type="number"
                  step="0.1"
                  className="flex-1 border rounded px-1 py-0.5 text-xs"
                  value={drawing.scaleX.toFixed(2)}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { scaleX: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">ScaleY:</span>
                <input
                  type="number"
                  step="0.1"
                  className="flex-1 border rounded px-1 py-0.5 text-xs"
                  value={drawing.scaleY.toFixed(2)}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { scaleY: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">Opacity:</span>
                <input
                  type="range" min="0" max="1" step="0.05"
                  className="flex-1"
                  value={drawing.opacity}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { opacity: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">Fill:</span>
                <input
                  type="color"
                  className="w-8 h-5 rounded border"
                  value={drawing.fillColor ?? "#ffffff"}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { fillColor: e.target.value })}
                />
                <button
                  className="text-xs text-red-400 hover:text-red-600"
                  onClick={() => store.updateDrawing(store.selection.drawingId!, { fillColor: null })}
                >No fill</button>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500 w-10">Stroke:</span>
                <input
                  type="color"
                  className="w-8 h-5 rounded border"
                  value={drawing.strokeColor}
                  onChange={(e) => store.updateDrawing(store.selection.drawingId!, { strokeColor: e.target.value })}
                />
              </div>
              <div className="flex gap-1 mt-1">
                <button
                  className="flex-1 text-xs bg-purple-100 text-purple-700 rounded py-0.5 hover:bg-purple-200"
                  onClick={() => store.mirrorDrawing(store.selection.drawingId!, true)}
                >⇔ Mirror H</button>
                <button
                  className="flex-1 text-xs bg-purple-100 text-purple-700 rounded py-0.5 hover:bg-purple-200"
                  onClick={() => store.mirrorDrawing(store.selection.drawingId!, false)}
                >⇕ Mirror V</button>
              </div>
              <button
                className="text-xs bg-red-100 text-red-700 rounded py-0.5 hover:bg-red-200 mt-1"
                onClick={() => { store.deleteDrawing(store.selection.drawingId!); }}
              >🗑 Delete Drawing</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

const PivotItem: React.FC<{
  pivot: PivotPoint;
  drawingId: string;
  depth: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onRename: (name: string) => void;
}> = ({ pivot, depth, isActive, onSelect, onDelete, onToggleLock, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pivot.name);

  return (
    <div
      className={`flex items-center gap-1 px-2 py-0.5 text-xs cursor-pointer rounded group ${
        isActive ? "bg-red-50 text-red-700" : "text-gray-600 hover:bg-gray-50"
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={onSelect}
    >
      <span className="text-red-400">⊕</span>
      {editing ? (
        <input
          className="flex-1 border rounded px-1"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { onRename(name); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(name); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {pivot.name} {pivot.locked ? "🔒" : ""}
        </span>
      )}
      <div className="hidden group-hover:flex gap-0.5">
        <button title="Toggle lock" onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>
          {pivot.locked ? "🔓" : "🔒"}
        </button>
        <button title="Delete" className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(); }}>✕</button>
      </div>
    </div>
  );
};

const BoneItem: React.FC<{
  bone: Bone;
  drawingId: string;
  depth: number;
  onDelete: () => void;
  onToggleConnection: () => void;
  onRename: (name: string) => void;
  onSetConnectionSource: () => void;
}> = ({ bone, depth, onDelete, onToggleConnection, onRename, onSetConnectionSource }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bone.name);

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded group cursor-pointer"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <span>🦴</span>
      {editing ? (
        <input
          className="flex-1 border rounded px-1"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { onRename(name); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(name); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          {bone.name}
          {bone.connectionEnabled && <span className="text-yellow-500 ml-1">⚡</span>}
          {bone.connectedToBoneId && <span className="text-green-500 ml-1">→</span>}
        </span>
      )}
      <div className="hidden group-hover:flex gap-0.5">
        <button
          title={bone.connectionEnabled ? "Disable connection" : "Enable connection"}
          className="text-yellow-500"
          onClick={(e) => { e.stopPropagation(); onToggleConnection(); }}
        >{bone.connectionEnabled ? "⚡" : "○"}</button>
        {bone.connectionEnabled && (
          <button
            title="Start connection"
            className="text-green-500"
            onClick={(e) => { e.stopPropagation(); onSetConnectionSource(); }}
          >→</button>
        )}
        <button title="Delete" className="text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(); }}>✕</button>
      </div>
    </div>
  );
};

export default LeftPanel;
