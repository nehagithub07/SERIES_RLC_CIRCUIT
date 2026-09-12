import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './ConnectionEndpoints.css'
import ActionButtons from './components/ActionButtons.jsx'
import ConnectionLab from './components/ConnectionLab.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import GraphPanel from './components/GraphPanel.jsx'
import HeaderBoard from './components/HeaderBoard.jsx'
import ReportControls from './components/ReportControls.jsx' 
import { useLabAlerts } from './alerts/useLabAlerts.js'
import { generateRlcReport } from './utils/reportGenerator.js' 
import WalkthroughProvider from './walkthrough/WalkthroughProvider.jsx'
import WalkthroughStartButton from './walkthrough/components/WalkthroughStartButton.jsx'
import { useAiGuideNarration } from './aiGuide/useAiGuideNarration.js'
import { stopAlertSound } from './utils/alertAudioManager.js'
import { getRlcMeterCase, getNeedleAngle, getRlcCaseKey } from './utils/rlcMeterCalibration.js'

// Base Layout Canvas Dimension Constants
const BASE_WIDTH = 1440
const BASE_HEIGHT = 1260
const GRAPH_SECTION_GAP = 24
const GRAPH_SECTION_HEIGHT = 380 
const CONTENT_HEIGHT = BASE_HEIGHT + GRAPH_SECTION_GAP + GRAPH_SECTION_HEIGHT
const PANEL_MAX_SCALE = 0.9
const PANEL_VIEWPORT_MARGIN = 24
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
  const widthScale = (window.innerWidth - PANEL_VIEWPORT_MARGIN) / BASE_WIDTH
  return Math.max(Math.min(widthScale, PANEL_MAX_SCALE), 0.1)
}

// Keep at least two physical source pixels behind every visual CSS pixel.
// Standard-density screens get a 2x backing layer; high-DPR displays already
// provide that density natively. The final visual scale remains unchanged.
const getRenderScale = () => {
  if (typeof window === 'undefined') return 1
  const dpr = Math.max(Number(window.devicePixelRatio) || 1, 0.5)
  return Math.min(3, Math.max(1, Math.ceil(2 / dpr)))
}

