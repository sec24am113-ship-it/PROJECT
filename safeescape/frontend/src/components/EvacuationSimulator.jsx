import { useState, useEffect, useCallback, useRef } from "react";
import "./EvacuationSimulator.css";

const COLS = 20;
const ROWS = 14;
const CELL = 42;

const EMPTY = "empty";
const WALL = "wall";
const ROOM = "room";
const EXIT = "exit";
const FIRE = "fire";
const PERSON = "person";
const SAFE = "safe";
const PATH = "path";

const COLORS = {
  empty: "#0a0e17",
  wall: "#1a2233",
  room: "#1e2d45",
  exit: "#00ff88",
  fire: "#ff4400",
  person: "#60b8ff",
  safe: "#0f3d2a",
  path: "#ffd700",
  fireBorder: "#ff6a00",
  smoke: "#2a1a0a",
};

const TOOL_INFO = {
  room: { label: "Room", icon: "⬜", desc: "Draw walkable rooms & corridors" },
  wall: { label: "Wall", icon: "⬛", desc: "Block paths with walls" },
  exit: { label: "Exit", icon: "🚪", desc: "Place evacuation exits" },
  stairs: { label: "Stairs", icon: "🪜", desc: "Connect floors (up/down)" },
  person: { label: "Person", icon: "🧍", desc: "Add people to evacuate" },
  erase: { label: "Erase", icon: "✕", desc: "Erase cells" },
};

function makeGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function getNeighbors(r, c, grid, includeWalls = false) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  return dirs
    .map(([dr, dc]) => [r + dr, c + dc])
    .filter(
      ([nr, nc]) =>
        nr >= 0 &&
        nr < ROWS &&
        nc >= 0 &&
        nc < COLS &&
        (includeWalls || (grid[nr][nc] !== WALL && grid[nr][nc] !== EMPTY))
    );
}

function bfsPath(startR, startC, startFloor, floors, fireSet) {
  const ROWS = floors[0].length;
  const COLS = floors[0][0].length;
  const visited = new Set();
  const prev = new Map();
  const queue = [[startR, startC, startFloor]];
  visited.add(`${startR},${startC},${startFloor}`);
  let foundExit = null;

  while (queue.length) {
    const [r, c, f] = queue.shift();
    const cell = floors[f][r][c];
    
    if (cell === EXIT) {
      foundExit = [r, c, f];
      break;
    }

    // Get neighbors on same floor
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const key = `${nr},${nc},${f}`;
        const cell = floors[f][nr][nc];
        if (
          !visited.has(key) &&
          cell !== WALL &&
          cell !== EMPTY &&
          !fireSet.has(key)
        ) {
          visited.add(key);
          prev.set(key, `${r},${c},${f}`);
          queue.push([nr, nc, f]);
        }
      }
    }

    // Use stairs to move between floors
    if (cell === "stairs") {
      for (let nf = 0; nf < floors.length; nf++) {
        if (nf !== f) {
          const key = `${r},${c},${nf}`;
          if (!visited.has(key) && !fireSet.has(key)) {
            visited.add(key);
            prev.set(key, `${r},${c},${f}`);
            queue.push([r, c, nf]);
          }
        }
      }
    }
  }

  if (!foundExit) return null;
  const path = [];
  let cur = `${foundExit[0]},${foundExit[1]},${foundExit[2]}`;
  while (cur) {
    const [r, c, f] = cur.split(",").map(Number);
    path.unshift([r, c, f]);
    cur = prev.get(cur);
  }
  return path;
}

