import { useState, useEffect, useRef, useCallback } from "react";

const COLS = 16, ROWS = 10, FLOORS = 3;
const CELL = 36;
const ISO_X = CELL, ISO_Y = CELL * 0.5;
const FLOOR_OFFSET_Y = 140;
const FLOOR_OFFSET_X = 20;
const EMPTY="empty", WALL="wall", ROOM="room", EXIT="exit", STAIR="stair";

const TOOLS = [
  { key:"room",   icon:"⬜", label:"Room",   desc:"Walkable floor" },
  { key:"wall",   icon:"⬛", label:"Wall",   desc:"Solid barrier" },
  { key:"exit",   icon:"🚪", label:"Exit",   desc:"Evacuation exit" },
  { key:"stair",  icon:"🪜", label:"Stair",  desc:"Connect floors" },
  { key:"person", icon:"🧍", label:"Person", desc:"Add occupant" },
  { key:"erase",  icon:"✕",  label:"Erase",  desc:"Remove cell" },
];

function toIso(col, row, floor) {
  const ox = 320 + FLOOR_OFFSET_X * (FLOORS - 1 - floor);
  const oy = 80  + FLOOR_OFFSET_Y * (FLOORS - 1 - floor);
  return { x: ox + (col - row) * (ISO_X/2), y: oy + (col + row) * (ISO_Y/2) };
}

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

