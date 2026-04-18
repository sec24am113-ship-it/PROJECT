import React, { useState } from 'react'
import { parseNaturalLanguage } from '../utils/buildingParser'
import './NaturalLanguageInput.css'

/**
 * NaturalLanguageInput: Parse text descriptions into building layouts
 * Example: "3 floors 8 rooms each 2 exits per floor"
 */
function NaturalLanguageInput({ onLayoutGenerated }) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleParse = async () => {
    if (!description.trim()) {
      alert('Please enter a building description')
      return
    }

    setLoading(true)

    try {
      const layout = parseNaturalLanguage(description)
      onLayoutGenerated(layout)
    } catch (error) {
      alert(`Error parsing description: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExampleClick = (example) => {
    setDescription(example)
  }

  return (
    <div className="nl-input">
      <label htmlFor="description">Building Description</label>
      <textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Example: 3 floors, 8 rooms each floor, 2 exits per floor"
        rows="4"
      />

      <button
        className="btn-parse"
        onClick={handleParse}
        disabled={loading}
      >
        {loading ? 'Parsing...' : '✓ Generate Layout'}
      </button>

      <div className="examples">
        <p className="label">Quick examples:</p>
        <div className="example-buttons">
          <button
            className="example-btn"
            onClick={() => handleExampleClick('2 floors, 6 rooms each floor, 2 exits per floor')}
          >
            Small
          </button>
          <button
            className="example-btn"
            onClick={() => handleExampleClick('3 floors, 8 rooms each floor, 3 exits per floor')}
          >
            Medium
          </button>
          <button
            className="example-btn"
            onClick={() => handleExampleClick('5 floors, 12 rooms each floor, 4 exits per floor')}
          >
            Large
          </button>
        </div>
      </div>
    </div>
  )
}

export default NaturalLanguageInput