const App = () => {
  const { confirmAlert, showAlert } = useLabAlerts()
  const [scale, setScale] = useState(getScale)
  const [renderScale, setRenderScale] = useState(getRenderScale)
  
  const [r, setR] = useState(10)
  const [l, setL] = useState(0.1)
  const [c, setC] = useState(0.0001)
  const [voltage, setVoltage] = useState(0)
  const [powerOn, setPowerOn] = useState(false)
  const [observations, setObservations] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false) 
  
  const [theoreticalCalculations, setTheoreticalCalculations] = useState(null)
  const [calculationRows, setCalculationRows] = useState({})
  const [verifiedRows, setVerifiedRows] = useState({})
  const [isResistorCorrect, setIsResistorCorrect] = useState(false) 
  const [calculationsVerified, setCalculationsVerified] = useState(false)
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

  // 🎯 STEP TRACKING STATE
  const [currentStep, setCurrentStep] = useState(STEPS.WALKTHROUGH);
  const lastPlayedStepRef = useRef(null);
  const [aiGuideEnabled, setAiGuideEnabled] = useState(false)
  const aiGuideEnabledRef = useRef(false)

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
    if (!aiGuideEnabledRef.current) {
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
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 🖨️ PRINT FIT: shrink the whole simulation stage so it always lands on a
  // single printed page with nothing cropped, regardless of how much content
  // (observations, calculations, graph) is currently visible.
  useEffect(() => {
    // Conservative printable area shared by common landscape paper sizes
    // (A4 / Letter) after the @page margins defined in App.css.
    const PRINTABLE_WIDTH_MM = 279.4
    const PRINTABLE_HEIGHT_MM = 210
    const PAGE_MARGIN_X_MM = 8
    const PAGE_MARGIN_Y_MM = 6
    const MM_TO_PX = 96 / 25.4

    const availableWidthPx = (PRINTABLE_WIDTH_MM - PAGE_MARGIN_X_MM * 2) * MM_TO_PX
    const availableHeightPx = (PRINTABLE_HEIGHT_MM - PAGE_MARGIN_Y_MM * 2) * MM_TO_PX

    const applyPrintFit = () => {
      const stage = document.getElementById('app-scale')
      if (!stage) return

      // Reset any previous print zoom so we measure the natural content size.
      stage.style.removeProperty('zoom')

      const naturalWidth = stage.scrollWidth || BASE_WIDTH
      const naturalHeight = stage.scrollHeight || CONTENT_HEIGHT

      const fitScale = Math.min(
        availableWidthPx / naturalWidth,
        availableHeightPx / naturalHeight,
        1,
      )

      stage.style.setProperty('zoom', `${(fitScale * 100).toFixed(2)}%`, 'important')
    }

    const clearPrintFit = () => {
      document.getElementById('app-scale')?.style.removeProperty('zoom')
    }

    window.addEventListener('beforeprint', applyPrintFit)
    window.addEventListener('afterprint', clearPrintFit)

    return () => {
      window.removeEventListener('beforeprint', applyPrintFit)
      window.removeEventListener('afterprint', clearPrintFit)
    }
  }, [])

  // 🎯 DERIVED STEP STATUS
  const derivedStep = useMemo(() => {
    if (currentStep === STEPS.WALKTHROUGH) return STEPS.WALKTHROUGH;
    if (!connectionsVerified) return STEPS.CONNECT;
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
      [STEPS.CONNECT]: 3,
      [STEPS.CHECK]: 22,
      [STEPS.POWER_ON]: 29,
      [STEPS.SELECT_COMPONENTS]: 30,
      [STEPS.VARIAC_ON]: 30,
      [STEPS.SET_VOLTAGE]: 31,
      [STEPS.ADD_READING]: 32,
      [STEPS.CALCULATE]: 36,
      [STEPS.GENERATE_REPORT]: 35,
    }

    aiGuideEnabledRef.current = true
    setAiGuideEnabled(true)
    stopAlertSound()
    setStatus('AI Guide is ON and will narrate the current experiment steps. Click AI Guide again to turn it OFF.')
    playAiGuideStep(stepByPhase[derivedStep] ?? 1)
  }, [derivedStep, playAiGuideStep, stopAiGuideStep])

  const handleWalkthroughStart = useCallback(() => {
    // The walkthrough owns its popup narration and must not share playback
    // state with either the AI Guide or lab-alert audio.
    stopAiGuideStep()
    stopAlertSound()
  }, [stopAiGuideStep])

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
    setCurrentStep(STEPS.CONNECT);
    setStatus('Interface walkthrough completed. Make the connections as per instructions.');
    // 🎙️ "The interface walkthrough is now complete..." then the first
    // connection instruction ("Click and drag the wire from terminal 1...").
    playGuideStep(2).then(() => playGuideStep(3));
  }, [playGuideStep]);

  const handleWalkthroughExit = useCallback(() => {
    setCurrentStep(STEPS.CONNECT);
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
      showAlert({
        title: 'All Readings Recorded',
        description: `All ${MAX_OBSERVATIONS} readings are already in the observation table.`,
        type: 'info',
        icon: '📊',
        duration: 5000,
        sound: 'afterReadAddClick',
      })
      return
    }
    if (!componentsSelected) {
      setStatus('Select the resistor, inductor, and capacitor values before adding a reading.')
      return
    }
    if (hasRecordedCombo) {
      setStatus('This R-L-C combination has already been recorded. Select a different combination to enable Add again.')
      showAlert({
        title: 'Reading Already Added',
        description: 'This R-L-C combination is already in the table. Select a different combination.',
        type: 'warning',
        icon: '⚠️',
        duration: 5500,
        sound: 'afterReadAddClick',
      })
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
      window.setTimeout(() => {
        showAlert({
          title: 'All Readings Recorded',
          description: `You have added all ${MAX_OBSERVATIONS} readings. Select a reading in the verification section and enter its observation-table values exactly.`,
          type: 'success',
          icon: '📊',
          placement: 'top-right',
          duration: 15000,
          sound: 'afterReadAddClick',
        })
      }, 50)
    } else {
      setStatus(verificationJustUnlocked
        ? `Reading added. Verification is now available; you may also continue up to ${MAX_OBSERVATIONS} readings.`
        : 'Reading added. Select a different R-L-C combination for the next reading; the MCB and autotransformer remain ON.')
      setCurrentStep(verificationJustUnlocked ? STEPS.CALCULATE : STEPS.ADD_READING);
      window.setTimeout(() => {
        showAlert({
          title: verificationJustUnlocked ? 'Verification Unlocked' : 'Reading Added',
          description: verificationJustUnlocked
            ? `Reading ${readingCount + 1} of ${MAX_OBSERVATIONS} was added. The verification section is now enabled, and you may continue recording the remaining combinations.`
            : `Reading ${readingCount + 1} of ${MAX_OBSERVATIONS} was added. Select a different R-L-C combination to enable Add again. The MCB and autotransformer will remain ON.`,
          type: 'success',
          icon: '✅',
          placement: 'top-right',
          duration: 14000,
          sound: readingCount === 0 ? 'firstReadAdded' : 'afterReadAddClick',
        })
      }, 50)
    }
  }

  const resetSimulation = useCallback(() => {
    setPowerOn(false)
    setVoltage(0)
    setR(10)
    setL(0.1)
    setC(0.0001)
    setObservations([])
    setTheoreticalCalculations(null)
    setCalculationRows({})
    setVerifiedRows({})
    setIsResistorCorrect(false) 
    setCalculationsVerified(false)
    setVariacPowered(false)
    setVariacRotated(false)
    setSelectedResistor('')
    setSelectedInductor('')
    setSelectedCapacitor('')
    setReportGenerated(false) 
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
  }, [showAlert, stopAiGuideStep])

  const handleReset = async () => {
    const confirmed = await confirmAlert({
      title: 'All Readings and Connections Will Be Cleared',
      description: 'Confirm reset before the current table and circuit are cleared.',
      type: 'warning',
      icon: '⚠️',
    })
    if (confirmed) {
      resetSimulation()
    }
  }

  // The learner may create up to five verification rows, but only needs to
  // correctly verify any two distinct observation readings.
  const handleVerifyCalculations = (rowIndex, rowValues, isRowOk, observationIndex, verificationMeta = {}) => {
    // 🚧 INCOMPLETE ROW: the learner tried to verify before filling in
    // every cell in that row. Don't touch report-gate state - nothing was
    // actually submitted for verification yet.
    if (isRowOk === null) {
      const calculatedKeys = ['vR', 'vL', 'vC', 'cosPhi', 'power']
      const missingCount = calculatedKeys.filter((key) => rowValues[key] === '').length
      const hasMultipleMissingValues = missingCount > 1

      showAlert({
        title: 'Incomplete Row',
        description: `Please fill in every value in row ${rowIndex + 1} before verifying it.`,
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

    setTheoreticalCalculations(
      Array.from({ length: 5 }, (_, i) => nextCalculationRows[i] || null)
    )
    setStatus(`Reading ${observationIndex + 1} has been submitted for verification.`)

    const verifiedCount = Object.values(nextVerifiedRows).filter(Boolean).length
    const requiredRowsVerified = verifiedCount >= 2
    setIsResistorCorrect(requiredRowsVerified)
    setCalculationsVerified(requiredRowsVerified)

    if (requiredRowsVerified) {
      setCurrentStep(STEPS.GENERATE_REPORT);
      showAlert({
        title: 'Success',
        description: 'Two observation readings have been verified correctly. Your simulation is now complete. You may generate the report.',
        type: 'success',
        icon: '✅',
        placement: 'center',
        duration: 13000,
        sound: 'afterCorrVerif',
      })
    } else if (isRowOk === false) {
      const hasMultipleIncorrectValues = verificationMeta.incorrectCount > 1
      showAlert({
        title: 'Verification Failed',
        description: `Row ${rowIndex + 1} does not match the selected observation-table reading. Correct the highlighted values and verify again.`,
        type: 'error',
        icon: '❌',
        placement: 'center',
        duration: 8000,
        sound: hasMultipleIncorrectValues ? 'incorrCalcMulti' : 'incorrCalcOne',
      })
    }
  }
 
  const handlePrint = () => {
    setStatus('Preparing laboratory worksheet layout for printing...')
    showAlert({
      title: 'Print',
      description: 'Opening the print dialog.',
      type: 'info',
      icon: '🖨️',
      duration: 2500,
      sound: 'print',
    })
    window.setTimeout(() => window.print(), 150)
  }

  const handleGenerateReport = () => {
    if (readingCount < MIN_REPORT_READINGS) {
      const remainingReadings = MIN_REPORT_READINGS - readingCount
      setStatus(`Add ${remainingReadings} more reading(s) before generating the experiment report.`)
      return
    }

    if (!calculationsVerified) {
      setStatus('Correctly verify any two observation readings before generating the report.')
      return
    }

    const reportWindow = generateRlcReport({
      observations,
      parameters: { r, l, c },
      theoreticalCalculations,
      sessionStart,
    })

    if (!reportWindow) {
      setStatus('Unable to open the report window.')
      showAlert({
        title: 'Popup Blocked',
        description: 'Unable to open the report window. Please allow pop-ups and try again.',
        type: 'error',
        icon: '❌',
        placement: 'center',
        duration: 5000,
      })
      return
    }

    window.focus()
    setReportGenerated(true)
    setStatus('RLC Experiment report generated successfully from metrics and observations.')
    window.setTimeout(() => {
      showAlert({
        title: 'Report Generated',
        description: 'Your report has been generated successfully. Click OK to view your report.',
        type: 'success',
        icon: '✅',
        placement: 'center',
        requiresConfirmation: true,
        confirmLabel: 'OK',
        sound: 'genRepBtnClick',
      })
    }, 50)
  }

  const scaledWidth = Math.ceil(BASE_WIDTH * scale)
  const scaledHeight = Math.ceil(CONTENT_HEIGHT * scale)
  
  const handleCheckConnections = useCallback((result, options = {}) => {
    const { silent = false } = options

    if (result.totalConnections === 0) {
      setConnectionsVerified(false)
      setStatus('Please make the circuit node connections first.')
      if (!silent) {
        showAlert({
          title: 'Alert',
          description: 'Please make the required connections as per the given instructions.',
          type: 'warning',
          icon: '⚠️',
          placement: 'center',
          duration: 6000,
          sound: 'firstCheck',
        })
      }
      return
    }

    if (result.isCorrect) {
      setConnectionsVerified(true)
      setCurrentStep(STEPS.POWER_ON);
      setStatus('Right connections! Turn ON the MCB, then select the resistor, inductor, and capacitor values.')
      if (!silent) {
        showAlert({
          title: 'Connections Verified',
          description: 'Connections verified successfully. Turn ON the MCB, then select the resistor, inductor, and capacitor values.',
          type: 'success',
          icon: '✅',
          placement: 'center',
          duration: 7000,
          sound: 'forCorrConnCheckClick',
        })
      }
      return
    }

    setConnectionsVerified(false)
    setStatus(`Invalid connections. Correct matched points: ${result.matchedCount}; total wires: ${result.totalConnections}.`)
    if (!silent) {
      showAlert({
        title: 'Connection Error Found',
        description: 'Wrong connections detected. Please recheck your wiring against the circuit diagram.',
        type: 'warning',
        icon: '⚠️',
        placement: 'center',
        duration: 6000,
        sound: 'multiWrong',
      })
    }
  }, [showAlert])

  const handleCheck = () => {
    setCheckRequest((current) => current + 1)
  }
  

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
    window.setTimeout(() => {
      showAlert({
        title: 'MCB Turned ON',
        description: 'MCB is ON. Select the resistor, inductor, and capacitor values, then click the autotransformer power button.',
        type: 'success',
        icon: '⚡',
        placement: 'top-right',
        duration: 7000,
        sound: 'mcbOn',
      })
    }, 50)
  }

  // 🎯 COMPONENT VALUE SELECTION HANDLERS
  // Fired when the learner picks a value from the resistor / inductor /
  // capacitor dropdowns. They become available after the MCB is ON and must
  // all be set before the autotransformer can be switched ON.
  const advanceWhenComponentsSelected = useCallback((nextResistor, nextInductor, nextCapacitor) => {
    if (powerOn && nextResistor && nextInductor && nextCapacitor) {
      const readingIsReady = voltage >= 30
      setCurrentStep(readingIsReady ? STEPS.ADD_READING : (variacPowered ? STEPS.SET_VOLTAGE : STEPS.VARIAC_ON))
      setStatus(readingIsReady
        ? 'New R-L-C reading selected. Click Add to record it.'
        : variacPowered
          ? 'Component values selected. Click the Variac knob to set it to 30 V.'
          : 'Component values selected. Now switch ON the autotransformer.')
      showAlert({
        title: 'Component Values Selected',
        description: readingIsReady
          ? 'A new R-L-C reading is ready. Click Add to record it.'
          : variacPowered
            ? 'The values are selected. Click the Variac knob to rotate it to the 30 V position.'
            : 'Resistor, inductor, and capacitor values have been selected. Now switch ON the autotransformer.',
        type: 'success',
        icon: '✅',
        placement: 'top-right',
        duration: 6500,
        sound:
          readingIsReady
            ? 'afterVolSet'
            : variacPowered
              ? 'afterAutoTransOn'
              : 'mcbOn',
      })
    }
  }, [powerOn, variacPowered, voltage, showAlert])

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
    showAlert({
      title: 'Autotransformer Not Ready',
      description: 'Turn ON the MCB and select the resistor, inductor, and capacitor values before switching ON the autotransformer.',
      type: 'warning',
      icon: '⚠️',
      placement: 'center',
      duration: 6500,
      sound: 'firstAutoTransClick',
    })
  }, [showAlert])

  const handleVariacOn = useCallback(() => {
    setVariacPowered(true)
    setCurrentStep(STEPS.SET_VOLTAGE)
    setStatus('Autotransformer is ON. Click the Variac knob to rotate it to the 30 V position.')
    showAlert({
      title: 'Autotransformer ON',
      description: 'Autotransformer is ON. Click the Variac knob to set the output to 30 V.',
      type: 'success',
      icon: '🎛️',
      placement: 'top-right',
      duration: 6500,
      sound: 'afterAutoTransOn',
    })
  }, [showAlert])

  // The Add button unlocks when the autotransformer supplies the selected
  // reading. It is locked again for that combination after the row is added.
  const handleVariacRotate = useCallback(() => {
    setVariacRotated(true)
    setStatus('Variac set to 30 V. The selected reading is ready to add.')
  }, [])

  const handleAutoConnect = () => {
    setAutoConnectRequest((current) => current + 1)
    setStatus('Autoconnect completed. All connections are correct and the Check button is now disabled. Turn ON the MCB.')
    window.setTimeout(() => {
      showAlert({
        title: 'Autoconnect Completed',
        description: 'Autoconnect completed. All connections are correct and the Check button is now disabled. Turn ON the MCB.',
        type: 'info',
        icon: '🔌',
        placement: 'center',
        duration: 5000,
        sound: 'autoConnect',
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

      window.setTimeout(() => {
        showAlert({
          title: 'Voltage Reached',
          description: 'The voltage has been set to 30 V to ensure safe operation of the RLC circuit experiment. The readings are now displayed on the voltmeter, ammeter, and wattmeter. Now, click on the Add button to add the readings to the observation table.',
          type: 'success',
          icon: '⚡',
          placement: 'center',
          duration: 18000,
          sound: 'afterVolSet',
        })
      }, 50)
    }
  }, [powerOn, currentStep, showAlert])

  // 🎯 STEP HIGHLIGHTING HELPERS
  const isStepActive = (stepNumber) => derivedStep === stepNumber;
  const isStepCompleted = (stepNumber) => derivedStep > stepNumber;

  return (
    <WalkthroughProvider 
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
          style={{
            '--app-render-scale': renderScale,
            '--app-composite-scale': scale / renderScale,
          }}
        >
          <main className="simulation-shell" id="walkthrough-demo-experiment">
            <HeaderBoard />
            <WalkthroughStartButton />

            <span className="sr-only" role="status" aria-live="polite">{status}</span>

            <section className="workspace-grid">
              <aside className="left-panel">
                <ActionButtons
                  aiGuideActive={aiGuideEnabled}
                  disabledButtons={{
                    onAdd: !connectionsVerified
                      || !powerOn
                      || !componentsSelected
                      || !variacRotated
                      || hasRecordedCombo
                      || readingCount >= MAX_OBSERVATIONS,
                    onAutoConnect: connectionsVerified || powerOn,
                    onCheck: connectionsVerified,
                    onPrint: false,
                    onInstruction: false,
                  }}
                  onAdd={recordObservation}
                  onAiGuide={handleAiGuide}
                  onCheck={handleCheck}
                  onPrint={handlePrint}
                  onReset={handleReset}
                  onAutoConnect={handleAutoConnect}
                  onInstruction={() => setIsModalOpen(true)}
                  currentStep={derivedStep}
                />

                <div className="panel-content-wrapper">
                  <ControlPanel
                    observations={observations}
                  />

                  {isModalOpen && (
                    <div className="instructions-overlay-panel">
                      <div className="instructions-header">
                        INSTRUCTIONS
                        <button 
                          onClick={() => setIsModalOpen(false)}
                          className="instructions-close"
                          aria-label="Close instructions"
                        >
                          &times;
                        </button>
                      </div>
                      
                      <div className="instructions-body">
                        <p className={isStepActive(STEPS.CONNECT) ? 'instruction-step-active' : (isStepCompleted(STEPS.CONNECT) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 1:</strong> Make connections as per the instructions given below.
                        </p>
                        
                        <div className="instructions-connection-box">
                          {`1-23, 2-24\n3-25, 4-26\n5-25, 6-9, 6-10, 8-17\n11-17, 12-18\n13-19, 14-20\n15-21, 16-22\n18-19, 20-21\n22-26, 26-7`}
                        </div>

                        <p className="instructions-note"><strong>Note:</strong> Click on the label to delete connection for the corresponding node.</p>
                        
                        <p className={isStepActive(STEPS.CHECK) ? 'instruction-step-active' : (isStepCompleted(STEPS.CHECK) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 2:</strong> Now, Check the connections by clicking on <strong>'CHECK'</strong> button.
                        </p>
                        <p className="instructions-indent">If the connections are 'Invalid connections' click on corresponding node to remove the connection.</p>
                        <p className="instructions-indent">And if the connections are 'Right Connections' then follow the below steps.</p>
                        
                        <p className={isStepActive(STEPS.SELECT_COMPONENTS) ? 'instruction-step-active' : (isStepCompleted(STEPS.SELECT_COMPONENTS) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 3:</strong> Turn on the MCB.
                        </p>

                        <p className={isStepActive(STEPS.POWER_ON) ? 'instruction-step-active' : (isStepCompleted(STEPS.POWER_ON) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 4:</strong> Select the resistor, inductor, and capacitor values from their dropdowns.
                        </p>
                        
                        <p className={isStepActive(STEPS.VARIAC_ON) ? 'instruction-step-active' : (isStepCompleted(STEPS.VARIAC_ON) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 5:</strong> Switch on the autotransformer.
                        </p>
                        
                        <p className={isStepActive(STEPS.SET_VOLTAGE) ? 'instruction-step-active' : (isStepCompleted(STEPS.SET_VOLTAGE) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 6:</strong> Click the <strong>Variac knob</strong> to rotate it to the 30 V position.
                        </p>
                        
                        <p className={isStepActive(STEPS.ADD_READING) ? 'instruction-step-active' : (isStepCompleted(STEPS.ADD_READING) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 7:</strong> Click <strong>'ADD'</strong> to record the reading. Choose another R-L-C combination and repeat.
                        </p>
                        
                        <p className={isStepActive(STEPS.CALCULATE) ? 'instruction-step-active' : (isStepCompleted(STEPS.CALCULATE) ? 'instruction-step-completed' : '')}>
                          <strong style={{ color: '#a0522d' }}>Step 8:</strong> After five readings, select a recorded reading, enter its table values, and click <strong>Verify</strong>. V and I (mA) are prefilled.
                        </p>
                      </div>
                      
                      <div className="instructions-footer">
                        <button onClick={() => setIsModalOpen(false)}>Close</button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>

              <section className="right-panel">
                <ConnectionLab
                  aiGuide={{ playStep: playGuideStep, stop: stopAiGuideStep }}
                  aiGuideActiveStepId={aiGuideEnabled ? activeAiGuideStepId : null}
                  autoConnectRequest={autoConnectRequest}
                  checkRequest={checkRequest}
                  onCheckConnections={handleCheckConnections}
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
