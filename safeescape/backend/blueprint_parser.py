"""
Blueprint Parser: Converts images, text descriptions, or grid data into room graphs.
Supports image analysis with OpenCV, natural language parsing, and grid input.
"""

import json
import re
from typing import Dict, List, Any, Optional
import cv2
import numpy as np
from PIL import Image
import io


class BlueprintParser:
    """Parses building blueprints into structured room graphs."""

    @staticmethod
    def parse_image(image_bytes: bytes) -> Dict[str, Any]:
        """
        Parse a blueprint image to detect rooms, walls, and exits.
        Uses OpenCV contour detection to identify rooms.
        
        Args:
            image_bytes: Image file bytes
            
        Returns:
            Room graph JSON structure
        """
        try:
            # Load image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                raise ValueError("Invalid image")

            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Apply threshold
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)

            # Find contours
            contours, _ = cv2.findContours(
                binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )

            rooms = {}
            room_count = 0

            # Process each contour as a potential room
            for contour in contours:
                area = cv2.contourArea(contour)

                # Filter by area (ignore very small/large contours)
                if area < 500 or area > 50000:
                    continue

                x, y, w, h = cv2.boundingRect(contour)

                # Skip thin lines (walls)
                if w < 20 or h < 20:
                    continue

                room_id = f"room_{room_count}"
                rooms[room_id] = {
                    "id": room_id,
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "is_exit": False,
                }
                room_count += 1

            # Generate corridors between adjacent rooms
            corridors = []
            room_ids = list(rooms.keys())

            for i, room1_id in enumerate(room_ids):
                for room2_id in room_ids[i + 1 :]:
                    room1 = rooms[room1_id]
                    room2 = rooms[room2_id]

                    # Check if rooms are adjacent
                    if BlueprintParser._rooms_adjacent(room1, room2):
                        corridors.append(
                            {"from": room1_id, "to": room2_id, "blocked": False}
                        )

            # Mark first and last room as exits
            if room_ids:
                rooms[room_ids[0]]["is_exit"] = True
                if len(room_ids) > 1:
                    rooms[room_ids[-1]]["is_exit"] = True

            return {"rooms": rooms, "corridors": corridors}

        except Exception as e:
            print(f"Error parsing image: {e}")
            return {"rooms": {}, "corridors": []}

    @staticmethod
    def _rooms_adjacent(room1: Dict, room2: Dict, threshold: int = 50) -> bool:
        """
        Check if two rooms are adjacent (within threshold distance).
        
        Args:
            room1, room2: Room dictionaries with x, y, width, height
            threshold: Maximum distance to consider adjacent
            
        Returns:
            True if rooms are adjacent
        """
        # Check horizontal adjacency
        if (
            abs(room1["x"] + room1["width"] - room2["x"]) < threshold
            or abs(room2["x"] + room2["width"] - room1["x"]) < threshold
        ):
            # Check if y ranges overlap
            if not (room1["y"] + room1["height"] < room2["y"] or room2["y"] + room2["height"] < room1["y"]):
                return True

        # Check vertical adjacency
        if (
            abs(room1["y"] + room1["height"] - room2["y"]) < threshold
            or abs(room2["y"] + room2["height"] - room1["y"]) < threshold
        ):
            # Check if x ranges overlap
            if not (room1["x"] + room1["width"] < room2["x"] or room2["x"] + room2["width"] < room1["x"]):
                return True

        return False

    @staticmethod
    def parse_natural_language(description: str) -> Dict[str, Any]:
        """
        Parse a natural language description to generate a building layout.
        Example: "3 floors 8 rooms each 2 exits per floor"
        
        Args:
            description: Natural language building description
            
        Returns:
            Room graph JSON structure
        """
        # Extract numbers
        numbers = re.findall(r"\d+", description.lower())

        # Default values
        floors = 1
        rooms_per_floor = 4
        exits_per_floor = 1

        # Try to parse (simple heuristic)
        if len(numbers) >= 1:
            floors = int(numbers[0])
        if len(numbers) >= 2:
            rooms_per_floor = int(numbers[1])
        if len(numbers) >= 3:
            exits_per_floor = int(numbers[2])

        rooms = {}
        corridors = []
        room_count = 0

        # Generate grid layout
        room_width = 100
        room_height = 100
        spacing = 10

        for floor in range(floors):
            floor_start = room_count
            for room_idx in range(rooms_per_floor):
                room_id = f"room_{room_count}"
                x = room_idx * (room_width + spacing)
                y = floor * (room_height + spacing)

                rooms[room_id] = {
                    "id": room_id,
                    "x": x,
                    "y": y,
                    "width": room_width,
                    "height": room_height,
                    "is_exit": False,
                }

                # Connect to previous room
                if room_idx > 0:
                    prev_room_id = f"room_{room_count - 1}"
                    corridors.append(
                        {"from": prev_room_id, "to": room_id, "blocked": False}
                    )

                room_count += 1

            # Mark exits
            for i in range(exits_per_floor):
                exit_idx = floor_start + (i * (rooms_per_floor // exits_per_floor))
                if exit_idx < room_count:
                    rooms[f"room_{exit_idx}"]["is_exit"] = True

        return {"rooms": rooms, "corridors": corridors}

    @staticmethod
    def parse_grid(grid_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse grid data from manual grid editor.
        Grid contains cells marked as room, wall, exit, fire_origin.
        
        Args:
            grid_data: {"grid": 20x20 array, "cell_type": type mapping}
            
        Returns:
            Room graph JSON structure
        """
        grid = grid_data.get("grid", [])
        rooms = {}
        corridors = []
        room_count = 0

        # Identify room regions using flood fill
        visited = set()
        room_regions = []

        def flood_fill(start_row: int, start_col: int) -> List[tuple]:
            """Find all cells belonging to the same room."""
            region = []
            stack = [(start_row, start_col)]

            while stack:
                row, col = stack.pop()

                if (row, col) in visited or row < 0 or row >= len(grid) or col < 0 or col >= len(grid[0]):
                    continue

                # Include both "room" and "exit" cells in the region
                if grid[row][col] not in ("room", "exit"):
                    continue

                visited.add((row, col))
                region.append((row, col))

                # Add neighbors
                stack.extend([(row + 1, col), (row - 1, col), (row, col + 1), (row, col - 1)])

            return region

        # Find all room regions
        for row in range(len(grid)):
            for col in range(len(grid[0])):
                if grid[row][col] == "room" and (row, col) not in visited:
                    region = flood_fill(row, col)
                    if region:
                        room_regions.append(region)

        # Convert regions to rooms
        for region in room_regions:
            min_row = min(r for r, c in region)
            max_row = max(r for r, c in region)
            min_col = min(c for r, c in region)
            max_col = max(c for r, c in region)

            room_id = f"room_{room_count}"
            rooms[room_id] = {
                "id": room_id,
                "x": min_col * 20,
                "y": min_row * 20,
                "width": (max_col - min_col + 1) * 20,
                "height": (max_row - min_row + 1) * 20,
                "is_exit": any(
                    grid[r][c] == "exit" for r, c in region
                ),
            }
            room_count += 1

        # Connect adjacent rooms
        room_list = list(rooms.keys())
        for i, room1_id in enumerate(room_list):
            for room2_id in room_list[i + 1 :]:
                room1 = rooms[room1_id]
                room2 = rooms[room2_id]

                if BlueprintParser._rooms_adjacent(room1, room2, threshold=25):
                    corridors.append(
                        {"from": room1_id, "to": room2_id, "blocked": False}
                    )

        return {"rooms": rooms, "corridors": corridors}
