import React, { useState } from 'react'
import './GridEditor.css'

/**
 * GridEditor: Minecraft-style grid canvas editor
 * 20x20 grid where users can place rooms, walls, exits, and fire origin
 * Provides visual building layout design
 */
function GridEditor({ onLayoutGenerated }) {
  const GRID_SIZE = 20
  const CELL_SIZE = 30
  const CELL_TYPES = {
    empty: 'empty',
    room: 'room',
    wall: 'wall',
    exit: 'exit',
    fire: 'fire',
  }

  const [grid, setGrid] = useState(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(CELL_TYPES.empty))
  )
  const [selectedTool, setSelectedTool] = useState(CELL_TYPES.room)

  /**
   * Handle cell click to draw
   */
  const handleCellClick = (row, col) => {
    const newGrid = grid.map((r) => [...r])
    newGrid[row][col] = selectedTool
    setGrid(newGrid)
  }

  /**
   * Convert grid to room layout JSON
   */
  const convertGridToLayout = () => {
    const rooms = {}
    const visited = new Set()
    let roomCount = 0

    // Find all room regions using flood fill
    const floodFill = (startRow, startCol) => {
      const region = []
      const stack = [[startRow, startCol]]

      while (stack.length > 0) {
        const [row, col] = stack.pop()

        if (
          row < 0 ||
          row >= GRID_SIZE ||
          col < 0 ||
          col >= GRID_SIZE ||
          visited.has(`${row},${col}`) ||
          grid[row][col] !== CELL_TYPES.room
        ) {
          continue
        }

        visited.add(`${row},${col}`)
        region.push([row, col])

        // Add neighbors
        stack.push([row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1])
      }

      return region
    }

    // Find all room regions
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col] === CELL_TYPES.room && !visited.has(`${row},${col}`)) {
          const region = floodFill(row, col)
          if (region.length > 0) {
            const minRow = Math.min(...region.map((r) => r[0]))
            const maxRow = Math.max(...region.map((r) => r[0]))
            const minCol = Math.min(...region.map((r) => r[1]))
            const maxCol = Math.max(...region.map((r) => r[1]))

            const roomId = `room_${roomCount}`
            rooms[roomId] = {
              id: roomId,
              x: minCol * CELL_SIZE,
              y: minRow * CELL_SIZE,
              width: (maxCol - minCol + 1) * CELL_SIZE,
              height: (maxRow - minRow + 1) * CELL_SIZE,
              is_exit: region.some((r) => grid[r[0]][r[1]] === CELL_TYPES.exit),
            }
            roomCount++
          }
        }
      }
    }

    // Generate corridors between adjacent rooms
    const corridors = []
    const roomIds = Object.keys(rooms)

    for (let i = 0; i < roomIds.length; i++) {
      for (let j = i + 1; j < roomIds.length; j++) {
        const room1 = rooms[roomIds[i]]
        const room2 = rooms[roomIds[j]]

        // Simple adjacency check
        const touching =
          (Math.abs(
            room1.x + room1.width - room2.x ||
              Math.abs(room2.x + room2.width - room1.x)
          ) < CELL_SIZE * 2 &&
            !(room1.y + room1.height < room2.y || room2.y + room2.height < room1.y)) ||
          (Math.abs(
            room1.y + room1.height - room2.y ||
              Math.abs(room2.y + room2.height - room1.y)
          ) < CELL_SIZE * 2 &&
            !(room1.x + room1.width < room2.x || room2.x + room2.width < room1.x))

        if (touching) {
          corridors.push({
            from: roomIds[i],
            to: roomIds[j],
            blocked: false,
          })
        }
      }
    }

    return {
      rooms: Object.fromEntries(Object.entries(rooms)),
      corridors,
    }
  }

  const handleGenerateLayout = () => {
    const layout = convertGridToLayout()
    if (Object.keys(layout.rooms).length === 0) {
      alert('Please draw at least one room')
      return
    }
    onLayoutGenerated(layout)
  }

  const handleClear = () => {
    setGrid(Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(CELL_TYPES.empty)))
  }

  return (
    <div className="grid-editor">
      <div className="toolbar">
        {Object.values(CELL_TYPES).map((type) => (
          <button
            key={type}
            className={`tool-btn ${selectedTool === type ? 'active' : ''}`}
            onClick={() => setSelectedTool(type)}
            title={`Select ${type}`}
          >
            <span className={`tool-icon tool-${type}`}></span>
          </button>
        ))}
        <button className="tool-btn clear-btn" onClick={handleClear}>
          🗑️
        </button>
      </div>

      <div className="canvas-wrapper">
        <div
          className="grid-canvas"
          style={{
            width: GRID_SIZE * CELL_SIZE,
            height: GRID_SIZE * CELL_SIZE,
          }}
        >
          {grid.map((row, rowIdx) =>
            row.map((cellType, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`grid-cell cell-${cellType}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                }}
                onClick={() => handleCellClick(rowIdx, colIdx)}
              />
            ))
          )}
        </div>
      </div>

      <button className="btn-generate" onClick={handleGenerateLayout}>
        ✓ Generate Layout
      </button>
    </div>
  )
}

export default GridEditor
