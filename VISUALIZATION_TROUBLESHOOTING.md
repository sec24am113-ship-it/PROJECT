# SafeEscape Visualization Troubleshooting & Testing Guide

## Issues Fixed

### ✅ Fixed: Blueprint Parser Not Detecting Exits
**What was wrong**: When parsing grid layouts, the flood fill algorithm only collected "room" cells and ignored "exit" cells, so rooms with exits weren't marked as exit rooms.

**How it's fixed**: Updated `blueprint_parser.py` to include both "room" and "exit" cells in the flood fill, so exit rooms are now properly identified.

**Result**: Backend now correctly returns `is_exit: true` for rooms containing exit cells.

### ✅ Fixed: Frontend Not Sending Grid Data
**What was wrong**: Frontend was calling `/setup-simulation` without first creating the graph via `/parse-grid`.

**How it's fixed**: Updated `useSimulation.js` to sequence API calls correctly: first parse the grid, then setup simulation.

---

## Testing the Visualization (Step-by-Step)

### Step 1: Open the Frontend
```
Open: http://localhost:5175
```
You should see the SafeEscape interface with a sidebar on the left and a large canvas area.

### Step 2: Create a Building Layout
**Option A: Draw (Recommended)**
1. Click the **"Draw"** tab
2. Select the **"room"** tool from the toolbar
3. Click cells in the grid to create rooms (form rectangular shapes)
4. Click a cell and select the **"exit"** tool to mark evacuation exits
5. Click **"Generate Layout"** button

**Option B: Draw via Grid Editor**
- The grid is 20x20 cells
- Each cell is 30x30 pixels
- Click to toggle between empty/room/wall/exit/fire
- Create at least 2-3 rooms with exits

### Step 3: Configure Simulation
After generating layout:
1. Set **"Number of Evacuees"**: 20-50
2. Set **"Fire Origin Room"**: Select a room to ignite
3. Click **"▶️ Start Simulation"**

### Step 4: Monitor for Issues
- **Initial**: Page should show "⏳ Connecting to simulation..."
- **Expected**: After 1-2 seconds, canvas should show colored rooms
- **Debug**: Open browser DevTools → Console → check for messages

---

## Debugging: What to Look For

### If No Canvas Output After Simulation Starts

**Check 1: Open Browser Console**
- Press `F12` or Right-click → Inspect → Console
- Look for error messages or logs like:
  - `Starting simulation with config: {...}`
  - `Building layout: {...}`
  - `Rendering frame: {...}`
  - `WebSocket connected`

**Check 2: Verify Frame Data Structure**
In console, check what `frameData` contains. It should have:
```javascript
{
  tick: 0,
  rooms: {
    room_0: { id, x, y, width, height, heat, is_exit, state },
    room_1: { ... },
    ...
  },
  agents: [
    { id, current_room, x, y, evacuated, stuck, path },
    ...
  ],
  fire_rooms: ["room_X"],
  stats: { total_agents, evacuated, remaining, stuck, complete }
}
```

**Check 3: Test Backend Directly**
Run this PowerShell command to verify backend is sending frames:
```powershell
powershell -ExecutionPolicy Bypass -File e:\escape\test_simulation_improved.ps1
```
Look for `[OK] Simulation setup successful!`

### If Canvas Appears Empty

**Reason 1: Rooms Have No Size**
- If rooms are very small (1-2 cells), they won't be visible
- Create rooms with at least 3x3 cell minimum size

**Reason 2: Scale Factor Issue**
- Canvas uses 2x scale factor for crisp rendering
- Room coordinates are in grid cells (20 pixels each)
- If rooms are at (20,20) size (40x60), they display correctly

**Reason 3: No Exits Marked**
- Agents won't move if no exits exist
- Check backend response shows `is_exit: true` for some rooms
- Use backend test script to verify

**Reason 4: Agents Stuck on Start**
- If no exits are reachable, agents can't initialize paths
- Verify exits are connected via corridors to start room
- At least one room must be reachable from start_room

---

## Canvas Display Details

**What You Should See:**
1. **Colored Rectangles**: Each room with heat-based color
   - Green: Safe (cool)
   - Yellow: Warm
   - Orange: Hot  
   - Red: Fire/Blocked

2. **Room Labels**: 
   - "EXIT" text in white for exit rooms
   - Heat percentage (0-100%) in top-right corner

3. **Blue Dots**: Agents moving through rooms
   - Red dots: Stuck agents
   - Gray dots: Evacuated agents

4. **Green Dashed Lines**: Evacuation paths being followed

5. **Live Stats** (Sidebar):
   - Evacuated count
   - Remaining count
   - Stuck count
   - Current tick number

---

## Testing WebSocket Connection

### Quick Test: Monitor Network Traffic
1. Open DevTools → Network tab
2. Start simulation
3. Look for WebSocket connection to `ws://localhost:8000/ws/simulate`
4. Watch for frame messages flowing (should show as binary frames)

### If WebSocket Fails to Connect
- Check backend is running: `http://localhost:8000/docs`
- Verify CORS is enabled (check backend logs for "CORS" messages)
- Try refreshing the page
- Check if port 8000 is accessible

---

## Common Issues & Solutions

| Issue | Check | Fix |
|-------|-------|-----|
| No canvas output | Is `frameData` in console? | Ensure exits are marked in layout |
| Simulation stuck on "Connecting..." | WebSocket connection established? | Restart backend |
| Canvas black/empty | Are rooms visible? | Make rooms larger (3+ cells minimum) |
| Agents not moving | Any reachable exits? | Add exits and verify connectivity |
| Error 422 on setup | Is grid_data formatted correctly? | Use frontend UI instead of direct API calls |

---

## Backend Server Status

- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5175

Both must be running. If issues occur:
```powershell
# Check backend is running
Invoke-WebRequest http://localhost:8000/docs -UseBasicParsing

# Check frontend is running  
Invoke-WebRequest http://localhost:5175 -UseBasicParsing
```

---

## Next Steps

1. **Draw a simple layout** with 3-4 rooms
2. **Mark exits** clearly (use exit tool)
3. **Start simulation** and watch console
4. **Report what you see** (colors, agents, stats, or nothing)
5. **Check frame data structure** in browser console

If visualization still isn't working after these steps, check the browser console logs for specific error messages.
