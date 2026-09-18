import { useEffect, useRef, useState } from 'react'
import { RLC_EQUATIONS } from '../utils/reportContent.js'
import { EquationIcon } from './Icons.jsx'

const STEPS = { GENERATE_REPORT: 10 }

const ReportControls = ({
  minReadings,
  onGenerateReport,
  readingCount,
  reportGenerated,
  currentStep = 1,
  calculationsVerified = false,
}) => {
  const [showEquations, setShowEquations] = useState(false)
  const equationControlRef = useRef(null)
  const readingsReady = readingCount >= minReadings
  const canGenerate = readingsReady && calculationsVerified
  const isReportPhase = currentStep === STEPS.GENERATE_REPORT

  useEffect(() => {
    if (!showEquations) return undefined

    const closeOnOutsideClick = (event) => {
      if (!equationControlRef.current?.contains(event.target)) setShowEquations(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowEquations(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showEquations])

  const buttonTitle = reportGenerated
    ? 'Report generated. Click to generate it again.'
    : !readingsReady
      ? `Add at least ${minReadings} readings before generating the report.`
      : !calculationsVerified
        ? 'Correctly verify two readings before generating the report.'
        : 'Generate report.'

  const handleButtonClick = (event) => {
    onGenerateReport(event)
    window.focus()
  }

  return (
    <>
      <div
        className={`report-equation-control ${showEquations ? 'report-equation-control--open' : ''}`}
        ref={equationControlRef}
      >
        <button
          id="equation-button-walkthrough-target"
          type="button"
          className="report-equation-button"
          onClick={() => setShowEquations((isOpen) => !isOpen)}
          aria-expanded={showEquations}
          aria-controls="equation-panel"
        >
          <span className="report-equation-button__icon"><EquationIcon /></span>
          <span className="report-equation-button__copy">
            <strong>EQUATIONS</strong>
          </span>
        </button>

        {showEquations && (
          <aside className="equation-panel" id="equation-panel" role="dialog" aria-label="Series RLC equations">
            <div className="equation-panel__header">
              <div>
                <span>Series RLC</span>
                <h3>Equations</h3>
              </div>
              <button type="button" onClick={() => setShowEquations(false)} aria-label="Close equations">&times;</button>
            </div>
            <div className="equation-panel__list">
              {RLC_EQUATIONS.map(({ label, html, note }) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong dangerouslySetInnerHTML={{ __html: html }} />
                  {note && <small>{note}</small>}
                </div>
              ))}
  
            </div>
          </aside>
        )}
      </div>

      <button
        id="generate-report-button"
        type="button"
        className={`report-button ${isReportPhase ? 'report-button--highlighted' : ''}`}
        disabled={!canGenerate}
        title={buttonTitle}
        aria-label="Generate Report"
        data-report-generated={reportGenerated ? 'true' : 'false'}
        onClick={handleButtonClick}
      >
        <svg aria-hidden="true" viewBox="0 0 576 512" fill="currentColor">
          <path d="M208 48L96 48c-8.8 0-16 7.2-16 16v384c0 8.8 7.2 16 16 16h80v48H96c-35.3 0-64-28.7-64-64V64C32 28.7 60.7 0 96 0h133.5c17 0 33.3 6.7 45.3 18.7l122.5 122.6c12 12 18.7 28.3 18.7 45.3v149.5h-48v-128h-88c-39.8 0-72-32.2-72-72V48Zm140.1 112L256 67.9V136c0 13.3 10.7 24 24 24h68.1ZM240 380h32c33.1 0 60 26.9 60 60s-26.9 60-60 60h-12v28c0 11-9 20-20 20s-20-9-20-20V400c0-11 9-20 20-20Zm32 80c11 0 20-9 20-20s-9-20-20-20h-12v40h12Zm96-80h32c28.7 0 52 23.3 52 52v64c0 28.7-23.3 52-52 52h-32c-11 0-20-9-20-20V400c0-11 9-20 20-20Zm32 128c6.6 0 12-5.4 12-12v-64c0-6.6-5.4-12-12-12h-12v88h12Zm76-108c0-11 9-20 20-20h48c11 0 20 9 20 20s-9 20-20 20h-28v24h28c11 0 20 9 20 20s-9 20-20 20h-28v44c0 11-9 20-20 20s-20-9-20-20V400Z" />
        </svg>
        <span>GENERATE REPORT</span>
      </button>
    </>
  )
}

export default ReportControls
