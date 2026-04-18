"""
Graph Engine: Builds and manages the room connectivity graph.
Nodes represent rooms with position/size metadata.
Edges represent doors/corridors connecting rooms.
"""

import networkx as nx
from typing import Dict, List, Tuple, Any


class GraphEngine:
    """Manages the building layout as a graph of rooms."""

    def __init__(self):
        """Initialize an empty directed graph."""
        self.graph = nx.DiGraph()
        self.rooms: Dict[str, Dict[str, Any]] = {}

    def add_room(self, room_id: str, x: float, y: float, width: float, height: float) -> None:
        """
        Add a room node to the graph.
        
        Args:
            room_id: Unique identifier for the room
            x, y: Top-left corner coordinates
            width, height: Room dimensions
        """
        self.graph.add_node(room_id)
        self.rooms[room_id] = {
            "id": room_id,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "state": "safe",  # safe, hot, blocked
            "heat": 0.0,  # 0.0 to 1.0
            "is_exit": False,
        }

    def add_corridor(self, room1_id: str, room2_id: str, blocked: bool = False) -> None:
        """
        Add a bidirectional door/corridor connecting two rooms.
        
        Args:
            room1_id: First room
            room2_id: Second room
            blocked: Whether the corridor is initially blocked
        """
        self.graph.add_edge(room1_id, room2_id, blocked=blocked)
        self.graph.add_edge(room2_id, room1_id, blocked=blocked)

    def mark_exit(self, room_id: str) -> None:
        """Mark a room as an evacuation exit."""
        if room_id in self.rooms:
            self.rooms[room_id]["is_exit"] = True

    def get_adjacent_rooms(self, room_id: str) -> List[str]:
        """
        Get list of rooms directly connected to this room.
        
        Args:
            room_id: The source room
            
        Returns:
            List of adjacent room IDs
        """
        return list(self.graph.neighbors(room_id))

    def get_adjacent_safe_rooms(self, room_id: str) -> List[str]:
        """
        Get adjacent rooms that are safe or hot (not blocked).
        
        Args:
            room_id: The source room
            
        Returns:
            List of safe adjacent room IDs
        """
        adjacent = []
        for neighbor in self.graph.neighbors(room_id):
            edge_data = self.graph.get_edge_data(room_id, neighbor)
            if not edge_data.get("blocked", False):
                adjacent.append(neighbor)
        return adjacent

    def set_room_state(self, room_id: str, state: str, heat: float = None) -> None:
        """
        Update room state and heat.
        
        Args:
            room_id: The room to update
            state: One of "safe", "hot", "blocked"
            heat: Heat value (0.0 to 1.0)
        """
        if room_id in self.rooms:
            self.rooms[room_id]["state"] = state
            if heat is not None:
                self.rooms[room_id]["heat"] = max(0.0, min(1.0, heat))

    def get_room_state(self, room_id: str) -> Dict[str, Any]:
        """Get the current state of a room."""
        return self.rooms.get(room_id, {})

    def block_corridor(self, room1_id: str, room2_id: str) -> None:
        """Block a corridor between two rooms."""
        if self.graph.has_edge(room1_id, room2_id):
            self.graph[room1_id][room2_id]["blocked"] = True
        if self.graph.has_edge(room2_id, room1_id):
            self.graph[room2_id][room1_id]["blocked"] = True

    def unblock_corridor(self, room1_id: str, room2_id: str) -> None:
        """Unblock a corridor between two rooms."""
        if self.graph.has_edge(room1_id, room2_id):
            self.graph[room1_id][room2_id]["blocked"] = False
        if self.graph.has_edge(room2_id, room1_id):
            self.graph[room2_id][room1_id]["blocked"] = False

    def get_all_rooms(self) -> Dict[str, Dict[str, Any]]:
        """Get all rooms with their metadata."""
        return self.rooms

    def export_as_json(self) -> Dict[str, Any]:
        """Export the graph as JSON-serializable format."""
        return {
            "rooms": self.rooms,
            "corridors": [
                {"from": u, "to": v, "blocked": d.get("blocked", False)}
                for u, v, d in self.graph.edges(data=True)
            ],
        }

    @staticmethod
    def from_json(data: Dict[str, Any]) -> "GraphEngine":
        """Create a GraphEngine from JSON data."""
        engine = GraphEngine()
        
        # Add rooms
        for room_id, room_data in data.get("rooms", {}).items():
            engine.add_room(
                room_id,
                room_data["x"],
                room_data["y"],
                room_data["width"],
                room_data["height"],
            )
            if room_data.get("is_exit", False):
                engine.mark_exit(room_id)
        
        # Add corridors
        for corridor in data.get("corridors", []):
            engine.add_corridor(
                corridor["from"],
                corridor["to"],
                blocked=corridor.get("blocked", False),
            )
        
        return engine
