import { useState, useEffect, useCallback, useRef } from "react";
import "./EvacuationSimulator.css";

const COLS = 100;
const ROWS = 100;
const CELL = 20;

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

function makeGrids() {
  return Array.from({length:FLOORS}, () =>
    Array.from({length:ROWS}, () => Array(COLS).fill(EMPTY)));
}

function buildFromSpec(spec) {
  const g = makeGrids();
  const persons = [];

  for (let f = 0; f < Math.min(spec.floors.length, FLOORS); f++) {
    for (let r = 0; r < ROWS; r++) {
      g[f][r][0] = STAIR;
      g[f][r][1] = ROOM;
    }
    if (f === 0) g[0][ROWS-1][0] = EXIT;

    const { rooms: numRooms, people: numPeople } = spec.floors[f];
    const count = Math.min(numRooms, 6);
    const roomW = 4, roomH = 3, gap = 1;
    const startCol = 3;

    for (let ri = 0; ri < count; ri++) {
      const col = startCol + (ri % 3) * (roomW + gap);
      const row = Math.floor(ri / 3) * (roomH + gap);
      if (col + roomW - 1 >= COLS || row + roomH - 1 >= ROWS) continue;

      for (let dr = 0; dr < roomH; dr++)
        for (let dc = 0; dc < roomW; dc++)
          g[f][row + dr][col + dc] = ROOM;

      const doorRow = row + 1;
      for (let dc = 2; dc < col; dc++)
        if (g[f][doorRow][dc] === EMPTY) g[f][doorRow][dc] = ROOM;
    }

    for (let pi = 0; pi < numPeople; pi++) {
      const ri = pi % count;
      const col = startCol + (ri % 3) * (roomW + gap);
      const row = Math.floor(ri / 3) * (roomH + gap);
      const pr = row + 1;
      const pc = col + (pi % roomW);
      if (pr < row + roomH && pc < col + roomW && pc < COLS)
        persons.push({ f, r: pr, c: pc, id: Math.random(), reached: false, lost: false });
    }
  }

  return { grids: g, persons };
}

function bfs3D(startF, startR, startC, grids, fireSet) {
  const key = (f,r,c) => `${f},${r},${c}`;
  const visited = new Set([key(startF,startR,startC)]);
  const prev = {};
  const queue = [[startF,startR,startC]];
  let foundExit = null;

  while (queue.length) {
    const [f,r,c] = queue.shift();
    if (grids[f][r][c] === EXIT) { foundExit=[f,r,c]; break; }
    const nb = [];
    for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr=r+dr, nc=c+dc;
      if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) {
        const t=grids[f][nr][nc];
        if (t!==WALL&&t!==EMPTY) nb.push([f,nr,nc]);
      }
    }
    if (grids[f][r][c]===STAIR) {
      if (f+1<FLOORS&&grids[f+1][r][c]===STAIR) nb.push([f+1,r,c]);
      if (f-1>=0&&grids[f-1][r][c]===STAIR) nb.push([f-1,r,c]);
    }
    for (const n of nb) {
      const nk=key(...n);
      if (!visited.has(nk)&&!fireSet.has(nk)) {
        visited.add(nk); prev[nk]=[f,r,c]; queue.push(n);
      }
    }
  }
  if (!foundExit) return null;
  const path=[];
  let cur=key(...foundExit);
  const start=key(startF,startR,startC);
  while (cur&&cur!==start) {
    const [cf,cr,cc]=cur.split(",").map(Number);
    path.unshift([cf,cr,cc]);
    const p=prev[cur]; cur=p?key(...p):null;
  }
  path.unshift([startF,startR,startC]);
  return path;
}

