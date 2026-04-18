import React, { useEffect, useRef } from 'react'
import './SimulationView.css'

/**
 * SimulationView: Real-time canvas rendering of evacuation simulation
 * Renders rooms with heat-based colors, agents, fire spread, and evacuation paths
 */
function SimulationView({ frameData, isRunning }) {
  const canvasRef = useRef(null)

  /**
   * Get color based on room heat level
   * Green (safe) -> Yellow (warm) -> Orange -> Red (fire/blocked)
   */
  const getHeatColor = (heat) => {
    if (heat < 0.2) return '#10b981' // Green - safe
    if (heat < 0.4) return '#eab308' // Yellow - warm
    if (heat < 0.6) return '#f59e0b' // Orange - hot
    if (heat < 0.8) return '#f97316' // Dark orange - very hot
    return '#ef4444' // Red - fire/blocked
  }

  /**
   * Draw the simulation on canvas
   */
  const drawSimulation = () => {
    const canvas = canvasRef.current
    if (!canvas || !frameData) return

    const ctx = canvas.getContext('2d')
    // Reset transform before clearing
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Scale context to improve rendering quality
    // Note: canvas resolution is set in JSX (800x600), scale factor adjusts drawing
    const scale = 1
    ctx.scale(scale, scale)

    // Draw rooms
    if (frameData.rooms) {
      Object.values(frameData.rooms).forEach((room) => {
        // Draw room background based on heat
        ctx.fillStyle = getHeatColor(room.heat)
        ctx.fillRect(room.x, room.y, room.width, room.height)

        // Draw room border
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 1
        ctx.strokeRect(room.x, room.y, room.width, room.height)

        // Label for exit rooms
        if (room.is_exit) {
          ctx.fillStyle = 'white'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('EXIT', room.x + room.width / 2, room.y + room.height / 2 + 3)
        }

        // Heat percentage label
        ctx.fillStyle = room.heat > 0.5 ? 'white' : '#374151'
        ctx.font = '8px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(
          `${(room.heat * 100).toFixed(0)}%`,
          room.x + room.width - 4,
          room.y + 10
        )
      })
    }

    // Draw evacuation paths
    if (frameData.agents) {
      frameData.agents.forEach((agent) => {
        if (agent.path && agent.path.length > 1) {
          ctx.strokeStyle = '#a3e635'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 2])
          ctx.beginPath()

          // Get room positions for path drawing
          let lastX = agent.x
          let lastY = agent.y

          agent.path.slice(1).forEach((roomId) => {
            if (frameData.rooms[roomId]) {
              const room = frameData.rooms[roomId]
              const nextX = room.x + room.width / 2
              const nextY = room.y + room.height / 2
              ctx.lineTo(nextX, nextY)
              lastX = nextX
              lastY = nextY
            }
          })

          ctx.stroke()
          ctx.setLineDash([])
        }
      })
    }

    // Draw agents
    if (frameData.agents) {
      frameData.agents.forEach((agent) => {
        const radius = agent.evacuated ? 5 : 4
        ctx.fillStyle = agent.stuck ? '#fca5a5' : agent.evacuated ? '#d1d5db' : '#3b82f6'
        ctx.beginPath()
        ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2)
        ctx.fill()

        // Draw agent outline
        ctx.strokeStyle = '#1f2937'
        ctx.lineWidth = 1
        ctx.stroke()

        // Show agent ID on hover/always for debugging
        if (false) {
          ctx.fillStyle = '#374151'
          ctx.font = '6px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(agent.id, agent.x, agent.y - 8)
        }
      })
    }

    ctx.resetTransform()
  }

  useEffect(() => {
    if (frameData) {
      console.log('Rendering frame:', frameData)
    }
    drawSimulation()
  }, [frameData])

  /**
   * Export simulation frames as PNG images
   */
  const handleExportFrames = () => {
    if (!frameData) return

    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `frame_${frameData.tick}.png`
    link.click()

    alert('Frame exported! Repeat to download each frame.')
  }

  return (
    <div className="simulation-view">
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="simulation-canvas"
        />
        <div className="canvas-overlay">
          {isRunning && <div className="running-indicator">● LIVE</div>}
        </div>
      </div>

      <div className="simulation-controls">
        <button className="export-btn" onClick={handleExportFrames}>
          📥 Export Frame
        </button>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="color-box" style={{ backgroundColor: '#10b981' }}></div>
          <span>Safe</span>
        </div>
        <div className="legend-item">
          <div className="color-box" style={{ backgroundColor: '#eab308' }}></div>
          <span>Warm</span>
        </div>
        <div className="legend-item">
          <div className="color-box" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>Hot</span>
        </div>
        <div className="legend-item">
          <div className="color-box" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Fire</span>
        </div>
        <div className="legend-item">
          <div className="color-box" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>Agent</span>
        </div>
      </div>
    </div>
  )
}

export default SimulationView
