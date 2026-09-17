import { useEffect, useRef, useState } from 'react'

import CircuitDiagram from './CircuitDiagram.jsx'
import EquipmentPanel from './EquipmentPanel.jsx'

import {
  addAllEndpoints,
  autoConnectDefaultCircuit,
  DEFAULT_AMMETER_CURRENT_KEYS,
  DEFAULT_AUTO_CONNECTIONS,
  deleteConnectionsForTerminal,
  getAmmeterCurrentKeys,
  lockJsPlumbCircuit,
  resolveJsPlumb,
  validateOldExperimentConnections,
  wireHoverPaintStyles,
  wirePaintStyles,
} from '../utils/jsPlumbWiring.js'

// 🎙️ AI GUIDE: ordered pair-keys mirroring the narration sequence (steps 3-21
// in aiGuideConfig.json map 1:1 to these required connections, in order).
const normalizePairKey = (a, b) => [a, b].sort().join('|')
const REQUIRED_PAIR_KEYS = DEFAULT_AUTO_CONNECTIONS.map(([a, b]) => normalizePairKey(a, b))
const FIRST_CONNECTION_STEP_ID = 3
const ALL_CONNECTIONS_DONE_STEP_ID = 22
const WRONG_CONNECTION_STEP_ID = 23

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

const getJsPlumbZoom = (scale) => (
  Number.isFinite(scale) && scale > 0 ? scale : 1
)

