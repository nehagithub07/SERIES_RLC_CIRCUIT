import { useEffect, useRef, useState } from 'react'
import { getRlcVerificationCase } from '../utils/rlcMeterCalibration.js'

const STEPS = { CALCULATE: 9 }
const MAX_VERIFICATION_ROWS = 5
const REQUIRED_VERIFICATIONS = 2

const KNOWN_FIELDS = [
  { key: 'voltage', label: <>V<br />(V)</> },
  { key: 'current', label: <>I<br />(mA)</> },
  { key: 'r', label: <>R<br />(kΩ)</> },
  { key: 'l', label: <>L<br />(H)</> },
  { key: 'c', label: <>C<br />(µF)</> },
]

const CALCULATED_FIELDS = [
  { key: 'vR', label: <>V<sub>R</sub><br />(V)</>, errorLabel: 'VR error' },
  { key: 'vL', label: <>V<sub>L</sub><br />(V)</>, errorLabel: 'VL error' },
  { key: 'vC', label: <>V<sub>C</sub><br />(V)</>, errorLabel: 'VC error' },
  { key: 'cosPhi', label: <>cosφ<br />(PF)</>, errorLabel: 'cosφ error' },
  { key: 'power', label: <>Power<br />(W)</>, errorLabel: 'Power error' },
]

const ALL_FIELDS = [...KNOWN_FIELDS, ...CALCULATED_FIELDS]
const EMPTY_ROW = Object.fromEntries(ALL_FIELDS.map(({ key }) => [key, '']))

const getTheoreticalValues = (observation) => {
  if (!observation) return null
  return getRlcVerificationCase(observation.r, observation.l, observation.c)
}

const getTableValues = (observation) => {
  if (!observation) return null

  const voltage = Number(observation.voltage)
  const currentAmps = Number(observation.current) / 1000
  const apparentPower = voltage * currentAmps
  const measuredPowerFactor = apparentPower > 0
    ? Math.min(1, Math.abs(Number(observation.power)) / apparentPower)
    : 0

  return {
    vR: Number(observation.vR),
    vL: Number(observation.vL),
    vC: Number(observation.vC),
    cosPhi: measuredPowerFactor,
    power: Number(observation.power),
  }
}

const matchesTableValue = (value, expected) => {
  if (!Number.isFinite(value) || !Number.isFinite(expected)) return false
  return Math.abs(value - expected) < 0.005
}

const getPercentError = (measuredValue, trueValue) => {
  const measured = Number(measuredValue)
  const theoretical = Number(trueValue)
  if (!Number.isFinite(measured) || !Number.isFinite(theoretical)) return null
  if (theoretical === 0) return measured === 0 ? 0 : null
  return (Math.abs(measured - theoretical) / Math.abs(theoretical)) * 100
}

const createRow = (id) => ({ id, values: { ...EMPTY_ROW }, observationIndex: '' })