export default function EvacuationSimulator() {
  const [floors, setFloors] = useState([makeGrid()]); // Multi-floor support
  const [currentFloor, setCurrentFloor] = useState(0);
  const grid = floors[currentFloor];
  const setGrid = (updater) => {
    const newFloors = [...floors];
    newFloors[currentFloor] = typeof updater === "function" ? updater(grid) : updater;
    setFloors(newFloors);
  };
  
  const [tool, setTool] = useState("room");
  const [phase, setPhase] = useState("build");
  const [fireSet, setFireSet] = useState(new Set());
  const [persons, setPersons] = useState([]);
  const [paths, setPaths] = useState([]);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [fireOrigin, setFireOrigin] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);
  const intervalRef = useRef(null);

  const addLog = useCallback((msg, type = "info") => {
    setLog((prev) =>
      [{ msg, type, id: Date.now() + Math.random() }, ...prev].slice(0, 8)
    );
  }, []);

  const paintCell = useCallback(
    (r, c) => {
      setGrid((prev) => {
        const g = prev.map((row) => [...row]);
        if (tool === "erase") {
          g[r][c] = EMPTY;
          return g;
        }
        if (tool === "person") return prev;
        g[r][c] = tool;
        return g;
      });
      if (tool === "person") {
        setPersons((prev) => {
          if (prev.some((p) => p.r === r && p.c === c && p.floor === currentFloor)) return prev;
          return [
            ...prev,
            { r, c, floor: currentFloor, id: Date.now() + Math.random(), reached: false, lost: false },
          ];
        });
      }
    },
    [tool, currentFloor]
  );

  const handleCellInteract = (r, c) => {
    if (phase !== "build") return;
    paintCell(r, c);
  };

  const startSim = () => {
    const exits = [];
    const rooms = [];
    
    // Scan all floors
    for (let floor = 0; floor < floors.length; floor++) {
      const floorGrid = floors[floor];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (floorGrid[r][c] === EXIT) exits.push([r, c, floor]);
          if (floorGrid[r][c] === ROOM || floorGrid[r][c] === EXIT || floorGrid[r][c] === "stairs") 
            rooms.push([r, c, floor]);
        }
      }
    }

    if (exits.length === 0) {
      addLog("Place at least one EXIT first!", "warn");
      return;
    }
    if (persons.length === 0) {
      addLog("Place at least one PERSON first!", "warn");
      return;
    }

    const fireStart = rooms.filter(
      ([r, c, f]) => floors[f][r][c] === ROOM && !persons.some((p) => p.r === r && p.c === c && p.floor === f)
    );
    if (fireStart.length === 0) {
      addLog("Need more room cells for fire to start!", "warn");
      return;
    }
    const fi = Math.floor(Math.random() * fireStart.length);
    const [fr, fc, ff] = fireStart[fi];
    setFireOrigin([fr, fc, ff]);
    setFireSet(new Set([`${fr},${fc},${ff}`]));
    setStep(0);
    setPhase("simulate");
    setRunning(true);
    addLog(`🔥 Fire started on Floor ${ff + 1}! Evacuation initiated.`, "fire");
  };

  const reset = () => {
    clearInterval(intervalRef.current);
    setPhase("build");
    setFireSet(new Set());
    setPersons([]);
    setPaths([]);
    setStep(0);
    setRunning(false);
    setFireOrigin(null);
    setLog([]);
  };

  const clearAll = () => {
    reset();
    setGrid(makeGrid());
  };

  // Simulation tick
  useEffect(() => {
    if (!running || phase !== "simulate") return;

    intervalRef.current = setInterval(() => {
      setStep((s) => s + 1);

      // Spread fire on current floor
      setFireSet((prev) => {
        const next = new Set(prev);
        for (const key of prev) {
          const [r, c, f] = key.split(",").map(Number);
          if (f !== currentFloor) continue; // Only spread on current floor display
          
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              if (floors[f][nr][nc] === ROOM) {
                if (Math.random() < 0.35) next.add(`${nr},${nc},${f}`);
              }
            }
          }
        }
        return next;
      });

      // Move persons
      setPersons((prev) =>
        prev.map((p) => {
          if (p.reached || p.lost) return p;
          const path = bfsPath(p.r, p.c, p.floor, floors, fireSet);
          if (!path || path.length < 2) {
            return { ...p, lost: true };
          }
          const [nr, nc, nf] = path[1];
          const reachedExit = floors[nf][nr][nc] === EXIT;
          return { ...p, r: nr, c: nc, floor: nf, reached: reachedExit };
        })
      );

      // Compute display paths (only for current floor)
      setPersons((prev) => {
        const newPaths = prev
          .filter((p) => !p.reached && !p.lost && p.floor === currentFloor)
          .map((p) => bfsPath(p.r, p.c, p.floor, floors, fireSet))
          .filter(Boolean);
        setPaths(newPaths);
        return prev;
      });
    }, 700);

    return () => clearInterval(intervalRef.current);
  }, [running, phase, grid, fireSet]);

  // Check end condition
  useEffect(() => {
    if (phase !== "simulate" || persons.length === 0) return;
    const allDone = persons.every((p) => p.reached || p.lost);
    if (allDone) {
      setRunning(false);
      const safe = persons.filter((p) => p.reached).length;
      const lost = persons.filter((p) => p.lost).length;
      addLog(
        `Simulation complete. ✅ ${safe} safe, ❌ ${lost} lost.`,
        safe === persons.length ? "safe" : "warn"
      );
    }
  }, [persons, phase]);

  const getDisplay = (r, c) => {
    if (phase === "simulate") {
      if (fireSet.has(`${r},${c},${currentFloor}`)) return FIRE;
      const person = persons.find((p) => p.r === r && p.c === c && p.floor === currentFloor);
      if (person)
        return person.reached
          ? "safe_person"
          : person.lost
            ? "lost_person"
            : PERSON;
      if (
        paths.some(
          (path) => path.some(([pr, pc, pf]) => pr === r && pc === c && pf === currentFloor)
        ) &&
        grid[r][c] === ROOM
      )
        return PATH;
    }
    return grid[r][c];
  };

  const cellStyle = (display, r, c) => {
    const isHovered = hover && hover[0] === r && hover[1] === c && phase === "build";
    let bg = COLORS[display] || COLORS.empty;
    let border = "transparent";
    let glow = "";
    let opacity = 1;

    if (display === FIRE) {
      bg = `hsl(${15 + ((r * c * step) % 20)}, 100%, ${35 + ((step % 3) * 5)}%)`;
      glow = `0 0 12px 3px rgba(255,80,0,0.6)`;
      border = COLORS.fireBorder;
    } else if (display === "safe_person") {
      bg = "#00cc66";
      glow = "0 0 8px 2px rgba(0,200,100,0.5)";
    } else if (display === "lost_person") {
      bg = "#880000";
      glow = "0 0 8px 2px rgba(200,0,0,0.5)";
    } else if (display === PERSON) {
      glow = "0 0 10px 2px rgba(96,184,255,0.6)";
    } else if (display === EXIT) {
      glow = "0 0 10px 3px rgba(0,255,136,0.5)";
    } else if (display === PATH) {
      bg = "#1a1600";
      border = "#ffd700";
      glow = "0 0 6px 1px rgba(255,215,0,0.3)";
    } else if (display === "stairs") {
      bg = "#6600cc";
      glow = "0 0 8px 2px rgba(102,0,204,0.5)";
      border = "#9933ff";
    }

    if (isHovered) {
      glow = "0 0 0 2px #ffffff44 inset";
      opacity = 0.8;
    }

    return {
      width: CELL,
      height: CELL,
      backgroundColor: bg,
      border: `1px solid ${border === "transparent" ? (display === EMPTY ? "#0f1520" : "#1e3050") : border}`,
      boxShadow: glow,
      opacity,
      cursor: phase === "build" ? "crosshair" : "default",
      transition: "background-color 0.3s, box-shadow 0.3s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      userSelect: "none",
      position: "relative",
    };
  };

  const cellEmoji = (display) => {
    if (display === EXIT) return "🚪";
    if (display === PERSON) return "🧍";
    if (display === "safe_person") return "✅";
    if (display === "lost_person") return "💀";
    if (display === FIRE) return step % 2 === 0 ? "🔥" : "🌋";
    if (display === PATH) return "·";
    if (display === "stairs") return "🪜";
    return "";
  };

  const safe = persons.filter((p) => p.reached).length;
  const lost = persons.filter((p) => p.lost).length;
  const inDanger = persons.filter((p) => !p.reached && !p.lost).length;

  return (
    <div className="evacuation-simulator">
      {/* Header */}
      <div className="simulator-header">
        <div className="header-icon">🏢</div>
        <div className="header-title">
          <div className="title-main">Evacuation Simulator</div>
          <div className="title-sub">DYNAMIC FIRE SPREAD & PATHFINDING ENGINE</div>
        </div>
        <div className="header-stats">
          <Stat label="SAFE" value={safe} color="#00ff88" />
          <Stat label="IN DANGER" value={inDanger} color="#60b8ff" />
          <Stat label="LOST" value={lost} color="#ff4444" />
          <Stat label="STEP" value={step} color="#ffd700" />
        </div>
      </div>

      <div className="simulator-content">
        {/* Sidebar */}
        <div className="simulator-sidebar">
          <div className="sidebar-label">
            {phase === "build" ? "// BUILD MODE" : "// SIMULATION"}
          </div>

          {/* Floor Navigation */}
          <div className="floor-selector">
            <div style={{ fontSize: 12, fontWeight: "bold", color: "#888", marginBottom: 6 }}>
              FLOOR: {currentFloor + 1} / {floors.length}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {floors.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentFloor(idx)}
                  style={{
                    padding: "6px 10px",
                    background: idx === currentFloor ? "#00ff88" : "#1e2d45",
                    color: idx === currentFloor ? "#000" : "#60b8ff",
                    border: "1px solid #00ff88",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  F{idx + 1}
                </button>
              ))}
              {floors.length < 5 && (
                <button
                  onClick={() => setFloors((prev) => [...prev, makeGrid()])}
                  style={{
                    padding: "6px 10px",
                    background: "#0f1520",
                    color: "#666",
                    border: "1px dashed #666",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  +
                </button>
              )}
            </div>
          </div>

          {phase === "build" &&
            Object.entries(TOOL_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setTool(key)}
                className={`tool-btn ${tool === key ? "active" : ""}`}
              >
                <div className="tool-label">
                  {info.icon} {info.label}
                </div>
                <div className="tool-desc">{info.desc}</div>
              </button>
            ))}

          <div className="action-buttons">
            {phase === "build" ? (
              <>
                <ActionBtn onClick={startSim} color="#00cc66" label="▶  Start Simulation" />
                <ActionBtn onClick={clearAll} color="#cc4444" label="✕  Clear All" />
              </>
            ) : (
              <>
                <ActionBtn
                  onClick={() => setRunning((r) => !r)}
                  color="#ffd700"
                  label={running ? "⏸  Pause" : "▶  Resume"}
                />
                <ActionBtn onClick={reset} color="#cc4444" label="↺  Back to Build" />
              </>
            )}
          </div>

          {/* Legend */}
          <div className="simulator-legend">
            <div className="legend-label">// LEGEND</div>
            {[
              ["#1e2d45", "Room / Corridor"],
              ["#1a2233", "Wall"],
              ["#00ff88", "Exit"],
              ["#6600cc", "Stairs"],
              ["#60b8ff", "Person"],
              ["#ff4400", "Fire"],
              ["#ffd700", "Safe Path"],
            ].map(([color, label]) => (
              <div key={label} className="legend-item">
                <div
                  className="legend-color"
                  style={{ background: color }}
                />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div className="event-log">
            <div className="log-label">// EVENT LOG</div>
            {log.length === 0 && <div className="log-empty">No events yet.</div>}
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`log-entry log-${entry.type}`}
              >
                {entry.msg}
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="simulator-grid-container">
          <div>
            {phase === "build" && (
              <div className="grid-info">
                CLICK & DRAG TO PAINT · TOOL: {TOOL_INFO[tool]?.label.toUpperCase() || "ERASE"}
              </div>
            )}
            <div
              className="grid-wrapper"
              onMouseLeave={() => setDragging(false)}
            >
              {Array.from({ length: ROWS }, (_, r) => (
                <div key={r} className="grid-row">
                  {Array.from({ length: COLS }, (_, c) => {
                    const display = getDisplay(r, c);
                    return (
                      <div
                        key={c}
                        style={cellStyle(display, r, c)}
                        onMouseDown={() => {
                          setDragging(true);
                          handleCellInteract(r, c);
                        }}
                        onMouseEnter={() => {
                          setHover([r, c]);
                          if (dragging) handleCellInteract(r, c);
                        }}
                        onMouseUp={() => setDragging(false)}
                      >
                        {cellEmoji(display)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="grid-stats">
              {COLS}×{ROWS} GRID · {persons.length} PERSON(S) · {[...fireSet].length} FIRE CELL(S)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ActionBtn({ onClick, color, label }) {
  return (
    <button
      onClick={onClick}
      className="action-btn"
      style={{
        borderColor: color,
        color,
      }}
      onMouseEnter={(e) => (e.target.style.background = color + "22")}
      onMouseLeave={(e) => (e.target.style.background = "transparent")}
    >
      {label}
    </button>
  );
}