const ConnectionLab = ({
  aiGuide,
  aiGuideActiveStepId,
  autoConnectRequest,
  checkRequest,
  onCheckConnections,
  onConnectionReadinessChange,
  onVariacBlocked,
  onVariacOn,
  onVariacRotate,
  powerOn,
  connectionsVerified,
  componentsSelected,
  selectedResistor,
  selectedInductor,
  selectedCapacitor,
  onResistorChange,
  onInductorChange,
  onCapacitorChange,
  r1,
  r2,
  r3,
  readings,
  isResistorCorrect,
  resetRequest,
  scale = 1,
  onTogglePower,
  setVoltage,
  currentStep = 1, // 🎯 RECEIVED FROM APP
}) => {
  const containerRef = useRef(null)
  const instanceRef = useRef(null)
  const onCheckConnectionsRef = useRef(onCheckConnections)
  const onConnectionReadinessChangeRef = useRef(onConnectionReadinessChange)
  const scaleRef = useRef(getJsPlumbZoom(scale))
  const aiGuideRef = useRef(aiGuide)
  const isAutoConnectingRef = useRef(false)
  const madeConnectionsRef = useRef(new Set())

  const [isLocked, setIsLocked] = useState(false)
  const [ammeterCurrentKeys, setAmmeterCurrentKeys] = useState(DEFAULT_AMMETER_CURRENT_KEYS)

  useEffect(() => {
    onCheckConnectionsRef.current = onCheckConnections
  }, [onCheckConnections])

  useEffect(() => {
    onConnectionReadinessChangeRef.current = onConnectionReadinessChange
  }, [onConnectionReadinessChange])

  useEffect(() => {
    aiGuideRef.current = aiGuide
  }, [aiGuide])

  useEffect(() => {
    const container = containerRef.current
    const connectionIndex = Number(aiGuideActiveStepId) - FIRST_CONNECTION_STEP_ID
    const activePair = DEFAULT_AUTO_CONNECTIONS[connectionIndex]

    if (!container || !activePair) {
      return undefined
    }

    const highlightedElements = []

    activePair.forEach((terminalId) => {
      const label = container.querySelector(`[data-terminal-id="${terminalId}"]`)

      if (label) {
        label.classList.add('ai-guide-label-highlight')
        highlightedElements.push(label)
      }
    })

    return () => {
      highlightedElements.forEach((element) => {
        element.classList.remove('ai-guide-label-highlight')
      })
    }
  }, [aiGuideActiveStepId])

  // 🎙️ AI GUIDE: called whenever the user manually drags a wire between two
  // terminals. Auto-connect wiring is excluded via isAutoConnectingRef so it
  // doesn't double up with the dedicated "Autoconnect completed" narration.
  const handleManualConnection = (sourceId, targetId) => {
    const guide = aiGuideRef.current
    if (isAutoConnectingRef.current) {
      return
    }

    const key = normalizePairKey(sourceId, targetId)
    const madeSet = madeConnectionsRef.current

    if (madeSet.has(key)) {
      // Already-correct connection re-made/re-attached — nothing to narrate.
      return
    }

    const requiredIndex = REQUIRED_PAIR_KEYS.indexOf(key)

    if (requiredIndex === -1) {
      // ❌ Wrong connection — announce it, then repeat the still-pending step.
      const nextExpectedIndex = REQUIRED_PAIR_KEYS.findIndex((requiredKey) => !madeSet.has(requiredKey))
      const repeatStepId = nextExpectedIndex < REQUIRED_PAIR_KEYS.length
        && nextExpectedIndex >= 0
        ? nextExpectedIndex + FIRST_CONNECTION_STEP_ID
        : ALL_CONNECTIONS_DONE_STEP_ID

      if (guide?.playStep) {
        guide.playStep(WRONG_CONNECTION_STEP_ID).then(() => {
          guide.playStep(repeatStepId)
        })
      }
      return
    }

    // ✅ Right connection — advance to the next instruction, or announce
    // completion once every required pair has been made.
    madeSet.add(key)
    const nextIndex = REQUIRED_PAIR_KEYS.findIndex((requiredKey) => !madeSet.has(requiredKey))

    if (nextIndex >= 0) {
      onConnectionReadinessChangeRef.current?.(false)
      guide?.playStep?.(nextIndex + FIRST_CONNECTION_STEP_ID)
    } else {
      onConnectionReadinessChangeRef.current?.(true)
      guide?.playStep?.(ALL_CONNECTIONS_DONE_STEP_ID)
    }
  }

  useEffect(() => {
    let cancelled = false

    const initJsPlumb = async () => {
      const jsPlumbModule = await import('jsplumb')
      const jsPlumb = resolveJsPlumb(jsPlumbModule)

      if (cancelled || !containerRef.current || !jsPlumb?.getInstance) {
        return
      }

      instanceRef.current?.reset()

      containerRef.current.classList.remove('connection-lab--locked')
      setIsLocked(false)
      setAmmeterCurrentKeys(DEFAULT_AMMETER_CURRENT_KEYS)
      madeConnectionsRef.current = new Set()
      lastProcessedAutoConnectRef.current = autoConnectRequest

      const instance = jsPlumb.getInstance({
        Container: containerRef.current,
        ConnectionsDetachable: true,
        ReattachConnections: true,
        Connector: ['Bezier', { curviness: 72 }],
        PaintStyle: {
          ...wirePaintStyles.positive,
        },
        HoverPaintStyle: {
          ...wireHoverPaintStyles.positive,
        },
        Endpoint: ['Dot', { radius: 5 }],
      })

      instanceRef.current = instance
      instance.setZoom?.(scaleRef.current)

      instance.registerConnectionTypes({
        positive: {
          paintStyle: {
            ...wirePaintStyles.positive,
          },
          hoverPaintStyle: {
            ...wireHoverPaintStyles.positive,
          },
        },
        negative: {
          paintStyle: {
            ...wirePaintStyles.negative,
          },
          hoverPaintStyle: {
            ...wireHoverPaintStyles.negative,
          },
        },
      })

      // 🎙️ AI GUIDE: narrate every wire the learner drops by hand.
      instance.bind('connection', (info) => {
        const sourceId = info?.sourceId || info?.source?.id || info?.connection?.sourceId
        const targetId = info?.targetId || info?.target?.id || info?.connection?.targetId

        if (sourceId && targetId) {
          handleManualConnection(sourceId, targetId)
        }
      })

      instance.setSuspendDrawing(true)

      addAllEndpoints(instance)

      instance.setSuspendDrawing(false, true)

      window.setTimeout(() => {
        instance.repaintEverything()
      }, 100)
    }

    initJsPlumb()

    const handleResize = () => {
      window.setTimeout(() => {
        instanceRef.current?.repaintEverything()
      }, 100)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', handleResize)

      instanceRef.current?.reset()
      instanceRef.current = null
    }
  // The reset signal intentionally owns jsPlumb re-initialization. The latest
  // auto-connect request is only captured so an old request is not replayed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRequest])

  useEffect(() => {
    const instance = instanceRef.current
    const zoom = getJsPlumbZoom(scale)

    scaleRef.current = zoom

    if (!instance?.setZoom) {
      return
    }

    instance.setZoom(zoom, true)

    window.setTimeout(() => {
      instance.repaintEverything?.()
    }, 0)
  }, [scale])

  const lastProcessedAutoConnectRef = useRef(0)

  useEffect(() => {
    if (
      autoConnectRequest === 0 ||
      autoConnectRequest === lastProcessedAutoConnectRef.current ||
      !instanceRef.current ||
      isLocked
    ) {
      return
    }

    const executeWiring = () => {
      if (!instanceRef.current) return

      lastProcessedAutoConnectRef.current = autoConnectRequest
      isAutoConnectingRef.current = true

      try {
        addAllEndpoints(instanceRef.current)
        autoConnectDefaultCircuit(instanceRef.current)

        instanceRef.current.repaintEverything()
        window.setTimeout(() => instanceRef.current?.repaintEverything(), 50)
        window.setTimeout(() => instanceRef.current?.repaintEverything(), 150)

        // 🎙️ AI GUIDE: autoconnect fills in every required pair at once, so
        // treat them as already narrated (its own "Autoconnect completed"
        // audio is triggered separately from the ActionButtons handler).
        madeConnectionsRef.current = new Set(REQUIRED_PAIR_KEYS)
        onConnectionReadinessChangeRef.current?.(true)

        // Auto Connect creates the known-correct circuit, validates it, and
        // locks the wires immediately. CHECK is therefore no longer needed.
        const result = validateOldExperimentConnections(instanceRef.current)

        if (result.isCorrect) {
          setAmmeterCurrentKeys(getAmmeterCurrentKeys(instanceRef.current))
          lockJsPlumbCircuit(instanceRef.current, containerRef.current)
          setIsLocked(true)
        }

        onCheckConnectionsRef.current?.(result, { silent: true })
      } catch (error) {
        console.error("Wiring bypass failed:", error)
      } finally {
        window.setTimeout(() => {
          isAutoConnectingRef.current = false
        }, 200)
      }
    }

    executeWiring()
  }, [autoConnectRequest, isLocked])

  useEffect(() => {
    if (checkRequest === 0 || !instanceRef.current) {
      return
    }

    const result = validateOldExperimentConnections(instanceRef.current)

    if (result.isCorrect) {
      setAmmeterCurrentKeys(getAmmeterCurrentKeys(instanceRef.current))
    }

    onCheckConnectionsRef.current?.(result)
  }, [checkRequest])

  const handleLabelClick = (event) => {
    // Manual wires are removed only through their numbered labels. Keeping
    // terminal-dot clicks separate avoids deleting a wire while the learner
    // is attempting to drag or reconnect it.
    const label = event.target.closest('.terminal-number-label')

    if (!label || !containerRef.current?.contains(label)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (isLocked) {
      return
    }

    const terminalId = label.dataset.terminalId

    if (!terminalId || !instanceRef.current) {
      return
    }

    const deletedCount = deleteConnectionsForTerminal(instanceRef.current, terminalId)
    instanceRef.current.repaintEverything?.()

    if (deletedCount > 0) {
      const result = validateOldExperimentConnections(instanceRef.current)
      onCheckConnectionsRef.current?.(result, { silent: true })
    }

    // 🎙️ AI GUIDE: forget any required pair involving the removed terminal so
    // re-connecting it plays the right narration again instead of being
    // silently treated as a duplicate.
    let removedRequiredConnection = false

    madeConnectionsRef.current.forEach((key) => {
      if (key.split('|').includes(terminalId)) {
        madeConnectionsRef.current.delete(key)
        removedRequiredConnection = true
      }
    })

    if (removedRequiredConnection) {
      onConnectionReadinessChangeRef.current?.(false)
    }
  }

  const combinedReadings = {
    ...readings,
    A1: readings[ammeterCurrentKeys.A1] ?? readings.current ?? 0,
    A2: readings[ammeterCurrentKeys.A2] ?? readings.current ?? 0,
    A3: readings[ammeterCurrentKeys.A3] ?? readings.current ?? 0,
  }

  // 🎯 DETERMINE HIGHLIGHT STATE
  const isConnectPhase = currentStep === STEPS.CONNECT || currentStep === STEPS.CHECK;

  return (
    <div 
      className={`connection-lab ${isConnectPhase ? 'connection-lab--connect-phase' : ''}`} 
      onClick={handleLabelClick} 
      ref={containerRef}
    >
      <section className="workspace grid">
        
        <aside className="left-panel">
          <div className="panel-content-wrapper">
            <EquipmentPanel
              onTogglePower={onTogglePower}
              onVariacBlocked={onVariacBlocked}
              onVariacOn={onVariacOn}
              onVariacRotate={onVariacRotate}
              powerOn={powerOn}
              connectionsVerified={connectionsVerified}
              readings={combinedReadings}
              setVoltage={setVoltage}
              currentStep={currentStep} // 🎯 PASS TO EQUIPMENT PANEL
              isResistorCorrect={isResistorCorrect}
              resetRequest={resetRequest}
              componentsSelected={componentsSelected}
              selectedResistor={selectedResistor}
              selectedInductor={selectedInductor}
              selectedCapacitor={selectedCapacitor}
              onResistorChange={onResistorChange}
              onInductorChange={onInductorChange}
              onCapacitorChange={onCapacitorChange}
            />
          </div>
        </aside>

        <section className="right-panel">
          <CircuitDiagram 
            r1={r1} 
            r2={r2} 
            r3={r3} 
          />
        </section>

      </section>
    </div>
  )
}

export default ConnectionLab
