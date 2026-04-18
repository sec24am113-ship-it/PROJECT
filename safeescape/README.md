# 🔥 SafeEscape - Fire Spread & Evacuation Simulator

A real-time fire spread and evacuation simulator built for the **Google Solution Challenge 2026**. SafeEscape enables architects, safety engineers, and emergency planners to visualize and test building evacuation scenarios using fire spread simulations and AI-powered analysis.

## ✨ Features

### Three Input Modes
- **📐 Manual Grid Editor**: Minecraft-style 20x20 grid to design building layouts
- **📝 Natural Language Parsing**: Describe buildings in plain English (e.g., "3 floors, 8 rooms each, 2 exits")
- **📷 Image Upload**: Upload blueprint images for automatic room detection using OpenCV

### Simulation Engine
- **🔥 Realistic Fire Spread**: Cellular automaton fire spread with heat dissipation
- **👥 Dynamic Agent Routing**: Evacuation agents with A* pathfinding that recalculates when blocked
- **🔄 Real-time Visualization**: WebSocket streaming of frame-by-frame simulation updates
- **🎨 Heatmap Rendering**: Color-coded rooms (green → yellow → orange → red) showing fire progression
- **📊 Live Statistics**: Track evacuated, remaining, stuck, and simulation tick count

### AI-Powered Analysis
- **🤖 Evacuation Reports**: Post-simulation reports using Hugging Face Mistral-7B model
- **💡 Bottleneck Analysis**: Identifies congestion points in evacuation routes
- **🏗️ Design Recommendations**: AI-generated suggestions for improving building safety

### Export & Analytics
- **📥 Frame Export**: Download simulation frames as PNG images
- **📈 Evacuation Metrics**: Success rate, average evacuation time, rooms affected
- **🔍 Simulation History**: Full playback of all simulation frames

## 🚀 Tech Stack

**100% Free and Open Source** - No paid APIs, no subscriptions, no API keys required.

### Backend
- **Framework**: FastAPI + WebSockets (uvicorn)
- **Graph Engine**: NetworkX
- **Fire Simulation**: NumPy + custom cellular automaton
- **Image Processing**: OpenCV + Pillow
- **AI Advisor**: Hugging Face Inference API (free public models)

### Frontend
- **Framework**: React 18 + Vite
- **Visualization**: HTML5 Canvas
- **Styling**: CSS3
- **Real-time**: WebSocket client

## 📋 Requirements

### System Requirements
- **Python**: 3.8+
- **Node.js**: 16+ (with npm)
- **RAM**: 2GB minimum
- **Disk**: 500MB for dependencies

### Optional (for better image parsing)
- Preprocess blueprint images in high contrast (white background, black walls)

## 🛠️ Installation & Setup

### Step 1: Clone or Extract SafeEscape

```bash
cd safeescape
```

### Step 2: Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

**Dependencies installed:**
- `fastapi==0.104.1` - Web framework
- `uvicorn==0.24.0` - ASGI server
- `websockets==12.0` - WebSocket support
- `networkx==3.2.1` - Graph operations
- `numpy==1.24.3` - Numerical computing
- `opencv-python==4.8.1.78` - Image processing
- `pillow==10.1.0` - Image handling
- `python-multipart==0.0.6` - File uploads
- `requests==2.31.0` - HTTP requests
- `aiofiles==23.2.1` - Async file operations

#### Run Backend Server
```bash
uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 3: Frontend Setup

#### Install Node Dependencies
```bash
cd frontend
npm install
```

#### Run Development Server
```bash
npm run dev
```

Expected output:
```
VITE v4.4.5  ready in 123 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Step 4: Open in Browser

Navigate to **http://localhost:5173** in your web browser.

## 🎮 How to Use SafeEscape

### 1. Create a Building Layout

Choose one of three methods:

#### Option A: Describe in Natural Language
```
"3 floors, 8 rooms each floor, 2 exits per floor"
"4 story office building, 10 rooms per floor, 3 exits"
"2 floors, 6 rooms each, 1 emergency exit per floor"
```