const CalculationPanel = ({ className = '', currentStep = 1, observations = [], onVerify, resetRequest, minReadings = 5 }) => {
  const isCalculatePhase = currentStep === STEPS.CALCULATE
  const verificationLocked = observations.length < minReadings
  const readingsRemaining = Math.max(0, minReadings - observations.length)
  const nextRowIdRef = useRef(1)
  const isFirstResetRef = useRef(true)
  const [rows, setRows] = useState(() => [createRow(0)])
  const [fieldStatus, setFieldStatus] = useState({})
  const [verifiedRows, setVerifiedRows] = useState({})

  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    nextRowIdRef.current = 1
    setRows([createRow(0)])
    setFieldStatus({})
    setVerifiedRows({})
  }, [resetRequest])

  const verifiedCount = Object.values(verifiedRows).filter(Boolean).length
  const selectedObservationIndexes = rows
    .map((row) => row.observationIndex)
    .filter((value) => value !== '')

  const handleFieldChange = (rowId, key, value) => {
    setRows((current) => current.map((row) => (
      row.id === rowId ? { ...row, values: { ...row.values, [key]: value } } : row
    )))
    setFieldStatus((current) => {
      const next = { ...current }
      if (next[rowId]) next[rowId] = { ...next[rowId], [key]: undefined }
      return next
    })
  }

  const handleObservationSelect = (rowId, value) => {
    if (verificationLocked) return
    const observation = value === '' ? null : observations[Number(value)]
    const verificationValues = getTheoreticalValues(observation)
    setRows((current) => current.map((row) => row.id === rowId
      ? {
          ...row,
          observationIndex: value,
          values: observation
            ? {
                ...EMPTY_ROW,
                voltage: observation.voltage,
                current: verificationValues?.current ?? observation.current,
                r: observation.r,
                l: observation.l,
                c: observation.c,
              }
            : { ...EMPTY_ROW },
        }
      : row))
    setFieldStatus((current) => {
      const next = { ...current }
      delete next[rowId]
      return next
    })
  }

  const handleAddRow = () => {
    if (verificationLocked || rows.length >= MAX_VERIFICATION_ROWS || verifiedCount >= REQUIRED_VERIFICATIONS) return
    const id = nextRowIdRef.current
    nextRowIdRef.current += 1
    setRows((current) => [...current, createRow(id)])
  }

  const handleVerifyRow = (row) => {
    if (verificationLocked) return
    const observation = row.observationIndex === '' ? null : observations[Number(row.observationIndex)]
    const allFilled = CALCULATED_FIELDS.every(({ key }) => row.values[key] !== '')

    if (!observation || !allFilled) {
      onVerify?.(row.id, row.values, null, row.observationIndex)
      return
    }

    const verificationValues = getTheoreticalValues(observation)
    const statuses = Object.fromEntries(CALCULATED_FIELDS.map(({ key }) => [
      key,
      matchesTableValue(Number(row.values[key]), verificationValues[key]),
    ]))
    const isRowCorrect = Object.values(statuses).every(Boolean)

    setFieldStatus((current) => ({ ...current, [row.id]: statuses }))

    if (isRowCorrect) {
      setVerifiedRows((current) => ({ ...current, [row.id]: true }))
    }

    const theoretical = verificationValues
    const tableValues = getTableValues(observation)
    const errorValues = Object.fromEntries(CALCULATED_FIELDS.map(({ key }) => [
      `${key}Error`,
      getPercentError(tableValues[key], theoretical[key]),
    ]))

    onVerify?.(
      row.id,
      { ...row.values, ...errorValues, observationIndex: Number(row.observationIndex) },
      isRowCorrect,
      Number(row.observationIndex),
      { incorrectCount: Object.values(statuses).filter((status) => !status).length },
    )
  }

  return (
    <section
      id="theoretical-calculations-panel"
      className={`graph-panel calculation-panel ${className} ${isCalculatePhase ? 'calculation-panel--active-phase' : ''} ${verificationLocked ? 'calculation-panel--locked' : ''}`}
      aria-label="Reading Verification Panel"
      aria-disabled={verificationLocked}
    >
      <div className="graph-panel__heading">
        <div>
          <h2>READING VERIFICATION</h2>
          <p className="calculation-panel__instruction">
            {verificationLocked
              ? `Add ${readingsRemaining} more reading${readingsRemaining === 1 ? '' : 's'} to unlock verification.`
              : 'Choose any two readings and enter the values exactly as recorded in the observation table.'}
          </p>
        </div>
        <div className="calculation-panel__progress" aria-label={`${verifiedCount} of ${REQUIRED_VERIFICATIONS} readings verified`}>
          <span className="calculation-panel__progress-dots" aria-hidden="true">
            {Array.from({ length: REQUIRED_VERIFICATIONS }, (_, index) => (
              <i className={index < verifiedCount ? 'is-complete' : ''} key={index} />
            ))}
          </span>
          <strong>{verifiedCount}/{REQUIRED_VERIFICATIONS}</strong>
          <span>verified</span>
        </div>
      </div>

      <div className="graph-panel__body calculation-panel__body">
        <article className="calculation-card calculation-card--verification">
          {verificationLocked && (
            <div className="verification-lock-banner" role="status">
              <span aria-hidden="true">&#128274;</span>
              <strong>Verification unlocks after 5 readings</strong>
              <small>{observations.length}/5 readings recorded</small>
            </div>
          )}
          <div className="calculation-card__heading">
            <span className="calculation-card__step">01</span>
            <div>
              <h3>Verification Section</h3>
              <p>V and I (mA) are prefilled. Enter V<sub>R</sub>, V<sub>L</sub>, V<sub>C</sub>, cosφ, and Power.</p>
            </div>
            <button
              type="button"
              className="calculation-row-add"
              onClick={handleAddRow}
              disabled={verificationLocked || rows.length >= MAX_VERIFICATION_ROWS || verifiedCount >= REQUIRED_VERIFICATIONS}
            >
              + Add row
            </button>
          </div>

          <div className="calculation-table-wrap">
            <table className="observation-table calculation-table">
              <thead>
                <tr>
                  <th>Reading</th>
                  {ALL_FIELDS.map(({ key, label }) => (
                    <th className={KNOWN_FIELDS.some((field) => field.key === key) ? 'is-known' : 'is-calculated'} key={key}>{label}</th>
                  ))}
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hasObservation = row.observationIndex !== ''
                  const isVerified = Boolean(verifiedRows[row.id])
                  const rowStatuses = fieldStatus[row.id] || {}
                  const verificationLimitReached = verifiedCount >= REQUIRED_VERIFICATIONS && !isVerified

                  return (
                    <tr key={row.id}>
                      <td>
                        <select
                          className="calculation-reading-select"
                          aria-label={`Select observation for verification row ${row.id}`}
                          value={row.observationIndex}
                          disabled={verificationLocked || isVerified || verificationLimitReached}
                          onChange={(event) => handleObservationSelect(row.id, event.target.value)}
                        >
                          <option value="">Select</option>
                          {observations.map((observation, observationIndex) => (
                            <option
                              key={observation.id ?? observationIndex}
                              value={observationIndex}
                              disabled={selectedObservationIndexes.includes(String(observationIndex)) && row.observationIndex !== String(observationIndex)}
                            >
                              Reading {observationIndex + 1}
                            </option>
                          ))}
                        </select>
                      </td>
                      {ALL_FIELDS.map(({ key }) => {
                        const isKnown = KNOWN_FIELDS.some((field) => field.key === key)
                        const status = rowStatuses[key]
                        return (
                          <td key={key}>
                            <input
                              type="number"
                              step="any"
                              className={`calculation-table-input ${status === true ? 'is-correct' : status === false ? 'is-incorrect' : ''}`}
                              aria-label={`${key} for verification row ${row.id}`}
                              value={row.values[key]}
                              disabled={verificationLocked || !hasObservation || isKnown || isVerified || verificationLimitReached}
                              onChange={(event) => handleFieldChange(row.id, key, event.target.value)}
                            />
                          </td>
                        )
                      })}
                      <td>
                        <button
                          type="button"
                          className={`calculation-row-verify ${isVerified ? 'is-verified' : ''}`}
                          disabled={verificationLocked || !hasObservation || isVerified || verificationLimitReached}
                          onClick={() => handleVerifyRow(row)}
                        >
                          {isVerified ? 'Verified' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="calculation-card__footer">
            <span><i className="status-dot status-dot--known" />Auto-filled</span>
            <span><i className="status-dot status-dot--correct" />Correct</span>
            <span><i className="status-dot status-dot--incorrect" />Recheck</span>
            <p>A maximum of five verification rows may be created.</p>
          </div>
        </article>

        <article className="calculation-card calculation-card--errors">
          <div className="calculation-card__heading">
            <span className="calculation-card__step">02</span>
            <div>
              <h3>Error Section</h3>
              <p>Measured values are compared with theoretical (true) values.</p>
            </div>
          </div>
          <div className="calculation-errors">
            {rows.filter((row) => row.observationIndex !== '').map((row) => {
              const observation = observations[Number(row.observationIndex)]
              const theoretical = getTheoreticalValues(observation)
              const tableValues = getTableValues(observation)
              const statuses = fieldStatus[row.id]
              return (
                <div className="calculation-error-row" key={row.id}>
                  <strong>Reading {Number(row.observationIndex) + 1}</strong>
                  <div className="calculation-error-grid">
                    {CALCULATED_FIELDS.map(({ key, errorLabel }) => {
                      const error = statuses ? getPercentError(tableValues[key], theoretical[key]) : null
                      const status = statuses?.[key]
                      return (
                        <span className={status === true ? 'is-correct' : status === false ? 'is-incorrect' : ''} key={key}>
                          {errorLabel}<b>{error === null ? '—' : `${error.toFixed(2)}%`}</b>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {!rows.some((row) => row.observationIndex !== '') && (
              <div className="calculation-errors__empty">
                <span aria-hidden="true">%</span>
                <strong>No results yet</strong>
                <p>Select a reading and verify its table values to see field-level errors.</p>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

export default CalculationPanel
