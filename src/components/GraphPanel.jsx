import { useEffect, useRef, useState } from 'react'
import { getRlcVerificationCase } from '../utils/rlcMeterCalibration.js'

const STEPS = { CALCULATE: 9 }
const MAX_VERIFICATION_ROWS = 5
const REQUIRED_VERIFICATIONS = 2

const KNOWN_FIELDS = [
  { key: 'voltage', label: <>V<br />(V)</>, dataLabel: 'Voltage' },
  { key: 'current', label: <>I<br />(mA)</>, dataLabel: 'Current' },
  { key: 'r', label: <>R<br />(kΩ)</>, dataLabel: 'Resistance' },
  { key: 'l', label: <>L<br />(H)</>, dataLabel: 'Inductance' },
  { key: 'c', label: <>C<br />(µF)</>, dataLabel: 'Capacitance' },
]

const CALCULATED_FIELDS = [
  { key: 'vR', label: <>V<sub>R</sub><br />(V)</>, dataLabel: 'V R', errorLabel: <>V<sub>R</sub> error</>, min: 1, max: 50 },
  { key: 'vL', label: <>V<sub>L</sub><br />(V)</>, dataLabel: 'V L', errorLabel: <>V<sub>L</sub> error</>, min: 1, max: 50 },
  { key: 'vC', label: <>V<sub>C</sub><br />(V)</>, dataLabel: 'V C', errorLabel: <>V<sub>C</sub> error</>, min: 1, max: 50 },
  { key: 'cosPhi', label: <>cosφ<br />(PF)</>, dataLabel: 'Power factor', errorLabel: <>cosφ error</>, min: 0, max: 1 },
  // The reference answers are 0.27–0.89 W, so fractional watts must be allowed.
  { key: 'power', label: <>Power<br />(W)</>, dataLabel: 'Power', errorLabel: <>P error</>, min: 0, max: 50 },
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
const stopWheelValueChange = (event) => event.currentTarget.blur()
const getRangeError = (field, rawValue) => {
  const trimmedValue = String(rawValue ?? '').trim()
  const numericValue = Number(trimmedValue)

  if (!trimmedValue || !Number.isFinite(numericValue)) {
    return `${field.dataLabel} must be a valid number.`
  }

  if (numericValue < field.min || numericValue > field.max) {
    return `${field.dataLabel} must be between ${field.min} and ${field.max}.`
  }

  return null
}

const CalculationPanel = ({ className = '', currentStep = 1, observations = [], onVerify, onDraftChange, resetRequest, minReadings = 5 }) => {
  const isCalculatePhase = currentStep === STEPS.CALCULATE
  const verificationLocked = observations.length < minReadings
  const readingsRemaining = Math.max(0, minReadings - observations.length)
  const nextRowIdRef = useRef(1)
  const isFirstResetRef = useRef(true)
  const [rows, setRows] = useState(() => [createRow(0)])
  const [fieldStatus, setFieldStatus] = useState({})
  const [validationErrors, setValidationErrors] = useState({})
  const [verifiedRows, setVerifiedRows] = useState({})

  useEffect(() => {
    if (isFirstResetRef.current) {
      isFirstResetRef.current = false
      return
    }
    nextRowIdRef.current = 1
    setRows([createRow(0)])
    setFieldStatus({})
    setValidationErrors({})
    setVerifiedRows({})
  }, [resetRequest])

  const verifiedCount = Object.values(verifiedRows).filter(Boolean).length
  const completedRequirementCount = Math.min(verifiedCount, REQUIRED_VERIFICATIONS)
  const selectedObservationIndexes = rows
    .map((row) => row.observationIndex)
    .filter((value) => value !== '')
  const activeWorkflowRow = rows.find((row) => !verifiedRows[row.id]) ?? rows[rows.length - 1]
  const activeWorkflowStep = activeWorkflowRow.observationIndex === ''
    ? 1
    : CALCULATED_FIELDS.every(({ key }) => activeWorkflowRow.values[key] !== '') ? 3 : 2
  const getWorkflowStepClass = (step) => [
    'verification-workflow__step',
    step === activeWorkflowStep ? 'is-active' : '',
    step < activeWorkflowStep ? 'is-complete' : '',
  ].filter(Boolean).join(' ')

  const handleFieldChange = (rowId, key, value) => {
    const row = rows.find((entry) => entry.id === rowId)
    onDraftChange?.(rowId, { ...row.values, [key]: value, observationIndex: Number(row.observationIndex) })
    setRows((current) => current.map((row) => (
      row.id === rowId ? { ...row, values: { ...row.values, [key]: value } } : row
    )))
    setFieldStatus((current) => {
      const next = { ...current }
      if (next[rowId]) next[rowId] = { ...next[rowId], [key]: undefined }
      return next
    })
    setValidationErrors((current) => {
      const next = { ...current }
      if (next[rowId]) {
        const rowErrors = { ...next[rowId] }
        delete rowErrors[key]
        if (Object.keys(rowErrors).length) next[rowId] = rowErrors
        else delete next[rowId]
      }
      return next
    })
  }

  const handleObservationSelect = (rowId, value) => {
    if (verificationLocked) return
    const observation = value === '' ? null : observations[Number(value)]
    const reference = getTheoreticalValues(observation)
    if (observation) {
      onDraftChange?.(rowId, { ...EMPTY_ROW, voltage: observation.voltage, current: reference.current, r: observation.r, l: observation.l, c: observation.c, observationIndex: Number(value) })
    }
    setRows((current) => current.map((row) => row.id === rowId
      ? {
          ...row,
          observationIndex: value,
          values: observation
            ? {
                ...EMPTY_ROW,
                voltage: observation.voltage,
                current: reference.current,
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
    setValidationErrors((current) => {
      const next = { ...current }
      delete next[rowId]
      return next
    })
  }

  const handleAddRow = () => {
    if (verificationLocked || rows.length >= MAX_VERIFICATION_ROWS) return
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

    const rangeErrors = Object.fromEntries(
      CALCULATED_FIELDS
        .map((field) => [field.key, getRangeError(field, row.values[field.key])])
        .filter(([, error]) => error),
    )

    setValidationErrors((current) => {
      const next = { ...current }
      if (Object.keys(rangeErrors).length) next[row.id] = rangeErrors
      else delete next[row.id]
      return next
    })

    const verificationValues = getTheoreticalValues(observation)
    const statuses = Object.fromEntries(CALCULATED_FIELDS.map(({ key }) => [
      key,
      !rangeErrors[key] && matchesTableValue(Number(row.values[key]), verificationValues[key]),
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
        <div className="calculation-panel__title-group">
          <p className="calculation-panel__eyebrow">
            <span aria-hidden="true">&#10003;</span>
            Series RLC analysis
          </p>
          <h2>Theoretical Verification</h2>
          <p className="calculation-panel__instruction">
            {verificationLocked
              ? `Add ${readingsRemaining} more reading${readingsRemaining === 1 ? '' : 's'} to unlock verification.`
              : 'Select recorded readings, calculate the theoretical values, and verify two rows to enable report generation.'}
          </p>
        </div>
        <div
          className="calculation-panel__progress"
          aria-label={`${completedRequirementCount} of ${REQUIRED_VERIFICATIONS} required readings verified`}
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={REQUIRED_VERIFICATIONS}
          aria-valuenow={completedRequirementCount}
          style={{ '--verification-progress': `${(completedRequirementCount / REQUIRED_VERIFICATIONS) * 360}deg` }}
        >
          <span className="calculation-panel__progress-ring" aria-hidden="true">
            <i>{completedRequirementCount}</i>
          </span>
          <span className="calculation-panel__progress-copy">
            <small>Verification progress</small>
            <strong>{completedRequirementCount} of {REQUIRED_VERIFICATIONS} required</strong>
          </span>
          <span className="calculation-panel__progress-dots" aria-hidden="true">
            {Array.from({ length: REQUIRED_VERIFICATIONS }, (_, index) => (
              <i className={index < verifiedCount ? 'is-complete' : ''} key={index} />
            ))}
          </span>
        </div>
      </div>

      <div className="graph-panel__body calculation-panel__body">
        <article className="calculation-card calculation-card--verification">
          <div className="calculation-card__heading">
            <span className="calculation-card__step">01</span>
            <div>
              <h3>Select and Verify Readings</h3>
              <p>V and the reference I (mA) are prefilled. Calculate V<sub>R</sub>, V<sub>L</sub>, V<sub>C</sub>, cos⁡ϕ, and Power using the provided Equations.</p>
            </div>
            <div className="calculation-card__heading-actions">
              <span className="calculation-row-capacity" aria-live="polite">
                <strong>{rows.length}</strong> / {MAX_VERIFICATION_ROWS} rows
              </span>
              <button
                type="button"
                className="calculation-row-add"
                onClick={handleAddRow}
                disabled={verificationLocked || rows.length >= MAX_VERIFICATION_ROWS}
                title={rows.length >= MAX_VERIFICATION_ROWS ? 'Five verification rows have been added.' : 'Add another verification row.'}
              >
                <span className="calculation-button-icon" aria-hidden="true">+</span>
                <span>{rows.length >= MAX_VERIFICATION_ROWS ? 'Rows added' : 'Add Rows'}</span>
              </button>
            </div>
          </div>

          <div className="verification-workflow" aria-label={`Reading verification workflow, step ${activeWorkflowStep} of 3`}>
            <span className={getWorkflowStepClass(1)}>
              <b>1</b>
              <span><small>Choose</small>A recorded reading</span>
            </span>
            <i className={activeWorkflowStep > 1 ? 'is-complete' : ''} aria-hidden="true" />
            <span className={getWorkflowStepClass(2)}>
              <b>2</b>
              <span><small>Enter</small>Theoretical values</span>
            </span>
            <i className={activeWorkflowStep > 2 ? 'is-complete' : ''} aria-hidden="true" />
            <span className={getWorkflowStepClass(3)}>
              <b>3</b>
              <span><small>Check</small>Verify the result</span>
            </span>
          </div>

          <div className="calculation-table-wrap">
            <table className="observation-table calculation-table">
              <thead>
                <tr className="calculation-table__group-row">
                  <th rowSpan="2">Reading</th>
                  <th className="is-known" colSpan={KNOWN_FIELDS.length}>
                    <span>Recorded parameters</span>
                    <small>Auto-filled</small>
                  </th>
                  <th className="is-calculated" colSpan={CALCULATED_FIELDS.length}>
                    <span>Theoretical results</span>
                    <small>Enter values</small>
                  </th>
                  <th rowSpan="2">Status</th>
                </tr>
                <tr className="calculation-table__field-row">
                  {ALL_FIELDS.map(({ key, label }) => (
                    <th className={KNOWN_FIELDS.some((field) => field.key === key) ? 'is-known' : 'is-calculated'} key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hasObservation = row.observationIndex !== ''
                  const isVerified = Boolean(verifiedRows[row.id])
                  const rowStatuses = fieldStatus[row.id] || {}
                  const hasVerificationResult = Object.values(rowStatuses).some((status) => typeof status === 'boolean')

                  return (
                    <tr
                      className={`${hasObservation ? 'has-reading' : ''} ${isVerified ? 'is-verified' : ''}`}
                      key={row.id}
                    >
                      <td data-label="Reading">
                        <select
                          className="calculation-reading-select"
                          aria-label={`Select observation for verification row ${row.id}`}
                          value={row.observationIndex}
                          disabled={verificationLocked || hasObservation || isVerified}
                          onChange={(event) => handleObservationSelect(row.id, event.target.value)}
                        >
                          <option value="">Select</option>
                          {observations.map((observation, observationIndex) => {
                            const value = String(observationIndex)
                            const isSelectedInAnotherRow = selectedObservationIndexes.includes(value)
                              && row.observationIndex !== value

                            if (isSelectedInAnotherRow) return null

                            return (
                              <option key={observation.id ?? observationIndex} value={observationIndex}>
                                Reading {observationIndex + 1}
                              </option>
                            )
                          })}
                        </select>
                      </td>
                      {ALL_FIELDS.map(({ key, dataLabel, min, max }) => {
                        const isKnown = KNOWN_FIELDS.some((field) => field.key === key)
                        const status = rowStatuses[key]
                        const validationError = validationErrors[row.id]?.[key]
                        return (
                          <td className={isKnown ? 'is-known-value' : 'is-entry-value'} data-label={dataLabel} key={key}>
                            <div className="calculation-input-shell">
                              <input
                                type="number"
                                step="any"
                                className={`calculation-table-input ${status === true ? 'is-correct' : status === false ? 'is-incorrect' : ''}`}
                                aria-label={`${dataLabel} for verification row ${row.id}`}
                                aria-invalid={Boolean(validationError) || status === false}
                                min={min}
                                max={max}
                                value={row.values[key]}
                                placeholder={!isKnown && hasObservation ? `${min}–${max}` : ''}
                                disabled={verificationLocked || !hasObservation || isKnown || isVerified}
                                onChange={(event) => handleFieldChange(row.id, key, event.target.value)}
                                onWheel={stopWheelValueChange}
                                inputMode="decimal"
                                title={validationError || (!isKnown ? `Enter a value from ${min} to ${max}.` : undefined)}
                              />
                              {typeof status === 'boolean' && (
                                <span
                                  className={`calculation-input-feedback ${status ? 'is-correct' : 'is-incorrect'}`}
                                  aria-label={status ? 'Correct' : 'Recheck'}
                                  title={status ? 'Correct' : 'Recheck'}
                                >
                                  {status ? '✓' : '×'}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td data-label="Status">
                        <button
                          type="button"
                          className={`calculation-row-verify ${isVerified ? 'is-verified' : ''} ${hasVerificationResult && !isVerified ? 'needs-review' : ''}`}
                          disabled={verificationLocked || !hasObservation || isVerified}
                          onClick={() => handleVerifyRow(row)}
                        >
                          <span className="calculation-button-icon" aria-hidden="true">
                            {isVerified ? '✓' : hasVerificationResult ? '↻' : '✓'}
                          </span>
                          <span>{isVerified ? 'Verified' : hasVerificationResult ? 'Recheck' : 'Verify'}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {Object.entries(validationErrors).map(([rowId, errors]) => (
            <p className="calculation-validation-message" key={rowId} role="alert">
              <strong>Check row {Number(rowId) + 1}:</strong> {Object.values(errors).join(' ')}
            </p>
          ))}
          <div className="calculation-card__footer">
            <span className="verification-status-badge verification-status-badge--known"><i aria-hidden="true">↗</i>Auto-filled</span>
            <span className="verification-status-badge verification-status-badge--correct"><i aria-hidden="true">✓</i>Correct</span>
            <span className="verification-status-badge verification-status-badge--incorrect"><i aria-hidden="true">×</i>Recheck</span>
            <p>A maximum of five verification rows may be created.</p>
          </div>
        </article>

        <article className="calculation-card calculation-card--errors">
          <div className="calculation-card__heading">
            <span className="calculation-card__step">02</span>
            <div>
              <h3>Error Analysis</h3>
              <p>Measured values are compared with theoretical (true) values.</p>
            </div>
            <span className="calculation-card__result-count">
              {rows.filter((row) => row.observationIndex !== '').length} selected
            </span>
          </div>
          <div className="calculation-errors" role="region" aria-label="Verification errors" tabIndex={0}>
            {rows.filter((row) => row.observationIndex !== '').map((row) => {
              const observation = observations[Number(row.observationIndex)]
              const theoretical = getTheoreticalValues(observation)
              const tableValues = getTableValues(observation)
              const statuses = fieldStatus[row.id]
              return (
                <div className="calculation-error-row" key={row.id}>
                  <div className="calculation-error-row__heading">
                    <strong>
                      <span aria-hidden="true">R{Number(row.observationIndex) + 1}</span>
                      Reading {Number(row.observationIndex) + 1}
                    </strong>
                    <small className={statuses ? 'is-ready' : ''}>
                      {statuses ? 'Calculated' : 'Awaiting verification'}
                    </small>
                  </div>
                  <div className="calculation-error-grid">
                    {CALCULATED_FIELDS.map(({ key, errorLabel }) => {
                      const error = statuses ? getPercentError(tableValues[key], theoretical[key]) : null
                      const status = statuses?.[key]
                      return (
                        <span className={status === true ? 'is-correct' : status === false ? 'is-incorrect' : ''} key={key}>
                          <span className="calculation-error-label">{errorLabel}</span>
                          <b><sub>{error === null ? '—' : `${error.toFixed(2)}%`}</sub></b>
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
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

export default CalculationPanel