#### Option B: Draw Manually
1. Select a tool: Room (blue), Wall (gray), Exit (green), Fire (red)
2. Click cells on the 20×20 grid
3. Click "Generate Layout"

#### Option C: Upload Blueprint Image
1. Upload a building blueprint image (PNG, JPG)
2. Backend analyzes rooms and corridors
3. Generated layout displayed automatically

### 2. Configure Simulation

Set evacuation parameters:
- **Number of Evacuees**: 1-200 people
- **Fire Origin**: Select which room catches fire first
- **Start Location**: Where evacuation begins (usually same as fire origin or opposite)

### 3. Run Simulation

1. Click **"▶️ Start Simulation"**
2. Watch real-time evacuation:
   - 🔵 Blue circles = evacuating people
   - 🟢 Green = safe areas
   - 🟡 Yellow = warm areas
   - 🔴 Red = fire/blocked areas
   - ⚪ Gray = evacuated people
   - 🔴 Pink = stuck people

### 4. View Results

After simulation completes:
- **Live Stats**: Evacuated, remaining, stuck, tick count
- **AI Report**: Post-simulation analysis with recommendations
- **Export**: Download frames as images
- **Success Rate**: Visual progress bar showing evacuation efficiency

## 🔌 API Endpoints

### REST Endpoints

#### Upload Blueprint Image
```
POST /upload-blueprint
Content-Type: multipart/form-data
Body: binary image file

Response:
{
  "success": true,
  "rooms": {...},
  "corridors": [...],
  "room_count": 42
}
```

#### Parse Natural Language
```
POST /parse-text
Content-Type: application/json
Body: {"description": "3 floors, 8 rooms each, 2 exits"}

Response:
{
  "success": true,
  "rooms": {...},
  "corridors": [...],
  "room_count": 24
}
```

#### Setup Simulation
```
POST /setup-simulation
Content-Type: application/json
Body: {
  "agent_count": 50,
  "start_room": "room_0",
  "fire_origin": "room_1"
}

Response: {"success": true, "ready": true}
```

#### Get Simulation Status
```
GET /simulation-status

Response:
{
  "running": true,
  "current_tick": 45,
  "stats": {...}
}
```

#### Reset Simulation
```
POST /reset-simulation

Response: {"success": true}
```

### WebSocket Endpoint

#### Real-time Simulation Stream
```
ws://localhost:8000/ws/simulate

Messages:
{
  "type": "frame",
  "data": {
    "tick": 45,
    "rooms": {...},
    "agents": [...],
    "stats": {...}
  }
}

// When complete:
{
  "type": "complete",
  "summary": {...},
  "report": "AI-generated text report..."
}
```

## 📊 Output Files

### Exported Frames
Located in browser downloads:
- `frame_0.png`, `frame_1.png`, ... (one per simulation tick)
- 800×600 PNG images with room heat visualization

### Simulation Data
Available via API `/simulation-status`:
- Total ticks
- Evacuation statistics
- Bottleneck rooms
- Average evacuation time

## 🧠 Simulation Algorithm

### Fire Spread (Cellular Automaton)
1. Each tick, fire spreads to adjacent rooms
2. Heat dissipates naturally (5% per tick)
3. Corridors block when adjacent room heat > 0.7
4. Room states: safe (heat 0-0.2), hot (0.2-0.7), blocked (>0.7)

### Agent Routing (A* Pathfinding)
1. Each agent finds nearest exit using A*
2. Heuristic: Euclidean distance between room centers
3. Path recalculates every tick if blocked
4. Agent stuck after 6+ failed recalculations

### Performance Optimization
- Graph-based room representation (O(log n) pathfinding)
- Parallel agent updates
- WebSocket frame rate limited to ~10 FPS

## 🎨 Architecture

