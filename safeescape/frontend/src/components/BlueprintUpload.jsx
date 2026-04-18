import React, { useState } from 'react'
import './BlueprintUpload.css'

/**
 * BlueprintUpload: Upload building blueprint image
 * Sends to backend for image analysis and room detection
 */
function BlueprintUpload({ onLayoutGenerated }) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result)
    reader.readAsDataURL(file)

    // Upload to backend
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/upload-blueprint', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      const result = await response.json()
      onLayoutGenerated(result)
    } catch (error) {
      alert(`Error uploading blueprint: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="blueprint-upload">
      <div className="upload-area">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={loading}
          id="blueprint-input"
        />
        <label htmlFor="blueprint-input" className="upload-label">
          <span>📷 Click to upload blueprint image</span>
          <span className="subtitle">PNG, JPG, or any image format</span>
        </label>
      </div>

      {preview && (
        <div className="preview">
          <p className="label">Preview:</p>
          <img src={preview} alt="Preview" />
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Processing blueprint...</p>
        </div>
      )}
    </div>
  )
}

export default BlueprintUpload
