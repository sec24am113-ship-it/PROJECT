import React from 'react'
import './AdvisorReport.css'

/**
 * AdvisorReport: Displays post-simulation AI-generated evacuation report
 * Contains analysis, bottleneck identification, and design recommendations
 */
function AdvisorReport({ report, frameData }) {
  if (!report) return null

  return (
    <div className="advisor-report">
      <div className="report-header">
        <h3>🤖 AI Advisor Report</h3>
        <p className="subtitle">
          Post-simulation analysis and evacuation recommendations
        </p>
      </div>

      <div className="report-content">
        <div className="report-text">
          {report.split('\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {frameData && frameData.stats && (
          <div className="summary-stats">
            <h4>Evacuation Summary</h4>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total People</span>
                <span className="stat-value">
                  {frameData.stats.total_agents}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Evacuated</span>
                <span className="stat-value success">
                  {frameData.stats.evacuated}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Remaining</span>
                <span className="stat-value warning">
                  {frameData.stats.remaining}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Stuck</span>
                <span className="stat-value danger">
                  {frameData.stats.stuck}
                </span>
              </div>
            </div>

            <div className="success-rate">
              <span>Success Rate</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      (frameData.stats.evacuated /
                        frameData.stats.total_agents) *
                      100
                    }%`,
                  }}
                ></div>
              </div>
              <span className="percentage">
                {(
                  (frameData.stats.evacuated / frameData.stats.total_agents) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvisorReport
