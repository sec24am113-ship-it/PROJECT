# SafeEscape - Application Fix & Usage Guide

## ✅ Issue Fixed

**Error**: "Error: Failed to setup simulation"

**Root Cause**: The frontend was calling `/setup-simulation` endpoint without first creating the building graph on the backend. The backend requires a graph to exist before setting up a simulation.

**Solution**: Updated `useSimulation.js` to call `/parse-grid` first to create the graph, then call `/setup-simulation`.

## 🚀 Getting Started

### Server URLs
- **Backend API**: http://localhost:8000
- **Frontend UI**: http://localhost:5175

### Accessing the Application
1. Open your browser and navigate to **http://localhost:5175**
2. You should see the SafeEscape main interface

## 📋 How to Run a Simulation

### Option 1: Draw a Building Layout (Recommended for Testing)
1. Click the **"Draw"** tab in the sidebar
2. Use the grid editor to create your building:
   - Select "room" tool and click cells to create rooms
   - Select "exit" tool and mark evacuation exits
   - Select "wall" tool to add walls
3. Click **"Generate Layout"** button
4. Adjust simulation parameters:
   - **Number of Evacuees**: 10-200
   - **Fire Origin Room**: Select which room starts on fire
5. Click **"▶️ Start Simulation"**
6. Watch the real-time evacuation simulation on the canvas

### Option 2: Upload Blueprint Image
1. Click the **"Upload"** tab
2. Select a blueprint image (PNG/JPG)
3. Backend will automatically parse the rooms and corridors
4. Configure and start simulation

### Option 3: Describe Building in Natural Language
1. Click the **"Describe"** tab
2. Enter a text description (e.g., "3 rooms connected with 2 exits")
3. Backend will generate the layout
4. Configure and start simulation

## 🔥 Simulation Features

**Real-time Visualization**:
- Green rooms: Safe (cool)
- Yellow rooms: Warm
- Orange rooms: Hot
- Red rooms: Fire/Blocked
- White dots: Evacuating agents
- Green dashed lines: Agent evacuation paths

**Simulation Metrics**:
- Heat level percentage in each room
- Number of evacuated agents
- Evacuation completion status
- Fire spread progression

## 🛠️ Troubleshooting

### Issue: "Failed to parse building layout"
- Ensure you've drawn rooms in the grid editor
- Make sure at least one cell is marked as "room"

### Issue: "No building layout loaded"
- Generate a building layout first using one of the three methods
- Layout must exist before starting simulation

### Issue: Simulation won't start
- Check that fire origin room exists in the layout
- Verify backend is running on port 8000
- Check browser console for error messages

### Issue: Agents won't evacuate
- Make sure exit rooms are marked in the layout
- Check that exits are reachable from start rooms
- Verify fire doesn't block all evacuation routes

## 📊 Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/parse-grid` | POST | Parse grid layout to create graph |
| `/parse-text` | POST | Parse natural language description |
| `/upload-blueprint` | POST | Parse blueprint image |
| `/setup-simulation` | POST | Configure simulation parameters |
| `/ws/simulate` | WebSocket | Stream real-time frame data |

## ✨ Next Steps

1. **Test the Application**: Use the Draw tab to create a simple layout
2. **Experiment with Scenarios**: Try different room configurations and fire origins
3. **Monitor Performance**: Watch how agents evacuate under different conditions
4. **Get Advisor Report**: AI advisor analyzes evacuation efficiency (coming soon)

## 📝 Notes

- Both servers must be running for the application to work
- Frontend will show loading state while connecting to WebSocket
- Simulations typically run for up to 500 frames (~50 seconds)
- You can stop simulation at any time using the Stop button
