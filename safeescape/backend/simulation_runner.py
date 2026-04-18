"""
Simulation Runner: Main orchestrator for fire spread and evacuation simulation.
Runs tick-by-tick simulation, collecting frame data for visualization.
"""

from typing import Dict, List, Any, Optional, Callable
from graph_engine import GraphEngine
from fire_engine import FireEngine
from agent_engine import AgentEngine
from pathfinder import Pathfinder
import json


class SimulationRunner:
    """Orchestrates the complete evacuation simulation."""

    def __init__(self, graph_engine: GraphEngine):
        """
        Initialize the simulation runner.
        
        Args:
            graph_engine: Building layout graph
        """
        self.graph = graph_engine
        self.pathfinder = Pathfinder(graph_engine)
        self.fire_engine = FireEngine(graph_engine)
        self.agent_engine = AgentEngine(graph_engine, self.pathfinder)

        self.current_tick = 0
        self.simulation_running = False
        self.simulation_history: List[Dict[str, Any]] = []
        self.frame_callback: Optional[Callable] = None

    def setup_agents(self, agent_count: int, start_room: str) -> None:
        """
        Add evacuation agents to the simulation.
        
        Args:
            agent_count: Number of people to evacuate
            start_room: Room where agents start
        """
        for i in range(agent_count):
            self.agent_engine.add_agent(f"agent_{i}", start_room)

    def ignite_fire(self, room_id: str) -> None:
        """
        Start a fire in a room.
        
        Args:
            room_id: Room where fire starts
        """
        self.fire_engine.ignite_room(room_id)

    def tick(self) -> Dict[str, Any]:
        """
        Execute one simulation step:
        1. Update fire spread
        2. Move agents
        3. Collect frame data
        
        Returns:
            Frame data for visualization
        """
        # Update fire
        self.fire_engine.tick()

        # Move agents
        self.agent_engine.tick()

        # Collect frame data
        frame_data = self._collect_frame_data()
        self.simulation_history.append(frame_data)

        self.current_tick += 1

        return frame_data

    def _collect_frame_data(self) -> Dict[str, Any]:
        """
        Collect all data for the current simulation frame.
        
        Returns:
            Frame data: rooms, agents, fire state, stats
        """
        rooms_state = {}
        for room_id, room_data in self.graph.get_all_rooms().items():
            rooms_state[room_id] = {
                "id": room_id,
                "x": room_data["x"],
                "y": room_data["y"],
                "width": room_data["width"],
                "height": room_data["height"],
                "state": room_data["state"],
                "heat": room_data["heat"],
                "is_exit": room_data["is_exit"],
            }

        agents_state = self.agent_engine.get_all_agents_state()
        stats = self.agent_engine.get_evacuation_stats()

        return {
            "tick": self.current_tick,
            "rooms": rooms_state,
            "agents": agents_state,
            "fire_rooms": list(self.fire_engine.get_fire_rooms()),
            "stats": stats,
        }

    def run_until_complete(self, max_ticks: int = 500) -> Dict[str, Any]:
        """
        Run the simulation until evacuation is complete or max ticks reached.
        
        Args:
            max_ticks: Maximum number of simulation steps
            
        Returns:
            Final simulation statistics
        """
        self.simulation_running = True

        while self.current_tick < max_ticks:
            if self.agent_engine.evacuation_complete:
                break

            frame = self.tick()
            if self.frame_callback:
                self.frame_callback(frame)

        self.simulation_running = False

        return {
            "total_ticks": self.current_tick,
            "stats": self.agent_engine.get_evacuation_stats(),
            "final_frame": self._collect_frame_data(),
            "history": self.simulation_history,
        }

    def set_frame_callback(self, callback: Callable) -> None:
        """
        Set a callback function to receive each frame.
        Used for real-time WebSocket updates.
        
        Args:
            callback: Function that receives frame data
        """
        self.frame_callback = callback

    def reset(self) -> None:
        """Reset the simulation to initial state."""
        self.current_tick = 0
        self.simulation_running = False
        self.simulation_history.clear()
        self.fire_engine.reset()
        self.agent_engine.reset()

    def get_simulation_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the completed simulation.
        
        Returns:
            Summary statistics
        """
        if not self.simulation_history:
            return {}

        final_stats = self.simulation_history[-1]["stats"]
        total_agents = final_stats["total_agents"]
        evacuated = final_stats["evacuated"]
        stuck = final_stats["stuck"]

        return {
            "total_ticks": self.current_tick,
            "total_agents": total_agents,
            "evacuated": evacuated,
            "evacuation_rate": (evacuated / total_agents * 100) if total_agents > 0 else 0,
            "stuck": stuck,
            "average_evacuation_time": (
                self.current_tick / evacuated if evacuated > 0 else 0
            ),
            "rooms_affected": len(
                self.simulation_history[-1].get("fire_rooms", [])
            ),
        }

    def export_frames_as_json(self) -> str:
        """
        Export all simulation frames as JSON.
        
        Returns:
            JSON string of all frame data
        """
        return json.dumps(
            {
                "simulation": self.get_simulation_summary(),
                "frames": self.simulation_history,
            }
        )
