import { useEffect, useRef } from 'react'
import { TableIcon } from './Icons.jsx'
import { RLC_VERIFICATION_TABLE, getRlcCaseKey } from '../utils/rlcMeterCalibration.js'
import './CorrectValuesPanel.css'

const COLUMNS = [
  { key: 'r', label: 'R', unit: 'kΩ' },
  { key: 'l', label: 'L', unit: 'H' },
  { key: 'c', label: 'C', unit: 'µF' },
  { key: 'nature', label: 'Nature' },
  { key: 'current', label: 'I', unit: 'mA', digits: 2 },
  { key: 'vR', label: <>V<sub>R</sub></>, unit: 'V', digits: 2 },
  { key: 'vL', label: <>V<sub>L</sub></>, unit: 'V', digits: 2 },
  { key: 'vC', label: <>V<sub>C</sub></>, unit: 'V', digits: 2 },
  { key: 'cosPhi', label: <>cos φ</>, digits: 2 },
  { key: 'power', label: 'Power', unit: 'W', digits: 2 },
]

const CorrectValuesPanel = ({ onClose }) => {
  const panelRef = useRef(null)

  useEffect(() => {
    const panel = panelRef.current
    panel.focus({ preventScroll: true })
    panel.scrollIntoView({ behavior: 'instant', block: 'nearest' })
  }, [])

  return (
    <section
      className="section-card correct-values-panel"
      id="correct-values-panel"
      aria-labelledby="correct-values-title"
      tabIndex={-1}
      ref={panelRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="section-card__heading correct-values-panel__heading">
        <TableIcon />
        <h2 id="correct-values-title">CORRECT VALUES</h2>
        <button type="button" onClick={onClose} aria-label="Close correct values">×</button>
      </div>
      <p className="correct-values-panel__note">Reference values at 30 V, f = 50 Hz</p>
      <div className="correct-values-panel__scroll" role="region" aria-label="Scrollable correct values table" tabIndex={0}>
        <table className="correct-values-table" aria-label="Correct theoretical values">
          <thead>
            <tr>
              <th scope="col">S.No.</th>
              {COLUMNS.map(({ key, label, unit }) => (
                <th key={key} scope="col">{label}{unit && <><br /><small>({unit})</small></>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RLC_VERIFICATION_TABLE.map((row, index) => (
              <tr key={getRlcCaseKey(row.r, row.l, row.c)}>
                <th scope="row">{index + 1}</th>
                {COLUMNS.map(({ key, digits }) => (
                  <td key={key}>{digits === undefined ? row[key] : Number(row[key]).toFixed(digits)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default CorrectValuesPanel
