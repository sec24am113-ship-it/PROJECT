"""
SafeEscape Backend: Real-time fire spread and evacuation simulator.
FastAPI WebSocket server with REST endpoints for blueprint upload and simulation control.
"""

from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import asyncio
from typing import Dict, Set

from graph_engine import GraphEngine
from blueprint_parser import BlueprintParser
from simulation_runner import SimulationRunner
from gemini_advisor import GeminiAdvisor

# Initialize FastAPI app
app = FastAPI(
    title="SafeEscape API",
    description="Real-time fire spread and evacuation simulator",
    version="1.0.0"
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active WebSocket connections
active_connections: Set[WebSocket] = set()

# Global simulation state
current_simulation: Dict = {
    "runner": None,
    "graph": None,
    "running": False,
}


@app.post("/upload-blueprint")
async def upload_blueprint(file: UploadFile = File(...)):
    """
    Upload a blueprint image and parse it to generate room layout.
    
    Args:
        file: Image file (PNG, JPG, etc.)
        
    Returns:
        JSON structure with rooms and corridors
    """
    try:
        content = await file.read()
        
        # Parse the image
        result = BlueprintParser.parse_image(content)
        
        # Update global graph
        graph = GraphEngine.from_json(result)
        current_simulation["graph"] = graph
        
        return {
            "success": True,
            "rooms": result["rooms"],
            "corridors": result["corridors"],
            "room_count": len(result["rooms"]),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing blueprint: {str(e)}")


@app.post("/parse-text")
async def parse_text_description(data: dict):
    """
    Parse a natural language building description.
    
    Example: {"description": "3 floors 8 rooms each 2 exits"}
    
    Args:
        data: JSON with "description" field
        
    Returns:
        JSON structure with rooms and corridors
    """
    try:
        description = data.get("description", "")
        if not description:
            raise ValueError("Description is required")
        
        result = BlueprintParser.parse_natural_language(description)
        
        # Update global graph
        graph = GraphEngine.from_json(result)
        current_simulation["graph"] = graph
        
        return {
            "success": True,
            "rooms": result["rooms"],
            "corridors": result["corridors"],
            "room_count": len(result["rooms"]),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing description: {str(e)}")


@app.post("/parse-grid")
async def parse_grid_layout(data: dict):
    """
    Parse a grid-based building layout from manual editor.
    
    Args:
        data: JSON with "grid" field (2D array of cell types)
        
    Returns:
        JSON structure with rooms and corridors
    """
    try:
        grid_data = data.get("grid_data", {})
        if not grid_data:
            raise ValueError("Grid data is required")
        
        result = BlueprintParser.parse_grid(grid_data)
        
        # Update global graph
        graph = GraphEngine.from_json(result)
        current_simulation["graph"] = graph
        
        return {
            "success": True,
            "rooms": result["rooms"],
            "corridors": result["corridors"],
            "room_count": len(result["rooms"]),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing grid: {str(e)}")


@app.post("/setup-simulation")
async def setup_simulation(data: dict):
    """
    Configure simulation parameters before running.
    
    Args:
        data: JSON with:
            - agent_count: Number of people to evacuate
            - start_room: Initial room for agents
            - fire_origin: Room where fire starts
            
    Returns:
        Confirmation with simulation ready state
    """
    try:
        print(f"[SETUP] Setup simulation called with data: {data}")
        
        if not current_simulation["graph"]:
            raise ValueError("No building layout loaded")
        
        agent_count = data.get("agent_count", 50)
        start_room = data.get("start_room", "room_0")
        fire_origin = data.get("fire_origin", "room_1")
        
        print(f"[SETUP] Creating runner with {agent_count} agents")
        print(f"[SETUP] Start room: {start_room}, Fire origin: {fire_origin}")
        
        # Create simulation runner
        runner = SimulationRunner(current_simulation["graph"])
        runner.setup_agents(agent_count, start_room)
        
        print(f"[SETUP] Agents created: {len(runner.agent_engine.agents)}")
        
        # Check agent paths
        for agent_id, agent in list(runner.agent_engine.agents.items())[:3]:  # Show first 3
            print(f"[SETUP] Agent {agent_id}: room={agent.current_room}, path={agent.current_path}")
        
        runner.ignite_fire(fire_origin)
        
        current_simulation["runner"] = runner
        
        print(f"[SETUP] Simulation setup complete!")
        
        return {
            "success": True,
            "agents": agent_count,
            "start_room": start_room,
            "fire_origin": fire_origin,
            "ready": True,
        }
    except Exception as e:
        print(f"[SETUP] Setup error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Setup error: {str(e)}")


@app.websocket("/ws/simulate")
async def websocket_simulate(websocket: WebSocket):
    """
    WebSocket endpoint for real-time simulation streaming.
    Clients connect here to receive frame-by-frame updates.
    
    Protocol:
    1. Client connects
    2. Receives initial state
    3. Server sends frames at ~10 FPS
    4. Client can send "pause" or "resume" commands
    """
    await websocket.accept()
    active_connections.add(websocket)
    
    try:
        # Send initial state
        runner = current_simulation["runner"]
        if not runner:
            await websocket.send_json({"error": "No simulation loaded. Call /setup-simulation first."})
            await websocket.close()
            return
        
        # Start simulation in background task
        simulation_task = asyncio.create_task(_run_simulation_loop(websocket, runner))
        
        # Listen for client commands
        try:
            while True:
                data = await websocket.receive_text()
                command = json.loads(data)
                
                if command.get("action") == "pause":
                    current_simulation["running"] = False
                elif command.get("action") == "resume":
                    current_simulation["running"] = True
                elif command.get("action") == "stop":
                    simulation_task.cancel()
                    break
        except asyncio.CancelledError:
            pass
        
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Ensure connection is removed from active set
        active_connections.discard(websocket)
        try:
            await websocket.close()
        except Exception as close_err:
            print(f"Error closing websocket: {close_err}")


async def _run_simulation_loop(websocket: WebSocket, runner: SimulationRunner):
    """
    Run the simulation and stream frames over WebSocket.
    
    Args:
        websocket: Client WebSocket connection
        runner: SimulationRunner instance
    """
    try:
        print(f"[SIM] Starting simulation loop")
        print(f"[SIM] Agents: {len(runner.agent_engine.agents)}")
        exits = [room_id for room_id, room_data in runner.graph.get_all_rooms().items() if room_data.get('is_exit')]
        print(f"[SIM] Exits reachable: {exits}")
        
        frame_count = 0
        
        while not runner.agent_engine.evacuation_complete and frame_count < 500:
            # Run one tick
            frame = runner.tick()
            
            print(f"[SIM] Tick {frame_count}: {len(frame['agents'])} agents, {frame['stats']['evacuated']} evacuated")
            
            # Send frame to client
            await websocket.send_json({
                "type": "frame",
                "data": frame,
            })
            
            # Control frame rate (~10 FPS)
            await asyncio.sleep(0.1)
            frame_count += 1
        
        print(f"[SIM] Simulation ended at tick {frame_count}")
        print(f"[SIM] Evacuation complete: {runner.agent_engine.evacuation_complete}")
        
        # Simulation complete
        summary = runner.get_simulation_summary()
        
        # Generate AI advisor report
        advisor_report = await GeminiAdvisor.generate_report({
            "total_ticks": summary["total_ticks"],
            "stats": runner.agent_engine.get_evacuation_stats(),
        })
        
        await websocket.send_json({
            "type": "complete",
            "summary": summary,
            "report": advisor_report,
        })
        
    except Exception as e:
        print(f"[SIM] Simulation error: {e}")
        import traceback
        traceback.print_exc()
        await websocket.send_json({
            "type": "error",
            "message": str(e),
        })


@app.get("/simulation-status")
async def get_simulation_status():
    """
    Get current simulation status.
    
    Returns:
        Status information
    """
    runner = current_simulation["runner"]
    
    if not runner:
        return {"running": False, "message": "No simulation loaded"}
    
    return {
        "running": runner.simulation_running,
        "current_tick": runner.current_tick,
        "stats": runner.agent_engine.get_evacuation_stats(),
    }


@app.post("/reset-simulation")
async def reset_simulation():
    """Reset the current simulation."""
    runner = current_simulation["runner"]
    if runner:
        runner.reset()
    
    return {"success": True, "message": "Simulation reset"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "OK", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
