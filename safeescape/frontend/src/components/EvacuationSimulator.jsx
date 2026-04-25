import React, { useState, useCallback, useEffect, useRef } from 'react';
import BlueprintImporter from './BlueprintImporter';
import "./EvacuationSimulator.css";

const GRID_SIZE = 30;
const CELL_SIZE = 20;

const CELL_TYPES = {
  empty: 'empty',
  room: 'room',
  wall: 'wall',
  exit: 'exit',
  fire: 'fire',
  person: 'person',
};

const TOOLS = [
  { key: 'room', label: 'Room', icon: '⬜', desc: 'Draw walkable rooms' },
  { key: 'wall', label: 'Wall', icon: '⬛', desc: 'Block paths' },
  { key: 'exit', label: 'Exit', icon: '🚪', desc: 'Place evacuation exits' },
  { key: 'person', label: 'Person', icon: '🧍', desc: 'Add people' },
  { key: 'erase', label: 'Erase', icon: '✕', desc: 'Erase cells' },
  { key: 'blueprint', label: 'Blueprint', icon: '🏗', desc: 'Import floor plan image' },
];

const COLORS = {
  empty: '#0a0e17',
  room: '#1e2d45',
  wall: '#1a2233',
  exit: '#00ff88',
  fire: '#ff4400',
  person: '#60b8ff',
  path: '#ffd700',
};

function makeGrid() {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(CELL_TYPES.empty));
}