export default function EvacuationSimulator() {
  const generateId = useCallback(() => {
    return `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const [floors, setFloors] = useState([makeGrid()]); // Multi-floor support
  const [currentFloor, setCurrentFloor] = useState(0);
  const grid = floors[currentFloor];
  const setGrid = useCallback((updater) => {
    setFloors(prev => {
      const newFloors = [...prev];
      const currentGrid = newFloors[currentFloor];
      newFloors[currentFloor] = 
        typeof updater === "function" ? updater(currentGrid) : updater;
      return newFloors;
    });
  }, [currentFloor]);
  
  const [tool, setTool] = useState("room");
  const [phase, setPhase] = useState("build");
  const [fireSet, setFireSet] = useState(new Set());
  const fireSetRef = useRef(fireSet);
  fireSetRef.current = fireSet;
  const [persons, setPersons] = useState([]);
  const [paths, setPaths] = useState([]);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [fireOrigin, setFireOrigin] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const pathCacheRef = useRef(new Map());
  const dirtyRef = useRef(new Set());
  const prevGridRef = useRef(null);
  const drawnOnceRef = useRef(false);

  const addLog = useCallback((msg, type = "info") => {
    setLog((prev) =>
      [{ msg, type, id: Date.now() + Math.random() }, ...prev].slice(0, 8)
    );
  }, []);

  // Clear path cache when fire changes
  useEffect(() => {
    pathCacheRef.current.clear();
  }, [fireSet]);

  // Memoized BFS path with caching
  const getCachedPath = useCallback((r, c, floor) => {
    const cacheKey = `${r},${c},${floor},${step}`;
    if (pathCacheRef.current.has(cacheKey)) {
      return pathCacheRef.current.get(cacheKey);
    }
    const path = bfsPath(r, c, floor, floors, fireSet);
    pathCacheRef.current.set(cacheKey, path);
    return path;
  }, [floors, fireSet, step]);

  const paintCell = useCallback(
    (r, c) => {
      setGrid((prev) => {
        // Only update the specific row that changed
        const newGrid = [...prev];
        const newRow = [...prev[r]];
        newRow[c] = tool === "erase" ? EMPTY : tool;
        newGrid[r] = newRow;
        dirtyRef.current.add(`${r},${c}`);
        return newGrid;
      });
      if (tool === "person") {
        setPersons((prev) => {
          if (prev.some((p) => p.r === r && p.c === c && p.floor === currentFloor)) return prev;
          return [
            ...prev,
            { r, c, floor: currentFloor, id: generateId(), reached: false, lost: false },
          ];
        });
      }
    },
    [tool, currentFloor, generateId]
  );

  const handleCellInteract = (r, c) => {
    if (phase !== "build") return;
    paintCell(r, c);
  };

  // Define cellEmoji first (no dependencies)
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

  // Define cellStyle (no hook dependencies)  
  const cellStyle = (display, r, c, hover, phase, step) => {
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

  // Define getDisplay (useCallback, depends on grid/fireSet/persons/paths/phase/currentFloor)
  const getDisplay = useCallback((r, c) => {
    const cell = grid[r][c];
    
    if (phase === "simulate") {
      if (fireSet.has(`${r},${c},${currentFloor}`)) return FIRE;
      
      const personHere = persons.find(
        p => p.r === r && p.c === c && p.floor === currentFloor
      );
      if (personHere) {
        if (personHere.reached) return "safe_person";
        if (personHere.lost) return "lost_person";
        return PERSON;
      }
      
      if (paths.some(p => p[0] === r && p[1] === c && p[2] === currentFloor) && cell === ROOM) {
        return PATH;
      }
    }
    return cell;
  }, [grid, fireSet, persons, paths, phase, currentFloor]);

  // Optimize cell style calculation with useMemo
  const memoizedCellStyle = useCallback((display, r, c) => {
    return cellStyle(display, r, c);
  }, [hover, phase, step, currentFloor]);

  // NOW define drawCell (useCallback, depends on getDisplay, cellStyle, cellEmoji)
  const drawCell = useCallback((ctx, r, c) => {
    const display = getDisplay(r, c);
    const style = cellStyle(display, r, c, hover, phase, step);
    
    // Paint solid background - overwrites previous content
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);

    // Border
    if (style.border !== 'transparent') {
      ctx.strokeStyle = style.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }

    // Emoji if needed
    const emoji = cellEmoji(display);
    if (emoji) {
      ctx.font = `${style.fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, c * CELL + CELL / 2, r * CELL + CELL / 2);
    }
  }, [getDisplay, cellStyle, cellEmoji, hover, phase, step]);

  // Canvas rendering for performance - separate from event binding
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawGrid = () => {
      if (!drawnOnceRef.current || phase === 'simulate') {
        // Full redraw on first render OR any simulation tick
        canvas.width = COLS * CELL;
        canvas.height = ROWS * CELL;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            drawCell(ctx, r, c);
          }
        }
        drawnOnceRef.current = true;
        dirtyRef.current.clear();
      } else {
        // Build mode only: repaint dirty cells
        for (const key of dirtyRef.current) {
          const [r, c] = key.split(',').map(Number);
          drawCell(ctx, r, c);
        }
        dirtyRef.current.clear();
      }
    };

    drawGrid();
  }, [grid, step, fireSet, persons, paths, phase, currentFloor, hover, drawCell]);

  // Event binding - separate from drawing to avoid re-registering on every render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e) => {
      setDragging(true);
      handleCanvasInteract(e);
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL);
      const r = Math.floor(y / CELL);
      
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        setHover([r, c]);
        if (dragging) {
          handleCanvasInteract(e);
        }
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    const handleCanvasInteract = (e) => {
      if (phase !== "build") return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL);
      const r = Math.floor(y / CELL);
      
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        handleCellInteract(r, c);
      }
    };

    // Add listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);

    // Cleanup function - IMPORTANT!
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [phase, tool, zoom]);

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
    const spec = { floors: Array.from({length:nf},(_,i)=>({rooms:rooms[i],people:people[i]})) };
    const {grids:newG, persons:newP} = buildFromSpec(spec);
    reset();
    setGrids(newG);
    setPersons(newP);
    setShowBuilder(false);
    const total=people.slice(0,nf).reduce((a,b)=>a+b,0);
    addLog(`✅ ${nf} floors built · ${rooms.slice(0,nf).reduce((a,b)=>a+b,0)} rooms · ${total} people`,"safe");
  };

  const paintCell = useCallback((f,r,c) => {
    if (phaseRef.current!=="build") return;
    const t=toolRef.current;
    if (t==="person") {
      setPersons(prev=>{
        if (prev.some(p=>p.f===f&&p.r===r&&p.c===c)) return prev;
        return [...prev,{f,r,c,id:Math.random(),reached:false,lost:false}];
      }); return;
    }
    setGrids(prev=>{
      const g=prev.map(fl=>fl.map(row=>[...row]));
      g[f][r][c]=t==="erase"?EMPTY:t; return g;
    });
    if (t==="erase") setPersons(prev=>prev.filter(p=>!(p.f===f&&p.r===r&&p.c===c)));
  },[]);

  const startSim = () => {
    const exits=[], rooms=[];
    for (let f=0;f<FLOORS;f++) for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (grids[f][r][c]===EXIT) exits.push([f,r,c]);
      if (grids[f][r][c]===ROOM) rooms.push([f,r,c]);
    }
    if (!exits.length) { addLog("⚠ Need at least one EXIT!","warn"); return; }
    if (!persons.length) { addLog("⚠ Need at least one PERSON!","warn"); return; }
    if (!rooms.length) { addLog("⚠ Need some ROOMs!","warn"); return; }
    const upper=rooms.filter(([f])=>f>0).filter(([f,r,c])=>!persons.some(p=>p.f===f&&p.r===r&&p.c===c));
    const fireRooms=upper.length?upper:rooms;
    const [ff,fr,fc]=fireRooms[Math.floor(Math.random()*fireRooms.length)];
    setFireSet(new Set([cellKey(ff,fr,fc)]));
    setStep(0); setPhase("simulate"); setRunning(true);
    addLog(`🔥 Fire on Floor ${ff+1}! Evacuating...`,"fire");
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
    // Clear dirty cell tracking to force full redraw
    dirtyRef.current.clear();
    drawnOnceRef.current = false;
  };
  const clearAll = () => { reset(); setGrids(makeGrids()); };

  useEffect(()=>{
    if (!running||phase!=="simulate") return;
    intervalRef.current=setInterval(()=>{
      setStep(s=>s+1);
      setFireSet(prev=>{
        const g=gridsRef.current,next=new Set(prev);
        for (const k of prev) {
          const [f,r,c]=k.split(",").map(Number);
          for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr=r+dr,nc=c+dc;
            if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) {
              const t=g[f][nr][nc];
              if ((t===ROOM||t===STAIR)&&Math.random()<0.3) next.add(cellKey(f,nr,nc));
            }
          }
          if (f+1<FLOORS&&g[f+1]?.[r]?.[c]===STAIR&&Math.random()<0.15) next.add(cellKey(f+1,r,c));
        }
        return next;
      });

      // Move persons and compute display paths in single update
      setPersons((prev) => {
        const updatedPersons = prev.map((p) => {
          if (p.reached || p.lost) return p;
          const path = getCachedPath(p.r, p.c, p.floor);
          if (!path || path.length < 2) {
            return { ...p, lost: true };
          }
          const [nr, nc, nf] = path[1];
          const reachedExit = floors[nf][nr][nc] === EXIT;
          return { ...p, r: nr, c: nc, floor: nf, reached: reachedExit };
        });

        // Compute display paths from updated persons (only for current floor)
        const newPaths = updatedPersons
          .filter((p) => !p.reached && !p.lost && p.floor === currentFloor)
          .map((p) => getCachedPath(p.r, p.c, p.floor))
          .filter(Boolean);
        setPaths(newPaths);

        return updatedPersons;
      });
    },800);
    return ()=>clearInterval(intervalRef.current);
  },[running,phase]);

  useEffect(()=>{
    if (phase!=="simulate"||!persons.length) return;
    if (persons.every(p=>p.reached||p.lost)) {
      setRunning(false);
      const s=persons.filter(p=>p.reached).length,l=persons.filter(p=>p.lost).length;
      addLog(`Done · ✅${s} safe  ❌${l} lost`,s===persons.length?"safe":"warn");
    }
  }, [persons, phase]);

  const safe = persons.filter((p) => p.reached).length;
  const lost = persons.filter((p) => p.lost).length;
  const inDanger = persons.filter((p) => !p.reached && !p.lost).length;

  return (
    <div style={{minHeight:"100vh",background:"#040810",fontFamily:"'Courier New',monospace",color:"#a0c8e8",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#060e1c",borderBottom:"1px solid #1a3a5a",padding:"10px 20px",display:"flex",alignItems:"center",gap:16}}>
        <span style={{fontSize:22}}>🏢</span>
        <div>
          <div style={{fontSize:16,fontWeight:"bold",color:"#60b8ff",letterSpacing:3}}>3D EVACUATION SIMULATOR</div>
          <div style={{fontSize:10,color:"#3a6a9a",letterSpacing:2}}>{FLOORS} FLOORS · ISO VIEW · FIRE SPREAD & PATHFINDING</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:24,fontSize:12}}>
          {[["SAFE",safe,"#00ff88"],["DANGER",danger,"#60b8ff"],["LOST",lost,"#ff4444"],["STEP",step,"#ffd700"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:"bold",color:c}}>{v}</div>
              <div style={{fontSize:9,color:"#3a6a8a",letterSpacing:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",flex:1}}>
        <div style={{width:195,background:"#060c18",borderRight:"1px solid #1a3a5a",padding:12,display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
          <div style={{fontSize:9,letterSpacing:3,color:"#3a6a8a"}}>{phase==="build"?"// BUILD MODE":"// SIMULATING"}</div>
          {phase==="build"&&(
            <button onClick={()=>setShowBuilder(b=>!b)} style={{background:showBuilder?"#0e2240":"#091525",border:`1px solid ${showBuilder?"#60b8ff":"#1e4a7a"}`,color:showBuilder?"#60b8ff":"#3a7aaa",padding:"10px 12px",cursor:"pointer",borderRadius:4,textAlign:"left"}}>
              <div style={{fontSize:13,marginBottom:2}}>🏗 Auto-Build</div>
              <div style={{fontSize:9,color:"#2a6a9a"}}>specify floors, rooms & people</div>
            </button>
          )}
          {phase==="build"&&showBuilder&&(
            <div style={{background:"#060f1c",border:"1px solid #1e4a7a",borderRadius:4,padding:10,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:9,letterSpacing:2,color:"#60b8ff",marginBottom:2}}>// BUILDING GENERATOR</div>
              <Label text={`FLOORS (1–${FLOORS})`}/>
              <input type="number" min="1" max={FLOORS} value={bFloors} onChange={e=>{setBFloors(e.target.value); const n=parseInt(e.target.value); if(!isNaN(n)&&n>=1&&n<=FLOORS){setBRooms(Array(n).fill("3").join(","));setBPeople(Array(n).fill("5").join(","));}}} style={inputStyle}/>
              <Label text="ROOMS PER FLOOR (comma-sep, 1–6)"/>
              <input type="text" value={bRooms} onChange={e=>setBRooms(e.target.value)} placeholder="e.g. 3,4,2" style={inputStyle}/>
              <Label text="PEOPLE PER FLOOR (comma-sep, 0–20)"/>
              <input type="text" value={bPeople} onChange={e=>setBPeople(e.target.value)} placeholder="e.g. 5,8,3" style={inputStyle}/>
              {bError&&<div style={{fontSize:9,color:"#ff7777",padding:"4px 0"}}>{bError}</div>}
              <button onClick={handleAutoBuild} style={{background:"#081e12",border:"1px solid #00cc66",color:"#00cc66",padding:"9px",cursor:"pointer",borderRadius:3,fontSize:11,fontFamily:"'Courier New',monospace",letterSpacing:1,marginTop:2}} onMouseEnter={e=>e.currentTarget.style.background="#00cc6622"} onMouseLeave={e=>e.currentTarget.style.background="#081e12"}>▶ Generate Building</button>
              <div style={{fontSize:9,color:"#2a5a3a",lineHeight:1.8,borderTop:"1px solid #1a3a2a",paddingTop:6}}>Example:<br/>Floors: 2<br/>Rooms: 3,4<br/>People: 6,8<br/>→ 14 people, 7 rooms</div>
            </div>
          )}
          {phase==="build"&&(
            <div>
              <div style={{fontSize:9,letterSpacing:2,color:"#3a6a8a",marginBottom:4}}>// ACTIVE FLOOR</div>
              <div style={{display:"flex",gap:4}}>
                {Array.from({length:FLOORS},(_,i)=>(
                  <button key={i} onClick={()=>setActiveFloor(i)} style={{flex:1,padding:"6px 0",cursor:"pointer",background:activeFloor===i?"#1a3a6a":"#0d1a2e",border:`1px solid ${activeFloor===i?"#3a7acc":"#1a3a5a"}`,color:activeFloor===i?"#60b8ff":"#3a6a8a",fontSize:11,borderRadius:3}}>F{i+1}</button>
                ))}
              </div>
            </div>
          )}
          {phase==="build"&&TOOLS.map(t=>(
            <button key={t.key} onClick={()=>setTool(t.key)} style={{background:tool===t.key?"#1a3a6a":"#0d1a2e",border:`1px solid ${tool===t.key?"#3a7acc":"#1a3a5a"}`,color:tool===t.key?"#fff":"#5a8aaa",padding:"7px 10px",cursor:"pointer",borderRadius:3,textAlign:"left"}}>
              <div style={{fontSize:12,marginBottom:1}}>{t.icon} {t.label}</div>
              <div style={{fontSize:9,color:"#3a6a8a"}}>{t.desc}</div>
            </button>
          ))}
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:2}}>
            {phase==="build"?<><Btn onClick={startSim} color="#00cc66" label="▶ Simulate"/><Btn onClick={clearAll} color="#cc4444" label="✕ Clear All"/></>:<><Btn onClick={()=>setRunning(r=>!r)} color="#ffd700" label={running?"⏸ Pause":"▶ Resume"}/><Btn onClick={reset} color="#cc4444" label="↺ Back to Build"/></>}
          </div>
          <div style={{fontSize:9,color:"#3a6a8a",marginTop:4}}>
            <div style={{letterSpacing:2,marginBottom:6}}>// LEGEND</div>
            {[["#1e3550","Room"],["#1a2a3a","Wall"],["#00cc66","Exit"],["#8855ff","Stair"],["#60b8ff","Person"],["#ff4400","Fire"],["#ffd700","Path"]].map(([col,lbl])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div style={{width:12,height:12,background:col,borderRadius:2,flexShrink:0}}/>
                <span>{lbl}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:9,letterSpacing:2,color:"#3a6a8a",marginBottom:4}}>// EVENT LOG</div>
            {!log.length&&<div style={{fontSize:9,color:"#1a3a5a"}}>No events yet</div>}
            {log.map(e=>(
              <div key={e.id} style={{fontSize:9,marginBottom:3,color:e.type==="fire"?"#ff6a00":e.type==="warn"?"#ffd700":e.type==="safe"?"#00ff88":"#5a8aaa"}}>{e.msg}</div>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",alignItems:"center",padding:16}}>
          <div style={{fontSize:10,color:"#2a5a8a",letterSpacing:2,marginBottom:8}}>
            {phase==="build"
              ?`FLOOR ${activeFloor+1} ACTIVE · TOOL: ${TOOLS.find(t=>t.key===tool)?.label.toUpperCase()} · OR USE 🏗 AUTO-BUILD →`
              :`SIMULATING · STEP ${step} · ${fireSet.size} FIRE CELLS`}
          </div>
          <svg width={svgW} height={svgH}
            style={{background:"#040810",border:"1px solid #1a3a5a",borderRadius:4,display:"block"}}
            onMouseLeave={()=>{draggingRef.current=false;}}>
            {cellElements}
            {phase==="build"&&(
              <text x={svgW-10} y={svgH-10} textAnchor="end" fontSize="10" fill="#1a3a5a" fontFamily="'Courier New',monospace">
                click floor plate to switch active floor
              </text>
            )}
            <div className="zoom-controls">
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="zoom-btn">+</button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="zoom-btn">-</button>
            </div>
            <div
              className="grid-wrapper"
              onMouseLeave={() => setDragging(false)}
              onWheel={(e) => {
                e.preventDefault();
                setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
              }}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
                transition: 'transform 0.1s ease-out'
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  cursor: phase === "build" ? "crosshair" : "default"
                }}
              />
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

const inputStyle = {
  width:"100%", background:"#070f1c", border:"1px solid #1a3a5a",
  color:"#a0c8e8", padding:"5px 8px", fontSize:11,
  fontFamily:"'Courier New',monospace", borderRadius:3, boxSizing:"border-box"
};

function Label({text}) {
  return <div style={{fontSize:9,color:"#4a7aaa",marginBottom:-4,letterSpacing:1}}>{text}</div>;
}

function Btn({onClick,color,label}) {
  return (
    <button onClick={onClick} style={{
      background:"transparent",border:`1px solid ${color}`,color,
      padding:"8px 10px",cursor:"pointer",borderRadius:3,
      fontSize:11,letterSpacing:1,fontFamily:"'Courier New',monospace",transition:"background 0.2s"
    }}
      onMouseEnter={e=>e.currentTarget.style.background=color+"22"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
    >{label}</button>
  );
}
 