export default function EvacSim3D() {
  const [grids, setGrids]       = useState(makeGrids);
  const [tool,  setTool]        = useState("room");
  const [activeFloor, setActiveFloor] = useState(0);
  const [phase, setPhase]       = useState("build");
  const [fireSet, setFireSet]   = useState(new Set());
  const [persons, setPersons]   = useState([]);
  const [paths,   setPaths]     = useState([]);
  const [step,    setStep]      = useState(0);
  const [running, setRunning]   = useState(false);
  const [log,     setLog]       = useState([]);
  const [hovered, setHovered]   = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [bFloors,  setBFloors]  = useState("3");
  const [bRooms,   setBRooms]   = useState("3,3,2");
  const [bPeople,  setBPeople]  = useState("5,6,4");
  const [bError,   setBError]   = useState("");

  const intervalRef = useRef(null);
  const personsRef  = useRef(persons);
  const fireRef     = useRef(fireSet);
  const gridsRef    = useRef(grids);
  const draggingRef = useRef(false);
  const toolRef     = useRef(tool);
  const phaseRef    = useRef(phase);
  personsRef.current = persons;
  fireRef.current    = fireSet;
  gridsRef.current   = grids;
  toolRef.current    = tool;
  phaseRef.current   = phase;

  const addLog = (msg, type="info") =>
    setLog(p=>[{msg,type,id:Date.now()+Math.random()},...p].slice(0,10));
  const cellKey = (f,r,c) => `${f},${r},${c}`;

  const handleAutoBuild = () => {
    setBError("");
    const nf = parseInt(bFloors);
    if (isNaN(nf)||nf<1||nf>FLOORS) { setBError(`Floors: 1 to ${FLOORS}`); return; }
    const rooms  = bRooms.split(",").map(s=>parseInt(s.trim()));
    const people = bPeople.split(",").map(s=>parseInt(s.trim()));
    if (rooms.length<nf||people.length<nf) { setBError(`Need ${nf} values for rooms and people.`); return; }
    for (let i=0;i<nf;i++) {
      if (isNaN(rooms[i])||rooms[i]<1||rooms[i]>6) { setBError(`Floor ${i+1}: rooms must be 1–6`); return; }
      if (isNaN(people[i])||people[i]<0||people[i]>20) { setBError(`Floor ${i+1}: people must be 0–20`); return; }
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
    setPhase("build"); setFireSet(new Set()); setPersons([]);
    setPaths([]); setStep(0); setRunning(false); setLog([]);
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
      setPersons(prev=>{
        const g=gridsRef.current,fire=fireRef.current;
        return prev.map(p=>{
          if (p.reached||p.lost) return p;
          if (fire.has(cellKey(p.f,p.r,p.c))) return {...p,lost:true};
          const path=bfs3D(p.f,p.r,p.c,g,fire);
          if (!path||path.length<2) return {...p,lost:true};
          const [nf,nr,nc]=path[1];
          return {...p,f:nf,r:nr,c:nc,reached:g[nf][nr][nc]===EXIT};
        });
      });
      setPersons(prev=>{
        const g=gridsRef.current,fire=fireRef.current;
        setPaths(prev.filter(p=>!p.reached&&!p.lost).map(p=>bfs3D(p.f,p.r,p.c,g,fire)).filter(Boolean));
        return prev;
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
  },[persons,phase]);

  const getCellDisplay=(f,r,c)=>{
    const base=grids[f][r][c];
    if (phase==="simulate") {
      const k=cellKey(f,r,c);
      if (fireSet.has(k)) return "fire";
      const p=persons.find(p=>p.f===f&&p.r===r&&p.c===c);
      if (p) return p.reached?"safe_p":p.lost?"lost_p":"person";
      if (paths.some(path=>path.some(([pf,pr,pc])=>pf===f&&pr===r&&pc===c))&&base===ROOM) return "path";
    }
    if (base===EMPTY&&persons.find(p=>p.f===f&&p.r===r&&p.c===c)&&phase==="build") return "person";
    return base;
  };

  const cFill={empty:"transparent",wall:"#1a2a3a",room:"#1e3550",exit:"#00cc66",stair:"#8855ff",person:"#60b8ff",fire:"#ff4400",path:"#ffd70033",safe_p:"#00ff88",lost_p:"#880000"};
  const cEmoji={exit:"🚪",stair:"🪜",person:"🧍",safe_p:"✅",lost_p:"💀"};

  function isoCell(f,r,c,display) {
    if (display==="empty") return null;
    const {x,y}=toIso(c,r,f);
    const hw=ISO_X/2,hh=ISO_Y/2;
    const wallH=display==="wall"?28:display==="stair"?18:12;
    const fill=cFill[display]||"#1e3550";
    const isFire=display==="fire";
    const topPts=[`${x},${y-hh}`,`${x+hw},${y}`,`${x},${y+hh}`,`${x-hw},${y}`].join(" ");
    const leftPts=[`${x-hw},${y}`,`${x},${y+hh}`,`${x},${y+hh+wallH}`,`${x-hw},${y+wallH}`].join(" ");
    const rightPts=[`${x+hw},${y}`,`${x},${y+hh}`,`${x},${y+hh+wallH}`,`${x+hw},${y+wallH}`].join(" ");
    const lc=isFire?"#cc2200":display==="wall"?"#1a2030":"#162840";
    const rc=isFire?"#ff3300":display==="wall"?"#1e2840":"#1a3048";
    const isHov=hovered===`${f},${r},${c}`;
    return (
      <g key={`${f}-${r}-${c}`} style={{cursor:phase==="build"?"crosshair":"default"}}
        onMouseDown={()=>{draggingRef.current=true;paintCell(f,r,c);}}
        onMouseEnter={()=>{setHovered(`${f},${r},${c}`);if(draggingRef.current)paintCell(f,r,c);}}
        onMouseUp={()=>{draggingRef.current=false;}}>
        {display!=="empty"&&<polygon points={leftPts} fill={lc} stroke="#0a1520" strokeWidth="0.5"/>}
        {display!=="empty"&&<polygon points={rightPts} fill={rc} stroke="#0a1520" strokeWidth="0.5"/>}
        <polygon points={topPts} fill={isHov&&phase==="build"?"#ffffff22":fill} stroke="#0a1520" strokeWidth="0.5" opacity={isFire?0.9:1}/>
        {cEmoji[display]&&<text x={x} y={y-hh+2} textAnchor="middle" fontSize="11" style={{userSelect:"none",pointerEvents:"none"}}>{cEmoji[display]}</text>}
        {display==="stair"&&[1,2,3].map(i=><line key={i} x1={x-hw*0.6+i*(hw*0.4)} y1={y-hh+i*3} x2={x+hw*0.1+i*(hw*0.2)} y2={y+i*3} stroke="#aa77ff" strokeWidth="1.5" opacity="0.6"/>)}
        {display==="path"&&<circle cx={x} cy={y} r="3" fill="#ffd700" opacity="0.7"/>}
        {isFire&&<ellipse cx={x} cy={y-hh-2} rx="6" ry="4" fill="#ff8800" opacity="0.5"><animate attributeName="ry" values="4;6;4" dur="0.6s" repeatCount="indefinite"/></ellipse>}
      </g>
    );
  }

  const svgW=820,svgH=620;
  const cellElements=[];
  for (let f=FLOORS-1;f>=0;f--) {
    const lp=toIso(0,0,f);
    cellElements.push(<text key={`fl-${f}`} x={lp.x-ISO_X/2-10} y={lp.y} fill={activeFloor===f?"#60b8ff":"#3a5a7a"} fontSize="11" fontFamily="'Courier New',monospace" textAnchor="end" style={{userSelect:"none"}}>FL {f+1}</text>);
    const corners=[toIso(0,0,f),toIso(COLS-1,0,f),toIso(COLS-1,ROWS-1,f),toIso(0,ROWS-1,f)];
    cellElements.push(
      <polygon key={`base-${f}`} points={corners.map(p=>`${p.x},${p.y}`).join(" ")} fill={f===activeFloor?"#0a1828":"#070e18"} stroke={f===activeFloor?"#2a5a8a":"#0f2035"} strokeWidth={f===activeFloor?1.5:0.5} onClick={()=>setActiveFloor(f)} style={{cursor:"pointer"}}/>
    );
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      const display=getCellDisplay(f,r,c);
      if (display==="empty"&&f===activeFloor&&phase==="build") {
        const {x,y}=toIso(c,r,f);
        const hw=ISO_X/2,hh=ISO_Y/2;
        const pts=[`${x},${y-hh}`,`${x+hw},${y}`,`${x},${y+hh}`,`${x-hw},${y}`].join(" ");
        cellElements.push(
          <polygon key={`hit-${f}-${r}-${c}`} points={pts} fill="transparent" stroke="transparent" style={{cursor:"crosshair"}}
            onMouseDown={()=>{draggingRef.current=true;paintCell(f,r,c);}}
            onMouseEnter={()=>{setHovered(`${f},${r},${c}`);if(draggingRef.current)paintCell(f,r,c);}}
            onMouseUp={()=>{draggingRef.current=false;}}
          />
        );
      } else if (display!=="empty") {
        cellElements.push(isoCell(f,r,c,display));
      }
    }
  }

  const safe=persons.filter(p=>p.reached).length;
  const lost=persons.filter(p=>p.lost).length;
  const danger=persons.filter(p=>!p.reached&&!p.lost).length;

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
          </svg>
          <div style={{fontSize:9,color:"#1a3a5a",letterSpacing:2,marginTop:8}}>
            ISO 3D · {COLS}×{ROWS}×{FLOORS} · BACK-TO-FRONT RENDERING
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
 
