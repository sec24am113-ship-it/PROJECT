import React, { useState, useRef, useCallback } from "react";
import "./BlueprintImporter.css";

/**
 * BlueprintImporter
 * ─────────────────
 * Lets the user upload a floor-plan image and converts it to a
 * cell grid (room / wall / exit / empty) that the EvacuationSimulator
 * can load directly into its editor.
 *
 * Props:
 *   onGridImported(grid, rows, cols)  – called when the user confirms import
 */
export default function BlueprintImporter({ onGridImported }) {
  // ── State ──────────────────────────────────────────────────────────────
  const [imageFile,   setImageFile]   = useState(null);
  const [imageUrl,    setImageUrl]    = useState(null);
  const [gridRows,    setGridRows]    = useState(50);
  const [gridCols,    setGridCols]    = useState(50);
  const [threshold,   setThreshold]   = useState(160);
  const [loading,     setLoading]     = useState(false);
  const [preview,     setPreview]     = useState(null); // parsed grid for visual preview
  const [stats,       setStats]       = useState(null);
  const [error,       setError]       = useState(null);

  const previewCanvasRef = useRef(null);
  const fileInputRef     = useRef(null);

  // ── Colour map for preview canvas ──────────────────────────────────────
  const CELL_COLORS = {
    room:  "#1e3a5a",
    wall:  "#0a0e17",
    exit:  "#00cc66",
    empty: "#0a0e17",
  };

  // ── Draw parsed grid onto preview canvas ───────────────────────────────
  const drawPreview = useCallback((grid, rows, cols) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !grid.length) return;

    const CELL = Math.max(2, Math.floor(300 / Math.max(rows, cols)));
    canvas.width  = cols * CELL;
    canvas.height = rows * CELL;

    const ctx = canvas.getContext("2d");
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]?.[c] ?? "empty";
        ctx.fillStyle = CELL_COLORS[cell] ?? "#0a0e17";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }, []);

  // ── File selection ──────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setPreview(null);
    setStats(null);
    setError(null);
  };

  // ── Call backend to parse blueprint → grid ──────────────────────────────
  const handleParse = async () => {
    if (!imageFile) return;

    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", imageFile);

      const url = new URL("http://localhost:8000/parse-blueprint-to-grid");
      url.searchParams.set("grid_rows",      gridRows);
      url.searchParams.set("grid_cols",      gridCols);
      url.searchParams.set("wall_threshold", threshold);

      const res = await fetch(url.toString(), { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error("Parse failed");

      setPreview(data.grid);
      setStats({
        rooms: data.room_count,
        exits: data.exit_count,
        rows:  data.rows,
        cols:  data.cols,
      });

      // Render preview canvas after state update
      requestAnimationFrame(() => drawPreview(data.grid, data.rows, data.cols));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Re-parse when settings change (if image already loaded) ────────────
  const handleSettingsChange = () => {
    if (imageFile) handleParse();
  };

  // ── Confirm import – pass grid up to parent ─────────────────────────────
  const handleImport = () => {
    if (!preview || !stats) return;
    onGridImported(preview, stats.rows, stats.cols);
  };

  // ── Drag-and-drop support ───────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setPreview(null);
      setStats(null);
      setError(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="bp-importer">
      {/* ── Upload zone ── */}
      <div
        className={`bp-dropzone ${imageUrl ? "bp-dropzone--has-image" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        {imageUrl ? (
          <img src={imageUrl} alt="Blueprint" className="bp-source-img" />
        ) : (
          <div className="bp-dropzone-hint">
            <span className="bp-icon">🏗</span>
            <p>Drop blueprint image here</p>
            <p className="bp-sub">or click to browse</p>
            <p className="bp-sub">PNG · JPG · BMP · TIFF</p>
          </div>
        )}
      </div>

      {/* ── Settings ── */}
      <div className="bp-settings">
        <div className="bp-settings-title">// GRID SETTINGS</div>

        <label className="bp-label">
          Rows
          <span className="bp-val">{gridRows}</span>
        </label>
        <input
          type="range" min="10" max="200" step="5"
          value={gridRows}
          onChange={(e) => setGridRows(Number(e.target.value))}
          className="bp-slider"
        />

        <label className="bp-label">
          Columns
          <span className="bp-val">{gridCols}</span>
        </label>
        <input
          type="range" min="10" max="200" step="5"
          value={gridCols}
          onChange={(e) => setGridCols(Number(e.target.value))}
          className="bp-slider"
        />

        <label className="bp-label">
          Wall threshold
          <span className="bp-val">{threshold}</span>
          <span className="bp-hint">(lower = more walls)</span>
        </label>
        <input
          type="range" min="50" max="240" step="5"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="bp-slider"
        />
      </div>

      {/* ── Parse button ── */}
      <button
        className="bp-btn bp-btn--parse"
        onClick={handleParse}
        disabled={!imageFile || loading}
      >
        {loading ? "⏳ Parsing…" : "🔍 Parse Blueprint"}
      </button>

      {/* ── Error ── */}
      {error && (
        <div className="bp-error">⚠ {error}</div>
      )}

      {/* ── Preview ── */}
      {preview && (
        <div className="bp-preview">
          <div className="bp-preview-title">// GRID PREVIEW</div>

          <canvas ref={previewCanvasRef} className="bp-canvas" />

          {/* Stats */}
          {stats && (
            <div className="bp-stats">
              <div className="bp-stat">
                <span className="bp-stat-val">{stats.rows}×{stats.cols}</span>
                <span className="bp-stat-lbl">GRID SIZE</span>
              </div>
              <div className="bp-stat">
                <span className="bp-stat-val" style={{ color: "#60b8ff" }}>{stats.rooms}</span>
                <span className="bp-stat-lbl">ROOM CELLS</span>
              </div>
              <div className="bp-stat">
                <span className="bp-stat-val" style={{ color: "#00cc66" }}>{stats.exits}</span>
                <span className="bp-stat-lbl">EXIT CELLS</span>
              </div>
            </div>
          )}

          {/* Colour legend */}
          <div className="bp-legend">
            {[
              ["#1e3a5a", "Room"],
              ["#0a0e17", "Wall"],
              ["#00cc66", "Exit"],
            ].map(([color, label]) => (
              <div key={label} className="bp-legend-item">
                <span className="bp-legend-swatch" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>

          {/* Tip */}
          <p className="bp-tip">
            💡 Tip: After importing you can keep editing in the Draw tab —
            add exits, erase walls, or paint rooms as needed.
          </p>

          {/* Import confirm */}
          <button
            className="bp-btn bp-btn--import"
            onClick={handleImport}
          >
            ✓ Load into Editor
          </button>

          {/* Re-parse shortcut */}
          <button
            className="bp-btn bp-btn--reparse"
            onClick={handleParse}
            disabled={loading}
          >
            ↺ Re-parse with new settings
          </button>
        </div>
      )}
    </div>
  );
}
