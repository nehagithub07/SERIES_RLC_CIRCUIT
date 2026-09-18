import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import './responsive.css'
import ActionButtons from './components/ActionButtons.jsx'
import ConnectionLab from './components/ConnectionLab.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import GraphPanel from './components/GraphPanel.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import ReportControls from './components/ReportControls.jsx' 
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { EXPERIMENT_ALERTS } from './alerts/experimentStepAlerts.js'
import { generateRlcReport } from './utils/reportGenerator.js' 
import WalkthroughProvider from './walkthrough/WalkthroughProvider.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { useAiGuideNarration } from './aiGuide/useAiGuideNarration.js'
import { stopAlertSound } from './utils/alertAudioManager.js'
import { getRlcMeterCase, getNeedleAngle, getRlcCaseKey } from './utils/rlcMeterCalibration.js'
import { useFocusTrap } from './walkthrough/hooks/useFocusTrap.js'

// Base Layout Canvas Dimension Constants
const BASE_WIDTH = 1440
const BASE_HEIGHT = 1260
const GRAPH_SECTION_GAP = 24
const GRAPH_SECTION_HEIGHT = 480
const CONTENT_HEIGHT = BASE_HEIGHT + GRAPH_SECTION_GAP + GRAPH_SECTION_HEIGHT
const PANEL_MAX_SCALE = 0.96
const PANEL_VIEWPORT_MARGIN = 16
const MIN_VERIFICATION_READINGS = 5
const MIN_REPORT_READINGS = MIN_VERIFICATION_READINGS
const MAX_OBSERVATIONS = 12
const FALLBACK_RATED_READINGS = { vR: 19.7, vL: 42.24, vC: 28.52, current: 0.9, power: 17.7, angles: {} }

// Series RLC Laboratory Safety Parameter Constraints
const VOLTAGE_SAFETY_LIMIT = 29.5
const VOLTAGE_SAFETY_RESET = 0

// 🎯 STEP DEFINITIONS
const STEPS = {
  WALKTHROUGH: 1,
  CONNECT: 2,
  CHECK: 3,
  POWER_ON: 4,
  SELECT_COMPONENTS: 5,
  VARIAC_ON: 6,
  SET_VOLTAGE: 7,
  ADD_READING: 8,
  CALCULATE: 9,
  GENERATE_REPORT: 10
};

const getScale = () => {
  if (typeof window === 'undefined') {
    return 1
  }
  const viewportWidth = window.visualViewport?.width
    ?? document.documentElement.clientWidth
    ?? window.innerWidth
  if (viewportWidth <= 1024) return 1
  const widthScale = (viewportWidth - PANEL_VIEWPORT_MARGIN) / BASE_WIDTH
  // Preserve legible controls on narrow screens. The scaled laboratory stage
  // remains horizontally scrollable instead of shrinking labels below a
  // usable size.
  return Math.max(Math.min(widthScale, PANEL_MAX_SCALE), 0.62)
}

// Keep at least two physical source pixels behind every visual CSS pixel.
// Standard-density screens get a 2x backing layer; high-DPR displays already
// provide that density natively. The final visual scale remains unchanged.
const getRenderScale = () => {
  if (typeof window === 'undefined' || window.innerWidth <= 1024) return 1
  const dpr = Math.max(Number(window.devicePixelRatio) || 1, 0.5)
  return Math.min(3, Math.max(1, Math.ceil(2 / dpr)))
}

