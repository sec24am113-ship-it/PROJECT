import EvacuationSimulator from './components/EvacuationSimulator'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  return (
    <ErrorBoundary>
      <EvacuationSimulator />
    </ErrorBoundary>
  )
}

export default App
