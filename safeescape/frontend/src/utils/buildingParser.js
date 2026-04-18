/**
 * buildingParser: Client-side utilities for parsing building descriptions
 * Converts natural language to structured room layouts
 */

/**
 * Parse a natural language building description
 * Examples:
 *   "3 floors, 8 rooms each, 2 exits per floor"
 *   "4 floors 10 rooms 3 exits"
 *   "5 story building, 6 rooms per floor, 1 stairwell per floor"
 *
 * @param {string} description - Natural language building description
 * @returns {Object} Building layout with rooms and corridors
 */
export function parseNaturalLanguage(description) {
  // Extract numbers from description
  const numbers = description.match(/\d+/g) || []
  const numCount = numbers.length

  // Parse parameters (simple heuristic)
  let floors = 1
  let roomsPerFloor = 4
  let exitsPerFloor = 1

  if (numCount >= 1) floors = parseInt(numbers[0])
  if (numCount >= 2) roomsPerFloor = parseInt(numbers[1])
  if (numCount >= 3) exitsPerFloor = parseInt(numbers[2])

  // Validate
  floors = Math.max(1, Math.min(floors, 20))
  roomsPerFloor = Math.max(1, Math.min(roomsPerFloor, 50))
  exitsPerFloor = Math.max(1, Math.min(exitsPerFloor, roomsPerFloor))

  return generateGridLayout(floors, roomsPerFloor, exitsPerFloor)
}

/**
 * Generate a structured grid layout
 *
 * @param {number} floors - Number of floors
 * @param {number} roomsPerFloor - Rooms per floor
 * @param {number} exitsPerFloor - Exits per floor
 * @returns {Object} Building layout
 */
function generateGridLayout(floors, roomsPerFloor, exitsPerFloor) {
  const rooms = {}
  const corridors = []
  const roomWidth = 100
  const roomHeight = 100
  const spacing = 10
  let roomCount = 0

  // Generate rooms in a grid
  for (let floor = 0; floor < floors; floor++) {
    const floorStart = roomCount

    for (let room = 0; room < roomsPerFloor; room++) {
      const roomId = `room_${roomCount}`
      const x = room * (roomWidth + spacing)
      const y = floor * (roomHeight + spacing * 2 + 50) // Extra space between floors

      rooms[roomId] = {
        id: roomId,
        x,
        y,
        width: roomWidth,
        height: roomHeight,
        is_exit: false,
      }

      // Connect to previous room on same floor
      if (room > 0) {
        const prevRoomId = `room_${roomCount - 1}`
        corridors.push({
          from: prevRoomId,
          to: roomId,
          blocked: false,
        })
      }

      roomCount++
    }

    // Mark exits for this floor
    for (let i = 0; i < exitsPerFloor; i++) {
      const exitIdx =
        floorStart + Math.floor((i * roomsPerFloor) / exitsPerFloor)
      if (exitIdx < roomCount) {
        rooms[`room_${exitIdx}`].is_exit = true
      }
    }

    // Connect floors (vertical corridors)
    if (floor < floors - 1) {
      const currentFloorRoom = floorStart + Math.floor(roomsPerFloor / 2)
      const nextFloorRoom = floorStart + roomsPerFloor
      corridors.push({
        from: `room_${currentFloorRoom}`,
        to: `room_${nextFloorRoom}`,
        blocked: false,
      })
    }
  }

  return { rooms, corridors }
}

/**
 * Estimate evacuation time for a layout
 * Simple heuristic: (number of rooms) * (average path length)
 *
 * @param {Object} layout - Building layout
 * @returns {number} Estimated evacuation time in ticks
 */
export function estimateEvacuationTime(layout) {
  const roomCount = Object.keys(layout.rooms).length
  return roomCount * 5 // Rough estimate
}