```
safeescape/
├── backend/
│   ├── main.py                 # FastAPI app + WebSocket
│   ├── graph_engine.py         # Room graph management
│   ├── fire_engine.py          # Fire spread simulation
│   ├── pathfinder.py           # A* algorithm
│   ├── agent_engine.py         # Agent management
│   ├── blueprint_parser.py     # Image/text parsing
│   ├── gemini_advisor.py       # AI report generation
│   ├── simulation_runner.py    # Main simulation loop
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # Main app component
│   │   ├── App.css
│   │   ├── index.css           # Global styles
│   │   ├── components/
│   │   │   ├── GridEditor.jsx
│   │   │   ├── SimulationView.jsx
│   │   │   ├── NaturalLanguageInput.jsx
│   │   │   ├── BlueprintUpload.jsx
│   │   │   └── AdvisorReport.jsx
│   │   ├── hooks/
│   │   │   └── useSimulation.js
│   │   └── utils/
│   │       └── buildingParser.js
│   └── vite.config.js
│
└── README.md (this file)
```

## 🤖 AI Advisor (Hugging Face Integration)

### How It Works
1. After simulation completes, results sent to Hugging Face API
2. Free Mistral-7B model analyzes evacuation metrics
3. Model generates recommendations for building design
4. Report includes:
   - Evacuation efficiency assessment
   - Bottleneck identification
   - Exit placement suggestions
   - Corridor width recommendations

### API Usage
- **Endpoint**: `https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3`
- **Authentication**: None (free public model)
- **Rate Limits**: ~50 requests/minute per IP
- **Response Time**: 5-15 seconds

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 8000 is in use
netstat -an | grep 8000

# Use different port
uvicorn main:app --port 8001
```

### Frontend Connection Error
```
WebSocket error: Connection refused
```
**Solution**: Ensure backend is running at `http://localhost:8000`

### Image Upload Fails
- Ensure image is < 10MB
- Try high-contrast images (white background, black walls)
- Supported formats: PNG, JPG, GIF, BMP

### Slow Simulation
- Reduce agent count (start with 10)
- Use smaller building (fewer rooms)
- Check system RAM usage

### AI Report Not Generating
- Check internet connection (Hugging Face API requires internet)
- May timeout with large simulations (>300 ticks)
- Fallback: Manually review evacuation stats

## 📈 Performance Metrics

### Typical Simulation Times
- **Small building** (6 rooms, 20 people): ~50 ticks
- **Medium building** (24 rooms, 50 people): ~100 ticks
- **Large building** (72 rooms, 150 people): ~250 ticks

### System Requirements for Scaling
- **100+ rooms**: 4GB RAM recommended
- **1000+ agents**: Requires backend optimization (multi-threading)
- **High-resolution canvas**: GPU acceleration recommended (canvas performance)

## 🔐 Security Notes

- ✅ No user authentication required (local-only by default)
- ✅ No data stored on server (stateless architecture)
- ✅ All computation local (no cloud dependencies except AI advisor)
- ⚠️ To deploy publicly, add CORS restrictions and authentication

## 📝 Example Commands

### Run Complete Stack (One Terminal per Command)

**Terminal 1 - Backend:**
```bash
cd safeescape/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd safeescape/frontend
npm install
npm run dev
```

**Terminal 3 - Open Browser:**
```bash
# Windows
start http://localhost:5173

# macOS
open http://localhost:5173

# Linux
xdg-open http://localhost:5173
```

### Build for Production

**Frontend:**
```bash
cd frontend
npm run build
# Output in frontend/dist/
```

**Backend:** No build needed (Python is interpreted)

## 🌟 Future Enhancements

- [ ] 3D building visualization
- [ ] Multiple fire sources
- [ ] Smoke spread simulation
- [ ] Emergency personnel (firefighters)
- [ ] Historical database of real fire incidents
- [ ] Mobile app (React Native)
- [ ] VR evacuation training mode
- [ ] Machine learning prediction of evacuation patterns

## 📄 License

SafeEscape is free and open source, created for the Google Solution Challenge 2026.

## 🤝 Contributing

We welcome contributions! Areas for improvement:
- Fire physics refinement
- Image parsing accuracy (better OpenCV tuning)
- UI/UX improvements
- Additional building templates
- Documentation improvements

## 📞 Support

For issues or questions:
1. Check this README's Troubleshooting section
2. Review error messages in browser console (F12)
3. Check backend logs in terminal

---

**Made with ❤️ for emergency preparedness and building safety**

*Remember: Always follow official evacuation procedures and safety guidelines. This simulator is for educational and planning purposes only.*