const App = () => {
  const { clearAlerts, showAlert, showStepAlert } = useLabAlerts()
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(CONTENT_HEIGHT)
  const [scale, setScale] = useState(getScale)
  const [renderScale, setRenderScale] = useState(getRenderScale)
  const [viewportHeight, setViewportHeight] = useState(() => (
    typeof window === 'undefined' ? 900 : (window.visualViewport?.height ?? window.innerHeight)
  ))
  
  const [r, setR] = useState(10)
  const [l, setL] = useState(0.1)
  const [c, setC] = useState(0.0001)
  const [voltage, setVoltage] = useState(0)
  const [powerOn, setPowerOn] = useState(false)
  const [observations, setObservations] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false) 
  
  const [calculationRows, setCalculationRows] = useState({})
  const [verifiedRows, setVerifiedRows] = useState({})
  const [isResistorCorrect, setIsResistorCorrect] = useState(false) 
  const [calculationsVerified, setCalculationsVerified] = useState(false)
  const [hasFailedVerification, setHasFailedVerification] = useState(false)
  const [showCorrectValues, setShowCorrectValues] = useState(false)
  const [variacPowered, setVariacPowered] = useState(false)
  const [variacRotated, setVariacRotated] = useState(false)
  const [status, setStatus] = useState('Make the series connections, click CHECK, then turn on the MCB switch.')

  // 🎯 COMPONENT VALUE SELECTION (Resistor / Inductor / Capacitor)
  // Must be selected after the MCB is switched ON and before the
  // autotransformer (Variac) can be turned ON.
  const [selectedResistor, setSelectedResistor] = useState('')
  const [selectedInductor, setSelectedInductor] = useState('')
  const [selectedCapacitor, setSelectedCapacitor] = useState('')
  const componentsSelected = Boolean(selectedResistor && selectedInductor && selectedCapacitor)

  const [autoConnectRequest, setAutoConnectRequest] = useState(0) 
  const [checkRequest, setCheckRequest] = useState(0)
  const [resetRequest, setResetRequest] = useState(0)
  // 🔁 Lighter-weight reset signal used between R/L/C combinations: resets
  // the Variac knob/power state and meters WITHOUT touching the jsPlumb
  // wiring, so the learner doesn't have to redo the circuit connections
  // for every new combination.
  const [connectionsVerified, setConnectionsVerified] = useState(false)
  const [sessionStart, setSessionStart] = useState(() => Date.now()) 
  const voltageLimitWarningShownRef = useRef(false)
  const instructionsDialogRef = useRef(null)

  useFocusTrap(instructionsDialogRef, isModalOpen)

  // 🎯 STEP TRACKING STATE
  const [currentStep, setCurrentStep] = useState(STEPS.WALKTHROUGH);
  const lastPlayedStepRef = useRef(null);
  const [aiGuideEnabled, setAiGuideEnabled] = useState(false)
  const aiGuideEnabledRef = useRef(false)
  const walkthroughActiveRef = useRef(false)
  const [pendingGuideStep, setPendingGuideStep] = useState(3)
  const pendingTimersRef = useRef(new Set())
  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach(window.clearTimeout)
    pendingTimersRef.current.clear()
  }, [])
  const scheduleAlert = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      pendingTimersRef.current.delete(timer)
      callback()
    }, delay)
    pendingTimersRef.current.add(timer)
  }, [])
  useEffect(() => clearPendingTimers, [clearPendingTimers])
  const handleDraftChange = useCallback((rowId, values) => {
    setCalculationRows((current) => ({ ...current, [rowId]: values }))
    setReportGenerated(false)
  }, [])

  useEffect(() => {
    const element = contentRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(() => setContentHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [resetRequest])

  // 🎙️ AI GUIDE NARRATION
  const {
    activeStepId: activeAiGuideStepId,
    playStep: playAiGuideStep,
    stop: stopAiGuideStep,
  } = useAiGuideNarration({
    onError: (error) => console.error('AI Guide narration failed:', error),
  })

  // Experiment narration runs only after the learner enables AI Guide. Alert
  // audio is managed separately by LabAlertProvider.
  const playGuideStep = useCallback((stepId) => {
    if (!aiGuideEnabledRef.current || walkthroughActiveRef.current) {
      return Promise.resolve(false)
    }

    stopAlertSound()
    lastPlayedStepRef.current = stepId
    return playAiGuideStep(stepId)
  }, [playAiGuideStep])

  useEffect(() => {
    const handleResize = () => {
      setScale(getScale())
      setRenderScale(getRenderScale())
      setViewportHeight(window.visualViewport?.height ?? window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  // 🎯 DERIVED STEP STATUS
  const derivedStep = useMemo(() => {
    if (currentStep === STEPS.WALKTHROUGH) return STEPS.WALKTHROUGH;
    if (!connectionsVerified) {
      return currentStep === STEPS.CHECK ? STEPS.CHECK : STEPS.CONNECT;
    }
    if (!powerOn) return STEPS.POWER_ON;
    if (!componentsSelected) return STEPS.SELECT_COMPONENTS;
    if (voltage <= 0) return variacPowered ? STEPS.SET_VOLTAGE : STEPS.VARIAC_ON;
    if (voltage < 30) return STEPS.SET_VOLTAGE;
    if (currentStep === STEPS.ADD_READING) return STEPS.ADD_READING;
    if (observations.length < MIN_VERIFICATION_READINGS) return STEPS.ADD_READING;
    if (!isResistorCorrect) return STEPS.CALCULATE;
    return STEPS.GENERATE_REPORT;
  }, [currentStep, connectionsVerified, powerOn, componentsSelected, variacPowered, voltage, observations.length, isResistorCorrect]);

  const handleAiGuide = useCallback(() => {
    if (aiGuideEnabledRef.current) {
      aiGuideEnabledRef.current = false
      setAiGuideEnabled(false)
      stopAiGuideStep()
      setStatus('AI Guide is OFF. Alerts and walkthrough audio remain available independently.')
      return
    }

    const stepByPhase = {
      [STEPS.WALKTHROUGH]: 1,
      [STEPS.CONNECT]: pendingGuideStep,
      [STEPS.CHECK]: 22,
      [STEPS.POWER_ON]: 29,
      [STEPS.SELECT_COMPONENTS]: 30,
      [STEPS.VARIAC_ON]: 31,
      [STEPS.SET_VOLTAGE]: 32,
      [STEPS.ADD_READING]: 33,
      [STEPS.CALCULATE]: observations.length >= MAX_OBSERVATIONS ? 38 : observations.length === 5 ? 50 : 42,
      [STEPS.GENERATE_REPORT]: 41,
    }

    aiGuideEnabledRef.current = true
    setAiGuideEnabled(true)
    stopAlertSound()
    setStatus('AI Guide is ON and will narrate the current experiment steps. Click AI Guide again to turn it OFF.')
    playAiGuideStep(stepByPhase[derivedStep] ?? 1)
  }, [derivedStep, observations.length, pendingGuideStep, playAiGuideStep, stopAiGuideStep])

  const handleWalkthroughStart = useCallback(() => {
    walkthroughActiveRef.current = true
    clearPendingTimers()
    clearAlerts()
    // The walkthrough owns its popup narration and must not share playback
    // state with either the AI Guide or lab-alert audio.
    stopAiGuideStep()
    stopAlertSound()
  }, [clearAlerts, clearPendingTimers, stopAiGuideStep])

  useEffect(() => {
    const yieldNarrationToAlert = () => stopAiGuideStep()

    window.addEventListener('lab-alert:sound', yieldNarrationToAlert)
    return () => window.removeEventListener('lab-alert:sound', yieldNarrationToAlert)
  }, [stopAiGuideStep])

  // 🎯 The rated (30 V) readings for the currently selected R/L/C
  // combination — see src/utils/rlcMeterCalibration.js for the full 12-case
  // table and how to hand-tune needle angles.
  const rlcCase = useMemo(
    () => getRlcMeterCase(selectedResistor, selectedInductor, selectedCapacitor),
    [selectedResistor, selectedInductor, selectedCapacitor]
  )

  // Fallback rated readings used only before a combination has been fully
  // selected (the MCB can't be switched on yet at that point anyway).
  const ratedReadings = rlcCase || FALLBACK_RATED_READINGS
  const currentVoltage = powerOn ? voltage : 0
  const factor = currentVoltage / 30
  const angleOverrides = ratedReadings.angles || {}
  const readings = {
    v1: 30 * factor,
    v2: ratedReadings.vR * factor,
    v3: ratedReadings.vL * factor,
    v4: ratedReadings.vC * factor,
    current: ratedReadings.current * factor,
    power: ratedReadings.power * factor,
    vR: ratedReadings.vR * factor,
    vL: ratedReadings.vL * factor,
    vC: ratedReadings.vC * factor,
    angles: {
      vR: getNeedleAngle('voltmeter', ratedReadings.vR, factor, angleOverrides.vR),
      vL: getNeedleAngle('voltmeter', ratedReadings.vL, factor, angleOverrides.vL),
      vC: getNeedleAngle('voltmeter', ratedReadings.vC, factor, angleOverrides.vC),
      current: getNeedleAngle('ammeter', ratedReadings.current, factor, angleOverrides.current),
      power: getNeedleAngle('wattmeter', ratedReadings.power, factor, angleOverrides.power),
    },
  }

  const normalizedVoltage = Number(voltage.toFixed(1))
  // 🎯 Each observation row corresponds to one selected R/L/C combination
  // (readings are always taken at the rated 30 V supply), so duplicates are
  // detected by combination — not by voltage, which is the same every time.
  const currentComboKey = componentsSelected
    ? getRlcCaseKey(selectedResistor, selectedInductor, selectedCapacitor)
    : null
  const hasRecordedCombo = observations.some((row) => row.comboKey === currentComboKey)
  const readingCount = observations.length

  // 🎯 STEP PROGRESSION HANDLERS
  const handleWalkthroughComplete = useCallback(() => {
    walkthroughActiveRef.current = false
    setCurrentStep((step) => step === STEPS.WALKTHROUGH ? STEPS.CONNECT : step);
    setStatus('Interface walkthrough completed. Make the connections as per instructions.');
    // 🎙️ "The interface walkthrough is now complete..." then the first
    // connection instruction ("Click and drag the wire from terminal 1...").
    if (!connectionsVerified) playGuideStep(2).then((completed) => { if (completed) playGuideStep(pendingGuideStep) });
  }, [connectionsVerified, pendingGuideStep, playGuideStep]);

  const handleWalkthroughExit = useCallback(() => {
    walkthroughActiveRef.current = false
    setCurrentStep((step) => step === STEPS.WALKTHROUGH ? STEPS.CONNECT : step);
    setStatus('Interface walkthrough exited. Make the connections as per instructions.');
  }, []);

  const recordObservation = () => {
    if (!connectionsVerified) {
      setStatus('Check the circuit connections before adding readings.')
      return
    }
    if (!powerOn) {
      setStatus('Switch on the MCB power supply switch before adding readings.')
      return
    }
    if (normalizedVoltage <= 0) {
      setStatus('Adjust the Variac dial knob to inject voltage before adding a reading.')
      return
    }
    if (readingCount >= MAX_OBSERVATIONS) {
      setStatus(`${MAX_OBSERVATIONS} readings are already recorded. Click reset for a new laboratory run.`)
      showStepAlert(EXPERIMENT_ALERTS.maximumReadingsReached)
      return
    }
    if (!componentsSelected) {
      setStatus('Select the resistor, inductor, and capacitor values before adding a reading.')
      return
    }
    if (hasRecordedCombo) {
      setStatus('This R-L-C combination has already been recorded. Select a different combination to enable Add again.')
      showStepAlert(EXPERIMENT_ALERTS.duplicateRlcCombination)
      return
    }

    const isLastReading = readingCount + 1 >= MAX_OBSERVATIONS
    const verificationJustUnlocked = readingCount + 1 === MIN_VERIFICATION_READINGS

    const nextObservation = {
      id: (observations.at(-1)?.id ?? 0) + 1,
      comboKey: currentComboKey,
      voltage: normalizedVoltage,
      r: Number(selectedResistor),
      l: Number(selectedInductor),
      c: Number(selectedCapacitor),
      nature: rlcCase?.nature ?? '',
      current: Number(readings.current.toFixed(2)),
      vR: Number(readings.vR.toFixed(2)),
      vL: Number(readings.vL.toFixed(2)),
      vC: Number(readings.vC.toFixed(2)),
      // readings.power is already in Watts (see rlcMeterCalibration.js),
      // matching the observation table's "Power (W)" column directly.
      power: Number(readings.power.toFixed(4)),
    }

    setObservations([...observations, nextObservation])
    setReportGenerated(false)

    if (isLastReading) {
      setStatus(`Reading added. All ${MAX_OBSERVATIONS} R-L-C combinations have been recorded.`)
      setCurrentStep(STEPS.CALCULATE);
      scheduleAlert(() => {
        showStepAlert(EXPERIMENT_ALERTS.allReadingsRecorded)
      }, 50)
    } else {
      setStatus(verificationJustUnlocked
        ? `Reading added. Verification is now available; you may also continue up to ${MAX_OBSERVATIONS} readings.`
        : 'Reading added. Select a different R-L-C combination for the next reading; the MCB and autotransformer remain ON.')
      setCurrentStep(verificationJustUnlocked ? STEPS.CALCULATE : STEPS.ADD_READING);
      scheduleAlert(() => {
        const nextReadingNumber = readingCount + 1

        if (nextReadingNumber === 1) {
          showStepAlert(EXPERIMENT_ALERTS.firstReadingAdded)
          return
        }

        if (nextReadingNumber === 2) {
          showStepAlert(EXPERIMENT_ALERTS.secondReadingAdded)
          return
        }

        if (nextReadingNumber === 5) {
          showStepAlert(EXPERIMENT_ALERTS.fifthReadingAdded)
          return
        }

        stopAlertSound()
     
      }, 50)
    }
  }

  const resetSimulation = useCallback(() => {
    clearPendingTimers()
    clearAlerts()
    setPendingGuideStep(3)
    walkthroughActiveRef.current = false
    setPowerOn(false)
    setVoltage(0)
    setR(10)
    setL(0.1)
    setC(0.0001)
    setObservations([])
    setCalculationRows({})
    setVerifiedRows({})
    setIsResistorCorrect(false) 
    setCalculationsVerified(false)
    setHasFailedVerification(false)
    setShowCorrectValues(false)
    setVariacPowered(false)
    setVariacRotated(false)
    setSelectedResistor('')
    setSelectedInductor('')
    setSelectedCapacitor('')
    setReportGenerated(false) 
    setIsModalOpen(false)
    setAutoConnectRequest(0)
    setCheckRequest(0)
    setConnectionsVerified(false)
    setResetRequest((current) => current + 1)
    setSessionStart(Date.now()) 
    voltageLimitWarningShownRef.current = false
    setCurrentStep(STEPS.WALKTHROUGH);
    lastPlayedStepRef.current = null;
    aiGuideEnabledRef.current = false
    setAiGuideEnabled(false)
    stopAiGuideStep()
    setStatus('Simulation completely reset. Remake the Series RLC loops.')
    showAlert({
      title: 'Simulation Reset',
      description: 'The Simulation has been RESET. You can start again.',
      type: 'info',
      icon: '🔄',
      placement: 'center',
      duration: 5000,
      sound: 'reset',
    })
  }, [clearAlerts, clearPendingTimers, showAlert, stopAiGuideStep])

  const handleReset = resetSimulation

  // The learner may create up to five verification rows, but only needs to
  // correctly verify any two distinct observation readings.
  const handleVerifyCalculations = (rowIndex, rowValues, isRowOk, observationIndex, verificationMeta = {}) => {
    // 🚧 INCOMPLETE ROW: the learner tried to verify before filling in
    // every cell in that row. Don't touch report-gate state - nothing was
    // actually submitted for verification yet.
    if (isRowOk === null) {
      if (verificationMeta.validationMessage) {
        setStatus(verificationMeta.validationMessage)
        showAlert({
          title: 'Invalid Verification Value',
          description: verificationMeta.validationMessage,
          type: 'warning',
          icon: '⚠️',
          placement: 'center',
          duration: 6500,
        })
        return
      }

      const calculatedKeys = ['vR', 'vL', 'vC', 'cosPhi', 'power']
      const missingCount = calculatedKeys.filter((key) => rowValues[key] === '').length
      const hasMultipleMissingValues = missingCount > 1

      showAlert({
        title: 'Incomplete Row',
        description: hasMultipleMissingValues
          ? 'Please enter all the calculated values and verify them.'
          : 'Please enter the required calculated value and verify it.',
        type: 'warning',
        icon: '⚠️',
        placement: 'center',
        duration: 4500,
        sound: hasMultipleMissingValues ? 'incompltMultiVal' : 'incompltOneVal',
      })
      return
    }

    const nextCalculationRows = { ...calculationRows, [rowIndex]: rowValues }
    setCalculationRows(nextCalculationRows)

    const nextVerifiedRows = { ...verifiedRows, [observationIndex]: isRowOk === true }
    setVerifiedRows(nextVerifiedRows)

    setStatus(`Reading ${observationIndex + 1} has been submitted for verification.`)

    const verifiedCount = Object.values(nextVerifiedRows).filter(Boolean).length
    const requiredRowsVerified = verifiedCount >= 2
    setIsResistorCorrect(requiredRowsVerified)
    setCalculationsVerified(requiredRowsVerified)
    if (isRowOk === true) {

  setCurrentStep(
    requiredRowsVerified ? STEPS.GENERATE_REPORT : STEPS.CALCULATE
  );

  setStatus('Verified');

  showStepAlert(EXPERIMENT_ALERTS.calculationsVerified);
}
    else if (isRowOk === false) {
      setHasFailedVerification(true)
      const hasMultipleIncorrectValues = verificationMeta.incorrectCount > 1
      showAlert({
        title: 'Verification Failed',
        description: hasMultipleIncorrectValues
          ? 'Verification failed. The highlighted values are incorrect. Please recheck your calculations and verify again.'
          : 'Verification failed. The highlighted value is incorrect. Please review your calculation and verify again.',
        type: 'error',
        icon: '❌',
        placement: 'center',
        duration: 8000,
        sound: hasMultipleIncorrectValues ? 'incorrCalc' : 'incorrCalCR',
      })
    }
  }
 
  const handlePrint = () => {
    window.print()
  }

  // const handleGenerateReport = () => {
  //   if (readingCount < MIN_REPORT_READINGS) {
  //     const remainingReadings = MIN_REPORT_READINGS - readingCount
  //     setStatus(`Add ${remainingReadings} more reading(s) before generating the experiment report.`)
  //     return
  //   }

  //   if (!calculationsVerified) {
  //     setStatus('Correctly verify any two observation readings before generating the report.')
  //     return
  //   }

  //   const reportWindow = generateRlcReport({
  //     observations,
  //     parameters: { r, l, c },
  //     theoreticalCalculations: Object.values(calculationRows),
  //     sessionStart,
  //   })

  //   if (!reportWindow) {
  //     setStatus('Unable to open the report window.')
  //     showAlert({
  //       title: 'Popup Blocked',
  //       description: 'Unable to open the report window. Please allow pop-ups and try again.',
  //       type: 'error',
  //       icon: '❌',
  //       placement: 'center',
  //       duration: 5000,
  //     })
  //     return
  //   }

  //   window.focus()
  //   setReportGenerated(true)
  //   setStatus('RLC Experiment report generated successfully from metrics and observations.')
  //   scheduleAlert(() => {
  //     showAlert({
  //       title: 'Report Generated',
  //       description: 'Your report has been generated successfully. Click OK to view your report.',
  //       type: 'success',
  //       icon: '✅',
  //       placement: 'center',
  //       requiresConfirmation: true,
  //       confirmLabel: 'OK',
  //       sound: 'genRepBtnClick',
  //     })
  //   }, 50)
  // }
const handleGenerateReport = () => {
  if (readingCount < MIN_REPORT_READINGS) {
    const remainingReadings = MIN_REPORT_READINGS - readingCount
    setStatus(
      `Add ${remainingReadings} more reading(s) before generating the experiment report.`
    )
    return
  }

  if (!calculationsVerified) {
    setStatus(
      'Correctly verify any two observation readings before generating the report.'
    )
    return
  }

  showAlert({
    title: 'Report Generated',
    description:
      'Your report has been generated successfully. Click OK to view your report.',
    type: 'success',
    icon: '✅',
    placement: 'center',
    requiresConfirmation: true,
    confirmLabel: 'OK',
    sound: 'genRepBtnClick',

    onConfirm: () => {
      const reportWindow = generateRlcReport({
        observations,
        parameters: { r, l, c },
        theoreticalCalculations: Object.values(calculationRows),
        sessionStart,
      })

      if (!reportWindow) {
        setStatus('Unable to open the report window.')

        showAlert({
          title: 'Popup Blocked',
          description:
            'Unable to open the report window. Please allow pop-ups and try again.',
          type: 'error',
          icon: '❌',
          placement: 'center',
          duration: 5000,
        })

        return
      }

      setReportGenerated(true)
      setStatus(
        'RLC Experiment report generated successfully from metrics and observations.'
      )
    },
  })
}
  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(contentHeight * scale)
  
const handleCheckConnections = useCallback((result, options = {}) => {
  const { silent = false } = options

  const wrongCount = Number(result?.incorrectCount || 0)
  const missingCount = Number(result?.missingCount || 0)

  // Remove words like "endpoint" / "terminal" and keep only terminal numbers.
  // Example: endpoint-1-endpoint-23 -> 1-23
  const formatConnection = (connection) => {
    const numbers = String(connection).match(/\d+/g)

    if (!numbers || numbers.length < 2) {
      return connection
    }

    return `${numbers[0]}-${numbers[1]}`
  }

  const wrongConnections =
    Array.isArray(result?.wrongConnections)
      ? result.wrongConnections.map(formatConnection)
      : []

  const missingConnections =
    Array.isArray(result?.missingConnections)
      ? result.missingConnections.map(formatConnection)
      : []

  // =====================================================
  // ALL CONNECTIONS CORRECT
  // =====================================================

  if (result?.isCorrect) {
    setConnectionsVerified(true)
    setCurrentStep(STEPS.POWER_ON)

    setStatus(
      'Right connections! Turn ON the MCB, then select the resistor, inductor, and capacitor values.'
    )

    if (!silent) {
      showStepAlert(EXPERIMENT_ALERTS.connectionsVerified)
    }

    return
  }

  // =====================================================
  // INCOMPLETE / INCORRECT
  // =====================================================

  setConnectionsVerified(false)

  const sections = []

  // Wrong connections
  if (wrongCount > 0) {
    sections.push(
      `Wrong connections: ${wrongCount}\n` +
      `${wrongConnections.length > 0
        ? wrongConnections.join(', ')
        : '—'}`
    )
  }

  // Missing connections
  sections.push(
    `Missing connections: ${missingCount}\n` +
    `${missingConnections.length > 0
      ? missingConnections.join(', ')
      : 'None'}`
  )

  // =====================================================
  // NEXT 2–3 CORRECT CONNECTIONS
  // =====================================================

  

  const description = sections.join('\n\n')

  // =====================================================
  // STATUS
  // =====================================================

  if (wrongCount > 0) {
    setStatus(
      `${wrongCount} wrong connection(s) and ${missingCount} missing connection(s) found.`
    )
  } else {
    setStatus(
      `${missingCount} connection(s) are still missing.`
    )
  }

  // =====================================================
  // ALERT
  // =====================================================

  if (!silent) {
    showAlert({
      title:
        wrongCount > 0
          ? 'Connection Error Found'
          : 'Incomplete Connections',

      description,
      type: 'warning',
      icon: '⚠️',
      placement: 'center',
      duration: 12000,
      sound: wrongCount > 0 ? 'wrongConn' : null,
    })
  }
}, [showAlert, showStepAlert])
  const handleCheck = () => {
    setCheckRequest((current) => current + 1)
  }

  const handleConnectionReadinessChange = useCallback((isReady) => {
    if (!connectionsVerified) {
      setCurrentStep(isReady ? STEPS.CHECK : STEPS.CONNECT)
    }
  }, [connectionsVerified])
  

  const handleTogglePower = () => {
    if (!powerOn && !connectionsVerified) {
      setStatus('Check the series circuit connections before switching on the power supply.')
      showAlert({
        title: 'Action Required',
        description: 'Make and check the connections before turning ON the MCB.',
        type: 'warning',
        icon: '⚠️',
        placement: 'center',
        requiresConfirmation: true,
        confirmLabel: 'OK',
        sound: 'mcbAlert',
      })
      return
    }

    if (powerOn) {
      setStatus('The MCB remains ON for this laboratory run. Use Reset to start over.')
      return
    }

    setPowerOn(true)
    setCurrentStep(STEPS.SELECT_COMPONENTS);
    setStatus('MCB switched ON. Select the resistor, inductor, and capacitor values, then turn ON the autotransformer.')
    scheduleAlert(() => {
      showStepAlert(EXPERIMENT_ALERTS.mcbOn)
    }, 50)
  }

  // 🎯 COMPONENT VALUE SELECTION HANDLERS
  // Fired when the learner picks a value from the resistor / inductor /
  // capacitor dropdowns. They become available after the MCB is ON and must
  // all be set before the autotransformer can be switched ON.
  const advanceWhenComponentsSelected = useCallback((nextResistor, nextInductor, nextCapacitor) => {
    if (powerOn && nextResistor && nextInductor && nextCapacitor) {
      const readingIsReady = voltage >= 30
      const nextComboKey = getRlcCaseKey(nextResistor, nextInductor, nextCapacitor)
      const combinationAlreadyRecorded = observations.some((row) => row.comboKey === nextComboKey)

      if (readingIsReady && combinationAlreadyRecorded) {
        setStatus('This RLC combination is already in the table. Select a different combination to enable Add.')
        showStepAlert(EXPERIMENT_ALERTS.duplicateRlcCombination)
        return
      }

      setCurrentStep(readingIsReady ? STEPS.ADD_READING : (variacPowered ? STEPS.SET_VOLTAGE : STEPS.VARIAC_ON))
      setStatus(readingIsReady
        ? 'New R-L-C reading selected. Click Add to record it.'
        : variacPowered
          ? 'Component values selected. Click the Variac knob to set it to 30 V.'
          : 'Component values selected. Now switch ON the autotransformer.')
      if (readingIsReady) {
         const nextReadingNumber = observations.length + 1

        // Show "New RLC Value Selected" only before readings 1 and 2.
        // After 2 readings, no normal RLC-selection alerts should appear.
        if (nextReadingNumber <= 2) {
          showStepAlert(EXPERIMENT_ALERTS.newRlcValueSelected)
        }
      } else if (variacPowered) {
        showStepAlert(EXPERIMENT_ALERTS.autotransformerOn)
      } else {
        showStepAlert(EXPERIMENT_ALERTS.componentValuesSelected)
      }
    }
  }, [observations, powerOn, showStepAlert, variacPowered, voltage])

  const handleResistorValueChange = useCallback((value) => {
    setSelectedResistor(value)
    const numericValue = Number(value)
    if (Number.isFinite(numericValue) && numericValue > 0) {
      setR(numericValue * 1000) // kΩ -> Ω
    }
    advanceWhenComponentsSelected(value, selectedInductor, selectedCapacitor)
  }, [advanceWhenComponentsSelected, selectedInductor, selectedCapacitor])

  const handleInductorValueChange = useCallback((value) => {
    setSelectedInductor(value)
    const numericValue = Number(value)
    if (Number.isFinite(numericValue) && numericValue > 0) {
      setL(numericValue) // H
    }
    advanceWhenComponentsSelected(selectedResistor, value, selectedCapacitor)
  }, [advanceWhenComponentsSelected, selectedResistor, selectedCapacitor])

  const handleCapacitorValueChange = useCallback((value) => {
    setSelectedCapacitor(value)
    const numericValue = Number(value)
    if (Number.isFinite(numericValue) && numericValue > 0) {
      setC(numericValue * 1e-6) // µF -> F
    }
    advanceWhenComponentsSelected(selectedResistor, selectedInductor, value)
  }, [advanceWhenComponentsSelected, selectedResistor, selectedInductor])

  const handleVariacBlocked = useCallback(() => {
    setStatus('Turn ON the MCB and select the R, L, and C values before using the autotransformer.')
    showStepAlert(EXPERIMENT_ALERTS.autotransformerNotReady)
  }, [showStepAlert])

  const handleVariacOn = useCallback(() => {
    setVariacPowered(true)
    setCurrentStep(STEPS.SET_VOLTAGE)
    setStatus('Autotransformer is ON. Click the Variac knob to rotate it to the 30 V position.')
    showStepAlert(EXPERIMENT_ALERTS.autotransformerOn)
  }, [showStepAlert])

  // The Add button unlocks when the autotransformer supplies the selected
  // reading. It is locked again for that combination after the row is added.
  const handleVariacRotate = useCallback(() => {
    setVariacRotated(true)
    setStatus('Variac set to 30 V. The selected reading is ready to add.')
  }, [])

  const handleAutoConnect = () => {
    setAutoConnectRequest((current) => current + 1)
    setStatus('Autoconnect completed. Now turn ON the MCB by clicking the MCB lever.')
    scheduleAlert(() => {
      showAlert({
        title: 'Autoconnect Completed',
        description: 'Autoconnect completed. Now turn ON the MCB by clicking the MCB lever.',
        type: 'info',
        icon: '🔌',
        placement: 'center',
        duration: 5000,
        sound: 'autoConnectNarration',
      })
    }, 150)
  }

  const handleVoltageChange = useCallback((nextVoltage) => {
    setVoltage(nextVoltage)
    if (!powerOn || nextVoltage <= 0) {
      if (nextVoltage < VOLTAGE_SAFETY_RESET) {
        voltageLimitWarningShownRef.current = false
      }
      return
    }
    // ⚠️ Show the safety warning only while approaching (not yet at) the
    // maximum — and, crucially, don't return early, so a knob movement that
    // jumps straight to 30V in one go still reaches the check below and
    // plays the "voltage set to 30V" cue.
    if (nextVoltage >= VOLTAGE_SAFETY_LIMIT && nextVoltage < 30 && !voltageLimitWarningShownRef.current) {
      voltageLimitWarningShownRef.current = true
      setStatus(`Warning: ${nextVoltage.toFixed(1)} V is approaching safety thresholds.`)
    }
    if (nextVoltage < VOLTAGE_SAFETY_RESET) {
      voltageLimitWarningShownRef.current = false
    }
    if (nextVoltage >= 30 && currentStep < STEPS.ADD_READING) {
      voltageLimitWarningShownRef.current = true
      setCurrentStep(STEPS.ADD_READING);

      scheduleAlert(() => {
        showStepAlert(EXPERIMENT_ALERTS.voltageSet)
      }, 50)
    }
  }, [powerOn, currentStep, scheduleAlert, showStepAlert])

  // 🎯 STEP HIGHLIGHTING HELPERS
  const isStepActive = (stepNumber) => derivedStep === stepNumber;
  const isStepCompleted = (stepNumber) => derivedStep > stepNumber;

  return (
    <WalkthroughProvider 
      key={resetRequest}
      onComplete={handleWalkthroughComplete}
      onExit={handleWalkthroughExit}
      onStart={handleWalkthroughStart}
    >
    <div id="app-wrapper">
      <div
        id="app-viewport"
        style={{
          height: `${scaledHeight}px`,
          width: `${scaledWidth}px`,
        }}
      >
        <div
          id="app-scale"
          ref={contentRef}
          style={{
            '--app-render-scale': renderScale,
            '--app-composite-scale': scale / renderScale,
            '--instructions-available-height': `${Math.max(400, (viewportHeight / scale) - 390)}px`,
          }}
        >
          <main className="simulation-shell" id="walkthrough-demo-experiment">
            <HeaderBoard />
            <WalkthroughStartButton
              highlighted={aiGuideEnabled && activeAiGuideStepId === 1}
            />

            <span className="sr-only" role="status" aria-live="polite">{status}</span>

            <section className={`workspace-grid ${isModalOpen ? 'workspace-grid--instructions-open' : ''}`}>
              <aside className="left-panel">
                <ActionButtons
                  aiGuideActive={aiGuideEnabled}
                  correctValuesOpen={showCorrectValues}
                  disabledButtons={{
                    onAdd: !connectionsVerified
                      || !powerOn
                      || !componentsSelected
                      || !variacRotated
                      || (hasRecordedCombo && readingCount < MAX_OBSERVATIONS),
                    onAutoConnect: connectionsVerified || powerOn,
                    onCheck: connectionsVerified,
                    onPrint: false,
                    onCorrectValues: !hasFailedVerification,
                    onInstruction: false,
                  }}
                  onAdd={recordObservation}
                  onAiGuide={handleAiGuide}
                  onCheck={handleCheck}
                  onPrint={handlePrint}
                  onCorrectValues={() => {
                    if (hasFailedVerification) setShowCorrectValues((isOpen) => !isOpen)
                  }}
                  onReset={handleReset}
                  onAutoConnect={handleAutoConnect}
                  onInstruction={() => setIsModalOpen(true)}
                  currentStep={derivedStep}
                />

                <div className="panel-content-wrapper">
                  <ControlPanel
                    observations={observations}
                    showCorrectValues={showCorrectValues}
                    onCloseCorrectValues={() => {
                      setShowCorrectValues(false)
                      document.getElementById('correct-values-button')?.focus({ preventScroll: true })
                    }}
                  />

                  {isModalOpen && (
                    <div
                      className="instructions-overlay-panel"
                      ref={instructionsDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="instructions-dialog-title"
                    >
                      <div className="instructions-header">
                        <span id="instructions-dialog-title">INSTRUCTIONS</span>
                        <button 
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="instructions-close"
                          aria-label="Close instructions"
                          data-autofocus
                        >
                          &times;
                        </button>
                      </div>
                      
                      <div className="instructions-body">
                        <p className={isStepActive(STEPS.CONNECT) ? 'instruction-step-active' : (isStepCompleted(STEPS.CONNECT) ? 'instruction-step-completed' : '')}>
                          <strong>Step 1:</strong> Make connections as per the instructions given below.
                        </p>
                        
                        <div className="instructions-connection-box">
                          {`1-23, 2-24\n3-25, 4-26\n5-25, 6-9, 6-10, 8-17\n11-17, 12-18\n13-19, 14-20\n15-21, 16-22\n18-19, 20-21\n22-26, 26-7`}
                        </div>

                        <p className="instructions-note"><strong>Note:</strong> If a wire is connected incorrectly, click the corresponding label number to remove the connection.</p>
                        
                        <p className={isStepActive(STEPS.CHECK) ? 'instruction-step-active' : (isStepCompleted(STEPS.CHECK) ? 'instruction-step-completed' : '')}>
                          <strong>Step 2:</strong> Now, Check the connections by clicking on <strong>'CHECK'</strong> button.
                        </p>
                        <p className="instructions-indent">If the connections are 'Invalid connections' click on corresponding node to remove the connection.</p>
                        <p className="instructions-indent">And if the connections are 'Right Connections' then follow the below steps.</p>
                        
                        <p className={isStepActive(STEPS.POWER_ON) ? 'instruction-step-active' : (isStepCompleted(STEPS.POWER_ON) ? 'instruction-step-completed' : '')}>
                          <strong>Step 3:</strong> Turn on the MCB.
                        </p>

                        <p className={isStepActive(STEPS.SELECT_COMPONENTS) ? 'instruction-step-active' : (isStepCompleted(STEPS.SELECT_COMPONENTS) ? 'instruction-step-completed' : '')}>
                          <strong>Step 4:</strong> Select the resistor, inductor, and capacitor values from their dropdowns.
                        </p>
                        
                        <p className={isStepActive(STEPS.VARIAC_ON) ? 'instruction-step-active' : (isStepCompleted(STEPS.VARIAC_ON) ? 'instruction-step-completed' : '')}>
                          <strong>Step 5:</strong> Switch on the autotransformer.
                        </p>
                        
                        <p className={isStepActive(STEPS.SET_VOLTAGE) ? 'instruction-step-active' : (isStepCompleted(STEPS.SET_VOLTAGE) ? 'instruction-step-completed' : '')}>
                          <strong>Step 6:</strong> Click the <strong>Variac knob</strong> to rotate it to the 30 V position.
                        </p>
                        
                        <p className={isStepActive(STEPS.ADD_READING) ? 'instruction-step-active' : (isStepCompleted(STEPS.ADD_READING) ? 'instruction-step-completed' : '')}>
                          <strong>Step 7:</strong> Click <strong>'ADD'</strong> to record the reading. Choose another R-L-C combination and repeat.
                        </p>
                        
                        <p className={isStepActive(STEPS.CALCULATE) ? 'instruction-step-active' : (isStepCompleted(STEPS.CALCULATE) ? 'instruction-step-completed' : '')}>
                          <strong>Step 8:</strong> After five readings, select a recorded reading, calculate the theoretical values, and click <strong>Verify</strong>. V and I (mA) are prefilled.
                        </p>

                        <p className={isStepActive(STEPS.GENERATE_REPORT) ? 'instruction-step-active' : ''}>
                          <strong>Step 9:</strong> After verifying two readings successfully, click <strong>Generate Report</strong>.
                        </p>
                      </div>
                      
                      <div className="instructions-footer">
                        <button type="button" onClick={() => setIsModalOpen(false)}>Close</button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              <section className="right-panel">
                <ConnectionLab
                  aiGuide={{ playStep: playGuideStep, stop: stopAiGuideStep }}
                  onPendingGuideStep={setPendingGuideStep}
                  aiGuideActiveStepId={aiGuideEnabled ? activeAiGuideStepId : null}
                  autoConnectRequest={autoConnectRequest}
                  checkRequest={checkRequest}
                  onCheckConnections={handleCheckConnections}
                  onConnectionReadinessChange={handleConnectionReadinessChange}
                  onVariacBlocked={handleVariacBlocked}
                  onVariacOn={handleVariacOn}
                  onVariacRotate={handleVariacRotate}
                  powerOn={powerOn}
                  connectionsVerified={connectionsVerified}
                  componentsSelected={componentsSelected}
                  selectedResistor={selectedResistor}
                  selectedInductor={selectedInductor}
                  selectedCapacitor={selectedCapacitor}
                  onResistorChange={handleResistorValueChange}
                  onInductorChange={handleInductorValueChange}
                  onCapacitorChange={handleCapacitorValueChange}
                  r1={r} 
                  r2={l} 
                  r3={c} 
                  readings={readings}
                  resetRequest={resetRequest}
                  scale={scale}
                  onTogglePower={handleTogglePower}
                  setVoltage={handleVoltageChange}
                  isResistorCorrect={isResistorCorrect}
                  currentStep={derivedStep}
                />
              </section>
            </section>

            <ReportControls
              graphGenerated={true} 
              minReadings={MIN_REPORT_READINGS}
              onGenerateReport={handleGenerateReport}
              readingCount={readingCount}
              reportGenerated={reportGenerated}
              currentStep={derivedStep}
              calculationsVerified={calculationsVerified}
            />
          </main>

          <GraphPanel
            className="graph-panel--separate"
            id="graph-panel"
            onVerify={handleVerifyCalculations}
            onDraftChange={handleDraftChange}
            currentStep={derivedStep}
            resetRequest={resetRequest}
            observations={observations}
            minReadings={MIN_VERIFICATION_READINGS}
          />

          <footer className="experiment-footer">
            <span>© 2026 Virtual Labs, IIT Roorkee</span>
          </footer>
        </div>
      </div>
    </div>
    </WalkthroughProvider>
  )
}

export default App
