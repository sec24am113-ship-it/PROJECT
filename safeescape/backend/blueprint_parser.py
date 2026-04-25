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
from collections import deque


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

    @staticmethod
    def _detect_optimal_grid_size(gray_img: np.ndarray, wall_threshold: int = 160, min_cells: int = 30, max_cells: int = 200) -> tuple[int, int]:
        """
        Determine optimal grid size based on blueprint feature sizes using a more stable approach.
        
        Uses multiple thresholds and averages the results to reduce sensitivity to threshold changes.
        
        Args:
            gray_img: Grayscale image (original resolution)
            wall_threshold: Grayscale threshold for wall detection
            min_cells: Minimum grid dimension
            max_cells: Maximum grid dimension
            
        Returns:
            Tuple of (rows, cols) for optimal grid size
        """
        h, w = gray_img.shape
        print(f"[Auto-detect] Image size: {h}x{w}")
        
        # Test multiple thresholds and average the results for stability
        test_thresholds = [wall_threshold - 20, wall_threshold, wall_threshold + 20]
        all_rows = []
        all_cols = []
        
        for threshold in test_thresholds:
            threshold = max(50, min(240, threshold))  # keep in reasonable range
            
            # Binary: walls are bright (>= threshold)
            _, binary = cv2.threshold(gray_img, threshold, 255, cv2.THRESH_BINARY)
            
            # Use morphological operations to find significant features
            kernel = np.ones((3, 3), np.uint8)
            binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            # Count wall pixels
            wall_pixels = np.sum(binary > 0)
            total_pixels = h * w
            wall_density = wall_pixels / total_pixels
            
            # Calculate grid size based on wall density
            # Higher wall density = more detail needed = larger grid
            # Lower wall density = simpler layout = smaller grid
            target_density = 0.15  # target wall density per cell
            
            # Calculate cell size based on wall density
            if wall_density > 0:
                # More walls = smaller cells (higher resolution)
                cell_size = int(30 * (0.15 / max(wall_density, 0.01)))
                cell_size = max(5, min(50, cell_size))
            else:
                cell_size = 20
            
            rows = int(h / cell_size)
            cols = int(w / cell_size)
            
            all_rows.append(rows)
            all_cols.append(cols)
        
        # Average the results for stability
        rows = int(np.mean(all_rows))
        cols = int(np.mean(all_cols))
        
        print(f"[Auto-detect] Before clamp: rows={rows}, cols={cols}")
        
        # Clamp to reasonable limits
        rows = max(min_cells, min(max_cells, rows))
        cols = max(min_cells, min(max_cells, cols))
        
        print(f"[Auto-detect] Final: rows={rows}, cols={cols}")
        
        return rows, cols

    @staticmethod
    def parse_image_to_grid(
        image_bytes: bytes,
        grid_rows: int = 30,
        grid_cols: int = 30,
        wall_threshold: int = 160,
    ) -> Dict[str, Any]:
        """
        Convert a blueprint image to a 2-D cell grid at the requested resolution.
        The frontend will resize its GRID_SIZE to match rows/cols in the response.

        If grid_rows and grid_cols are both 0, the grid size will be auto-detected
        based on the image's feature sizes.

        Algorithm:
          1. Resize image to grid_cols x grid_rows (1 pixel = 1 cell).
          2. Dark pixel  -> "wall"  (grayscale < wall_threshold).
          3. Green pixel -> "exit"  (HSV hue 35-85).
          4. BFS flood-fill from every edge cell through open pixels -> "empty" (outside).
          5. Remaining open cells are enclosed -> "room".
        """
        print(f"[DEBUG] parse_image_to_grid ENTRY - grid_rows={grid_rows}, grid_cols={grid_cols}")
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image.")

            print(f"[DEBUG] parse_image_to_grid called with grid_rows={grid_rows}, grid_cols={grid_cols}")

            # Auto-detect grid size if both dimensions are 0
            if grid_rows == 0 and grid_cols == 0:
                print(f"[DEBUG] Auto-detection triggered")
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                grid_rows, grid_cols = BlueprintParser._detect_optimal_grid_size(gray, wall_threshold)
                print(f"[DEBUG] Auto-detection returned: {grid_rows}x{grid_cols}")

            target = (grid_cols, grid_rows)  # cv2: (width, height)

            # Green-exit mask
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            green_mask = cv2.inRange(hsv, np.array([35, 50, 50]), np.array([85, 255, 255]))
            green_small = cv2.resize(green_mask, target, interpolation=cv2.INTER_NEAREST)

            # Grayscale + resize
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray_small = cv2.resize(gray, target, interpolation=cv2.INTER_AREA)

            # Initial labelling: wall / exit / None (open)
            ROWS, COLS = grid_rows, grid_cols
            raw: List[List] = []
            for r in range(ROWS):
                row = []
                for c in range(COLS):
                    if int(green_small[r, c]) > 0:
                        row.append("exit")
                    elif int(gray_small[r, c]) >= wall_threshold:  # bright = wall
                        row.append("wall")
                    else:
                        row.append(None)                            # dark = open (room candidate)
                raw.append(row)

            # BFS from every dark edge cell -> "empty" (outside the building)
            queue = deque()
            for r in range(ROWS):
                for c in range(COLS):
                    if raw[r][c] is None and (r == 0 or r == ROWS - 1 or c == 0 or c == COLS - 1):
                        raw[r][c] = "empty"
                        queue.append((r, c))

            dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)]
            while queue:
                r, c = queue.popleft()
                for dr, dc in dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < ROWS and 0 <= nc < COLS and raw[nr][nc] is None:
                        raw[nr][nc] = "empty"
                        queue.append((nr, nc))

            # Dark cells not reached by BFS = enclosed inside walls -> "room"
            grid = [
                ["room" if (cell is None or cell == "empty") else cell for cell in row]
                for row in raw
            ]

            room_count = sum(cell == "room" for row in grid for cell in row)
            exit_count = sum(cell == "exit" for row in grid for cell in row)

            return {
                "grid":       grid,
                "rows":       ROWS,
                "cols":       COLS,
                "room_count": room_count,
                "exit_count": exit_count,
            }

        except Exception as exc:
            print(f"[BlueprintParser] parse_image_to_grid error: {exc}")
            return {"grid": [], "rows": grid_rows, "cols": grid_cols,
                    "room_count": 0, "exit_count": 0, "error": str(exc)}
