import { useState, useCallback } from 'react'

/**
 * useSimulation: Hook for managing WebSocket connection and simulation state
 * Handles real-time frame updates, simulation lifecycle, and AI advisor reports
 */
function useSimulation() {
  const [frameData, setFrameData] = useState(null)
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [simulationComplete, setSimulationComplete] = useState(false)
  const [advisorReport, setAdvisorReport] = useState(null)
  const [ws, setWs] = useState(null)

  /**
   * Start a new simulation with given configuration
   */
  const startSimulation = useCallback(async (buildingLayout, config) => {
    try {
      // First, parse the building layout to create the graph
      const parseResponse = await fetch(
        'http://localhost:8000/parse-grid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid_data: buildingLayout,
          }),
        }
      )

      if (!parseResponse.ok) {
        throw new Error('Failed to parse building layout')
      }

      const parseData = await parseResponse.json()
      console.log('Building layout parsed:', parseData)

      // Setup simulation on backend
      const setupResponse = await fetch(
        'http://localhost:8000/setup-simulation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_count: config.agentCount,
            start_room: config.startRoom,
            fire_origin: config.fireOrigin,
          }),
        }
      )

      if (!setupResponse.ok) {
        throw new Error('Failed to setup simulation')
      }

      // Connect WebSocket
      const wsUrl = `ws://localhost:8000/ws/simulate`
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        console.log('WebSocket connected')
        setSimulationRunning(true)
        setSimulationComplete(false)
        setFrameData(null)
        setAdvisorReport(null)
      }

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'frame') {
          setFrameData(message.data)
        } else if (message.type === 'complete') {
          setSimulationRunning(false)
          setSimulationComplete(true)
          setFrameData(message.data.final_frame || message.data)
          setAdvisorReport(message.report)
          console.log('Simulation complete:', message.summary)
        } else if (message.type === 'error') {
          console.error('Simulation error:', message.message)
          setSimulationRunning(false)
        }
      }

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
        setSimulationRunning(false)
      }

      websocket.onclose = () => {
        console.log('WebSocket closed')
        setSimulationRunning(false)
        setWs(null)
      }

      setWs(websocket)
    } catch (error) {
      console.error('Failed to start simulation:', error)
      alert(`Error: ${error.message}`)
      setSimulationRunning(false)
    }
  }, [])

  /**
   * Stop the current simulation
   */
  const stopSimulation = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({ action: 'stop' }))
      ws.close()
      setWs(null)
    }
    setSimulationRunning(false)
  }, [ws])

  /**
   * Pause simulation
   */
  const pauseSimulation = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({ action: 'pause' }))
    }
  }, [ws])

  /**
   * Resume simulation
   */
  const resumeSimulation = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({ action: 'resume' }))
    }
  }, [ws])

  return {
    frameData,
    simulationRunning,
    simulationComplete,
    advisorReport,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
  }
}

export default useSimulation
