"""
Agent Engine: Manages evacuation agents (people) moving through the building.
Each agent has a position, target, and recalculates path when blocked.
"""

from typing import List, Dict, Any, Optional
from graph_engine import GraphEngine
from pathfinder import Pathfinder


class Agent:
    """Represents a person evacuating the building."""

    def __init__(self, agent_id: str, start_room: str, pathfinder: Pathfinder):
        """
        Initialize an agent.
        
        Args:
            agent_id: Unique agent identifier
            start_room: Starting room ID
            pathfinder: Pathfinder instance for route planning
        """
        self.agent_id = agent_id
        self.current_room = start_room
        self.current_path: Optional[List[str]] = None
        self.pathfinder = pathfinder
        self.evacuated = False
        self.stuck_counter = 0
        self.target_exit = None

    def initialize_path(self) -> bool:
        """
        Initialize the evacuation path from current room.
        
        Returns:
            True if a path was found, False otherwise
        """
        self.target_exit = self.pathfinder.find_nearest_exit(self.current_room)
        if self.target_exit:
            self.current_path = self.pathfinder.find_path(
                self.current_room, self.target_exit
            )
            return self.current_path is not None
        return False

    def move(self) -> bool:
        """
        Move the agent one step along their evacuation path.
        If the path becomes blocked, recalculate.
        
        Returns:
            True if agent successfully moved, False if stuck
        """
        if self.evacuated:
            return True

        # Initialize path if not already done
        if self.current_path is None:
            if not self.initialize_path():
                self.stuck_counter += 1
                return False

        # Check if we're at the exit
        graph = self.pathfinder.graph
        current_room_data = graph.get_room_state(self.current_room)
        if current_room_data and current_room_data.get("is_exit"):
            self.evacuated = True
            return True

        # Move to next room in path
        if len(self.current_path) > 1:
            next_room = self.current_path[1]

            # Check if next room is still passable
            next_room_data = graph.get_room_state(next_room)
            if not next_room_data or next_room_data["state"] == "blocked":
                # Path is blocked, recalculate
                self.current_path = self.pathfinder.recalculate_path(
                    self.current_room, self.current_path
                )
                if not self.current_path:
                    self.stuck_counter += 1
                    return False
                next_room = self.current_path[1] if len(self.current_path) > 1 else None

            if next_room:
                self.current_room = next_room
                self.stuck_counter = 0
                return True

        return False

    def get_state(self) -> Dict[str, Any]:
        """Get agent's current state."""
        room_data = self.pathfinder.graph.get_room_state(self.current_room)
        x = room_data["x"] + room_data["width"] / 2 if room_data else 0
        y = room_data["y"] + room_data["height"] / 2 if room_data else 0

        return {
            "id": self.agent_id,
            "current_room": self.current_room,
            "x": x,
            "y": y,
            "evacuated": self.evacuated,
            "stuck": self.stuck_counter > 5,
            "path": self.current_path or [],
        }


class AgentEngine:
    """Manages all evacuation agents."""

    def __init__(self, graph_engine: GraphEngine, pathfinder: Pathfinder):
        """
        Initialize the agent engine.
        
        Args:
            graph_engine: Building layout graph
            pathfinder: Pathfinder for route planning
        """
        self.graph = graph_engine
        self.pathfinder = pathfinder
        self.agents: Dict[str, Agent] = {}
        self.evacuation_complete = False

    def add_agent(self, agent_id: str, start_room: str) -> Agent:
        """
        Add a new agent to the simulation.
        
        Args:
            agent_id: Unique agent ID
            start_room: Starting room
            
        Returns:
            The created Agent
        """
        agent = Agent(agent_id, start_room, self.pathfinder)
        self.agents[agent_id] = agent
        agent.initialize_path()
        return agent

    def tick(self) -> None:
        """Advance all agents one time step."""
        for agent in self.agents.values():
            if not agent.evacuated:
                agent.move()

        # Check if evacuation is complete
        self.evacuation_complete = all(agent.evacuated for agent in self.agents.values())

    def get_all_agents_state(self) -> List[Dict[str, Any]]:
        """Get state of all agents."""
        return [agent.get_state() for agent in self.agents.values()]

    def get_evacuation_stats(self) -> Dict[str, Any]:
        """Get evacuation statistics."""
        total = len(self.agents)
        evacuated = sum(1 for agent in self.agents.values() if agent.evacuated)
        stuck = sum(1 for agent in self.agents.values() if agent.stuck_counter > 5)

        return {
            "total_agents": total,
            "evacuated": evacuated,
            "remaining": total - evacuated,
            "stuck": stuck,
            "complete": self.evacuation_complete,
        }

    def reset(self) -> None:
        """Reset all agents."""
        self.agents.clear()
        self.evacuation_complete = False
