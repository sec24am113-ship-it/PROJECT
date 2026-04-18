"""
Fire Engine: Simulates fire spread using cellular automaton rules.
Each tick, fire spreads to adjacent rooms based on heat thresholds.
Corridors block when heat exceeds 0.7.
"""

from typing import Dict, Set
from graph_engine import GraphEngine


class FireEngine:
    """Manages fire spread simulation in the building."""

    def __init__(self, graph_engine: GraphEngine):
        """
        Initialize the fire engine.
        
        Args:
            graph_engine: The GraphEngine managing the building layout
        """
        self.graph = graph_engine
        self.fire_rooms: Set[str] = set()
        self.heat_map: Dict[str, float] = {}
        
        # Initialize heat map
        for room_id in self.graph.get_all_rooms().keys():
            self.heat_map[room_id] = 0.0

    def ignite_room(self, room_id: str) -> None:
        """
        Start a fire in a room.
        
        Args:
            room_id: The room where fire starts
        """
        if room_id in self.graph.get_all_rooms():
            self.fire_rooms.add(room_id)
            self.heat_map[room_id] = 1.0
            self.graph.set_room_state(room_id, "blocked", 1.0)

    def tick(self) -> None:
        """
        Simulate one time step of fire spread.
        
        Fire spreads to adjacent rooms based on:
        1. Current room has fire (heat > 0.5)
        2. Adjacent room is not already on fire
        3. Corridor is not blocked
        
        Heat dissipation: each non-fire room loses heat over time.
        Corridors block if either adjacent room's heat > 0.7.
        """
        new_fires: Set[str] = set()
        new_heat: Dict[str, float] = {}

        # Calculate heat changes
        for room_id, current_heat in self.heat_map.items():
            if room_id in self.fire_rooms:
                # Fire room: spread to adjacent
                new_heat[room_id] = 1.0

                # Try to spread to adjacent rooms
                for adjacent_room in self.graph.get_adjacent_safe_rooms(room_id):
                    if adjacent_room not in self.fire_rooms:
                        # Spread fire with probability based on heat
                        new_heat_value = min(1.0, current_heat * 0.8)
                        if new_heat_value > 0.5:
                            new_fires.add(adjacent_room)
                            new_heat[adjacent_room] = new_heat_value
            else:
                # Non-fire room: dissipate heat
                if current_heat > 0.0:
                    new_heat[room_id] = max(0.0, current_heat - 0.05)
                else:
                    new_heat[room_id] = 0.0

        # Update fire rooms
        self.fire_rooms.update(new_fires)
        self.heat_map = new_heat

        # Update graph states and block/unblock corridors based on heat
        for room_id, heat in self.heat_map.items():
            if heat > 0.7:
                state = "blocked"
            elif heat > 0.3:
                state = "hot"
            else:
                state = "safe"

            self.graph.set_room_state(room_id, state, heat)

            # Block corridors connected to high-heat rooms
            if heat > 0.7:
                for adjacent in self.graph.get_adjacent_rooms(room_id):
                    self.graph.block_corridor(room_id, adjacent)
            # Unblock corridors when heat dissipates
            elif heat <= 0.7:
                for adjacent in self.graph.get_adjacent_rooms(room_id):
                    self.graph.unblock_corridor(room_id, adjacent)

    def get_heat_map(self) -> Dict[str, float]:
        """Get current heat levels in all rooms."""
        return self.heat_map.copy()

    def get_fire_rooms(self) -> Set[str]:
        """Get rooms currently on fire."""
        return self.fire_rooms.copy()

    def is_room_safe(self, room_id: str) -> bool:
        """Check if a room is still passable (not blocked by fire)."""
        return self.heat_map.get(room_id, 0.0) <= 0.7

    def reset(self) -> None:
        """Reset fire simulation."""
        self.fire_rooms.clear()
        for room_id in self.heat_map:
            self.heat_map[room_id] = 0.0
