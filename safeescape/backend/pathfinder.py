"""
Pathfinder: Implements A* algorithm for finding evacuation routes.
Dynamically recalculates paths avoiding blocked/hot rooms.
"""

import heapq
from typing import List, Optional, Dict, Tuple
from graph_engine import GraphEngine


class Pathfinder:
    """Finds optimal evacuation paths using A* algorithm."""

    def __init__(self, graph_engine: GraphEngine):
        """
        Initialize the pathfinder.
        
        Args:
            graph_engine: The GraphEngine managing the building
        """
        self.graph = graph_engine

    def heuristic(self, room_id: str, exit_room_id: str) -> float:
        """
        Calculate heuristic distance between two rooms.
        Uses Euclidean distance between room centers.
        
        Args:
            room_id: Current room
            exit_room_id: Target exit room
            
        Returns:
            Heuristic cost
        """
        room1 = self.graph.get_room_state(room_id)
        room2 = self.graph.get_room_state(exit_room_id)

        if not room1 or not room2:
            return float("inf")

        x1 = room1["x"] + room1["width"] / 2
        y1 = room1["y"] + room1["height"] / 2
        x2 = room2["x"] + room2["width"] / 2
        y2 = room2["y"] + room2["height"] / 2

        return ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5

    def is_passable(self, room_id: str) -> bool:
        """
        Check if a room can be traversed.
        A room is impassable if it's blocked (heat > 0.7).
        
        Args:
            room_id: The room to check
            
        Returns:
            True if passable, False otherwise
        """
        room_state = self.graph.get_room_state(room_id)
        if not room_state:
            return False
        return room_state["state"] != "blocked"

    def find_path(self, start_room: str, exit_room: str) -> Optional[List[str]]:
        """
        Find the shortest safe path from start to exit using A*.
        Avoids blocked rooms but can traverse hot rooms.
        
        Args:
            start_room: Starting room ID
            exit_room: Target exit room ID
            
        Returns:
            List of room IDs forming the path, or None if no path exists
        """
        if not self.is_passable(exit_room):
            return None

        open_set = [(0, start_room)]
        came_from: Dict[str, str] = {}
        g_score: Dict[str, float] = {start_room: 0}
        f_score: Dict[str, float] = {start_room: self.heuristic(start_room, exit_room)}
        closed_set = set()

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == exit_room:
                # Reconstruct path
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                return path[::-1]

            if current in closed_set:
                continue

            closed_set.add(current)

            # Check adjacent rooms
            for neighbor in self.graph.get_adjacent_rooms(current):
                if not self.is_passable(neighbor) or neighbor in closed_set:
                    continue

                tentative_g = g_score[current] + 1.0
                if neighbor not in g_score or tentative_g < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    f_score[neighbor] = tentative_g + self.heuristic(neighbor, exit_room)

                    # Add to open set if not already there
                    if neighbor not in [item[1] for item in open_set]:
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return None  # No path found

    def find_nearest_exit(self, current_room: str) -> Optional[str]:
        """
        Find the nearest reachable exit from the current room.
        
        Args:
            current_room: Current room ID
            
        Returns:
            Exit room ID, or None if no exit is reachable
        """
        all_rooms = self.graph.get_all_rooms()
        exits = [room_id for room_id, room_data in all_rooms.items() if room_data["is_exit"]]

        best_exit = None
        best_distance = float("inf")

        for exit_room in exits:
            path = self.find_path(current_room, exit_room)
            if path and len(path) < best_distance:
                best_exit = exit_room
                best_distance = len(path)

        return best_exit

    def recalculate_path(self, start_room: str, current_path: List[str]) -> Optional[List[str]]:
        """
        Recalculate path if the current one is blocked.
        Used during simulation when fire spreads and blocks corridors.
        
        Args:
            start_room: Current starting room
            current_path: The path that may be blocked
            
        Returns:
            New path, or None if no escape is possible
        """
        if not current_path or len(current_path) < 2:
            exit_room = self.find_nearest_exit(start_room)
            if exit_room:
                return self.find_path(start_room, exit_room)
            return None

        target_exit = current_path[-1]
        new_path = self.find_path(start_room, target_exit)

        if new_path:
            return new_path

        # Try to find any exit
        new_exit = self.find_nearest_exit(start_room)
        if new_exit:
            return self.find_path(start_room, new_exit)

        return None