export default function EvacuationSimulator() {
  const [grid, setGrid] = useState(makeGrid());
  const [selectedTool, setSelectedTool] = useState(CELL_TYPES.room);
  const [phase, setPhase] = useState('build');
  const [persons, setPersons] = useState([]);
  const [fireSet, setFireSet] = useState(new Set());
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const intervalRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  const addLog = useCallback((msg, type = 'info') => {
    setLog(prev => [{ msg, type, id: Date.now() + Math.random() }, ...prev].slice(0, 8));
  }, []);

  const drawCell = useCallback((row, col) => {
    if (phase !== 'build') return;
    
    setGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      if (selectedTool === CELL_TYPES.person) {
        setPersons(prevPersons => {
          if (prevPersons.some(p => p.r === row && p.c === col)) return prevPersons;
          return [...prevPersons, { r: row, c: col, id: Math.random(), reached: false, lost: false }];
        });
      } else {
        newGrid[row][col] = selectedTool === CELL_TYPES.erase ? CELL_TYPES.empty : selectedTool;
        if (selectedTool === CELL_TYPES.erase) {
          setPersons(prev => prev.filter(p => !(p.r === row && p.c === col)));
        }
      }
      return newGrid;
    });
  }, [selectedTool, phase]);

  const handleCellClick = useCallback((row, col) => {
    drawCell(row, col);
  }, [drawCell]);

  const getGridCoordinates = useCallback((event) => {
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left - panXRef.current) / zoomRef.current;
    const canvasY = (event.clientY - rect.top - panYRef.current) / zoomRef.current;
    const col = Math.floor(canvasX / CELL_SIZE);
    const row = Math.floor(canvasY / CELL_SIZE);
    return { row, col };
  }, []);

  const handleMouseDown = useCallback((row, col) => {
    setDragging(true);
    drawCell(row, col);
  }, [drawCell]);

  const handleMouseEnter = useCallback((row, col) => {
    if (dragging) {
      drawCell(row, col);
    }
  }, [dragging, drawCell]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3.0, Math.max(0.3, zoom * zoomFactor));

    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY]);

  const handleZoomButton = useCallback((factor) => {
    const container = containerRef.current;
    if (!container) return;
    
    const cx = container.offsetWidth / 2;
    const cy = container.offsetHeight / 2;
    const newZoom = Math.min(3.0, Math.max(0.3, zoom * factor));
    
    setPanX(cx - (cx - panX) * (newZoom / zoom));
    setPanY(cy - (cy - panY) * (newZoom / zoom));
    setZoom(newZoom);
  }, [zoom, panX, panY]);

  const handleResetZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const gridWidth = GRID_SIZE * CELL_SIZE;
    const gridHeight = GRID_SIZE * CELL_SIZE;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // Center the grid in the container
    const centeredPanX = (containerWidth - gridWidth) / 2;
    const centeredPanY = (containerHeight - gridHeight) / 2;
    
    setZoom(1.0);
    setPanX(centeredPanX);
    setPanY(centeredPanY);
  }, []);

  const handleBlueprintImport = useCallback((importedGrid, rows, cols) => {
    // Convert the imported grid to match the current grid size
    // If the imported grid is larger or smaller, we'll pad or crop it
    const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(CELL_TYPES.empty));
    
    for (let r = 0; r < Math.min(rows, GRID_SIZE); r++) {
      for (let c = 0; c < Math.min(cols, GRID_SIZE); c++) {
        const cell = importedGrid[r][c];
        if (cell === 'room') {
          newGrid[r][c] = CELL_TYPES.room;
        } else if (cell === 'wall') {
          newGrid[r][c] = CELL_TYPES.wall;
        } else if (cell === 'exit') {
          newGrid[r][c] = CELL_TYPES.exit;
        }
      }
    }
    
    setGrid(newGrid);
    setSelectedTool(CELL_TYPES.room);
    setPhase('build');
    addLog(`✅ Blueprint imported · ${rows}×${cols} grid · switch tool to add exits`, 'safe');
  }, [addLog]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const startSimulation = useCallback(() => {
    const exits = [];
    const rooms = [];
    
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === CELL_TYPES.exit) exits.push([r, c]);
        if (grid[r][c] === CELL_TYPES.room) rooms.push([r, c]);
      }
    }

    if (!exits.length) {
      addLog('⚠ Need at least one EXIT!', 'warn');
      return;
    }
    if (!persons.length) {
      addLog('⚠ Need at least one PERSON!', 'warn');
      return;
    }

    const fireRoom = rooms[Math.floor(Math.random() * rooms.length)];
    setFireSet(new Set([`${fireRoom[0]},${fireRoom[1]}`]));
    setStep(0);
    setPhase('simulate');
    setRunning(true);
    addLog('🔥 Fire started! Evacuating...', 'fire');
  }, [grid, persons, addLog]);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setPhase('build');
    setFireSet(new Set());
    setPersons([]);
    setStep(0);
    setRunning(false);
    setLog([]);
  }, []);

  const clearAll = useCallback(() => {
    reset();
    setGrid(makeGrid());
  }, [reset]);

  const findPath = useCallback((startR, startC) => {
    const queue = [[startR, startC, []]];
    const visited = new Set([`${startR},${startC}`]);
    
    while (queue.length > 0) {
      const [r, c, path] = queue.shift();
      
      if (grid[r][c] === CELL_TYPES.exit) {
        return path;
      }
      
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && 
            !visited.has(key) && 
            !fireSet.has(key) &&
            (grid[nr][nc] === CELL_TYPES.room || grid[nr][nc] === CELL_TYPES.exit)) {
          visited.add(key);
          queue.push([nr, nc, [...path, [nr, nc]]]);
        }
      }
    }
    return null;
  }, [grid, fireSet]);

  useEffect(() => {
    if (!running || phase !== 'simulate') return;
    
    intervalRef.current = setInterval(() => {
      setStep(s => s + 1);
      setFireSet(prev => {
        const next = new Set(prev);
        for (const key of prev) {
          const [r, c] = key.split(',').map(Number);
          for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
              if (grid[nr][nc] === CELL_TYPES.room && Math.random() < 0.3) {
                next.add(`${nr},${nc}`);
              }
            }
          }
        }
        return next;
      });

      setPersons(prev => prev.map(p => {
        if (p.reached || p.lost) return p;
        const inFire = fireSet.has(`${p.r},${p.c}`);
        if (inFire) return { ...p, lost: true };
        
        const atExit = grid[p.r][p.c] === CELL_TYPES.exit;
        if (atExit) return { ...p, reached: true };
        
        // Find path to exit and move
        const path = findPath(p.r, p.c);
        if (path && path.length > 0) {
          const nextStep = path[0];
          return { ...p, r: nextStep[0], c: nextStep[1] };
        }
        
        return p;
      }));
    }, 500);

    return () => clearInterval(intervalRef.current);
  }, [running, phase, grid, fireSet, findPath]);

  const safe = persons.filter(p => p.reached).length;
  const lost = persons.filter(p => p.lost).length;
  const inDanger = persons.filter(p => !p.reached && !p.lost).length;

  return (
    <div style={{ minHeight: '100vh', background: '#040810', fontFamily: '"Courier New", monospace', color: '#a0c8e8', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#060e1c', borderBottom: '1px solid #1a3a5a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 22 }}>🏢</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#60b8ff', letterSpacing: 3 }}>EVACUATION SIMULATOR</div>
          <div style={{ fontSize: 10, color: '#3a6a9a', letterSpacing: 2 }}>CANVAS GRID · FIRE SPREAD</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, fontSize: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#00ff88' }}>{safe}</div>
            <div style={{ fontSize: 9, color: '#3a6a8a', letterSpacing: 2 }}>SAFE</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#60b8ff' }}>{inDanger}</div>
            <div style={{ fontSize: 9, color: '#3a6a8a', letterSpacing: 2 }}>DANGER</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4444' }}>{lost}</div>
            <div style={{ fontSize: 9, color: '#3a6a8a', letterSpacing: 2 }}>LOST</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ffd700' }}>{step}</div>
            <div style={{ fontSize: 9, color: '#3a6a8a', letterSpacing: 2 }}>STEP</div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: 200, background: '#060c18', borderRight: '1px solid #1a3a5a', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#3a6a8a' }}>{phase === 'build' ? '// BUILD MODE' : '// SIMULATING'}</div>
          
          {TOOLS.map(tool => (
            <button
              key={tool.key}
              onClick={() => setSelectedTool(tool.key)}
              disabled={phase !== 'build'}
              style={{
                background: selectedTool === tool.key ? '#1a3a6a' : '#0d1a2e',
                border: `1px solid ${selectedTool === tool.key ? '#3a7acc' : '#1a3a5a'}`,
                color: selectedTool === tool.key ? '#fff' : '#5a8aaa',
                padding: '7px 10px',
                cursor: phase === 'build' ? 'pointer' : 'not-allowed',
                borderRadius: 3,
                textAlign: 'left',
                opacity: phase === 'build' ? 1 : 0.5
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 1 }}>{tool.icon} {tool.label}</div>
              <div style={{ fontSize: 9, color: '#3a6a8a' }}>{tool.desc}</div>
            </button>
          ))}
          
          {phase === 'build' && selectedTool === 'blueprint' && (
            <BlueprintImporter onGridImported={handleBlueprintImport} />
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            {phase === 'build' ? (
              <>
                <button onClick={startSimulation} style={{ background: '#081e12', border: '1px solid #00cc66', color: '#00cc66', padding: '8px 10px', cursor: 'pointer', borderRadius: 3, fontSize: 11, letterSpacing: 1 }}>
                  ▶ Simulate
                </button>
                <button onClick={clearAll} style={{ background: '#1e0808', border: '1px solid #cc4444', color: '#cc4444', padding: '8px 10px', cursor: 'pointer', borderRadius: 3, fontSize: 11, letterSpacing: 1 }}>
                  ✕ Clear All
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setRunning(r => !r)} style={{ background: '#1e1808', border: '1px solid #ffd700', color: '#ffd700', padding: '8px 10px', cursor: 'pointer', borderRadius: 3, fontSize: 11, letterSpacing: 1 }}>
                  {running ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button onClick={reset} style={{ background: '#1e0808', border: '1px solid #cc4444', color: '#cc4444', padding: '8px 10px', cursor: 'pointer', borderRadius: 3, fontSize: 11, letterSpacing: 1 }}>
                  ↺ Back to Build
                </button>
              </>
            )}
          </div>
          
          <div style={{ fontSize: 9, color: '#3a6a8a', marginTop: 4 }}>
            <div style={{ letterSpacing: 2, marginBottom: 6 }}>// LEGEND</div>
            {Object.entries(COLORS).map(([key, color]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, background: color, borderRadius: 2, flexShrink: 0 }} />
                <span>{key}</span>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#3a6a8a', marginBottom: 4 }}>// EVENT LOG</div>
            {!log.length && <div style={{ fontSize: 9, color: '#1a3a5a' }}>No events yet</div>}
            {log.map(e => (
              <div key={e.id} style={{ fontSize: 9, marginBottom: 3, color: e.type === 'fire' ? '#ff6a00' : e.type === 'warn' ? '#ffd700' : e.type === 'safe' ? '#00ff88' : '#5a8aaa' }}>
                {e.msg}
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
          <div style={{ fontSize: 10, color: '#2a5a8a', letterSpacing: 2, marginBottom: 8 }}>
            {phase === 'build' ? `TOOL: ${TOOLS.find(t => t.key === selectedTool)?.label.toUpperCase()}` : `SIMULATING · STEP ${step} · ${fireSet.size} FIRE CELLS`}
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <button
              onClick={() => handleZoomButton(1.2)}
              style={{
                background: '#1a3a6a',
                border: '1px solid #3a7acc',
                color: '#fff',
                padding: '4px 8px',
                cursor: 'pointer',
                borderRadius: 3,
                fontSize: 12
              }}
            >
              +
            </button>
            <span style={{ color: '#60b8ff', fontSize: 12, minWidth: 50, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoomButton(0.8)}
              style={{
                background: '#1a3a6a',
                border: '1px solid #3a7acc',
                color: '#fff',
                padding: '4px 8px',
                cursor: 'pointer',
                borderRadius: 3,
                fontSize: 12
              }}
            >
              -
            </button>
            <button
              onClick={handleResetZoom}
              style={{
                background: '#1a3a6a',
                border: '1px solid #3a7acc',
                color: '#fff',
                padding: '4px 8px',
                cursor: 'pointer',
                borderRadius: 3,
                fontSize: 10,
                marginLeft: 8
              }}
            >
              Reset
            </button>
          </div>
          
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid #1a3a5a',
              borderRadius: 4,
              width: '100%',
              height: '100%',
              cursor: phase === 'build' ? 'crosshair' : 'default',
              minWidth: 600,
              minHeight: 600
            }}
            onWheel={handleWheel}
          >
            <div
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                userSelect: 'none'
              }}
            >
            {grid.map((row, rowIdx) =>
              row.map((cellType, colIdx) => {
                const isFire = fireSet.has(`${rowIdx},${colIdx}`);
                const personHere = persons.find(p => p.r === rowIdx && p.c === colIdx);
                const displayColor = isFire ? COLORS.fire : 
                  personHere?.reached ? '#00cc66' : 
                  personHere?.lost ? '#880000' : 
                  personHere ? COLORS.person : 
                  COLORS[cellType] || COLORS.empty;
                
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: displayColor,
                      border: '1px solid #1a3a5a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      cursor: phase === 'build' ? 'crosshair' : 'default',
                      position: 'relative'
                    }}
                    onClick={(e) => {
                      const { row, col } = getGridCoordinates(e);
                      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                        handleCellClick(row, col);
                      }
                    }}
                    onMouseDown={(e) => {
                      const { row, col } = getGridCoordinates(e);
                      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                        handleMouseDown(row, col);
                      }
                    }}
                    onMouseEnter={(e) => {
                      const { row, col } = getGridCoordinates(e);
                      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
                        handleMouseEnter(row, col);
                      }
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    {personHere && (personHere.reached ? '✅' : personHere.lost ? '💀' : '🧍')}
                    {isFire && (step % 2 === 0 ? '🔥' : '🌋')}
                    {cellType === CELL_TYPES.exit && !personHere && '🚪'}
                  </div>
                );
              })
            )}
            </div>
          </div>
          
          <div style={{ fontSize: 9, color: '#3a6a8a', marginTop: 8 }}>
            {GRID_SIZE}×{GRID_SIZE} GRID · {persons.length} PERSON(S) · {fireSet.size} FIRE CELL(S)
          </div>
        </div>
      </div>
    </div>
  );
}
 
