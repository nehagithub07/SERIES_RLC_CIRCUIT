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


// =========================================================
// CONNECTION HELPERS
// =========================================================

const normalizePairKey = (a, b) =>
  [String(a), String(b)].sort().join('|')


const getConnectionDetails = (instance) => {
  /*
   * Convert all required circuit connections into:
   *
   * {
   *   key: "1|23",
   *   label: "1-23"
   * }
   *
   * DEFAULT_AUTO_CONNECTIONS remains the single source
   * of truth for the correct circuit connections.
   */
  const requiredConnections = DEFAULT_AUTO_CONNECTIONS.map(
    ([source, target]) => ({
      key: normalizePairKey(source, target),
      label: `${source}-${target}`,
    })
  )

  const requiredKeys = new Set(
    requiredConnections.map(({ key }) => key)
  )

  /*
   * Read every wire currently present in jsPlumb.
   */
  const currentConnections =
    instance?.getAllConnections?.() ?? []

  /*
   * Store only one copy of each terminal pair.
   */
  const madeConnectionMap = new Map()

  currentConnections.forEach((connection) => {
    const sourceId =
      connection?.sourceId ??
      connection?.source?.id

    const targetId =
      connection?.targetId ??
      connection?.target?.id

    if (!sourceId || !targetId) {
      return
    }

    const key = normalizePairKey(
      sourceId,
      targetId
    )

    if (!madeConnectionMap.has(key)) {
      madeConnectionMap.set(
        key,
        `${sourceId}-${targetId}`
      )
    }
  })

  const madeKeys = new Set(
    madeConnectionMap.keys()
  )


  // =====================================================
  // WRONG CONNECTIONS
  // =====================================================

  /*
   * A wire exists in the circuit but that pair is not
   * part of DEFAULT_AUTO_CONNECTIONS.
   */
  const wrongConnections = [
    ...madeConnectionMap.entries(),
  ]
    .filter(([key]) => !requiredKeys.has(key))
    .map(([, label]) => label)


  // =====================================================
  // MISSING CONNECTIONS
  // =====================================================

  /*
   * A required connection has not yet been made.
   */
  const missingConnections = requiredConnections
    .filter(({ key }) => !madeKeys.has(key))
    .map(({ label }) => label)


  // =====================================================
  // CORRECT CONNECTIONS
  // =====================================================

  const correctConnections = requiredConnections
    .filter(({ key }) => madeKeys.has(key))
    .map(({ label }) => label)


  return {
    incorrectCount: wrongConnections.length,
    wrongConnections,

    missingCount: missingConnections.length,
    missingConnections,

    correctCount: correctConnections.length,
    correctConnections,
  }
}


/*
 * Use one validation helper everywhere:
 *
 * CHECK
 * AUTO CONNECT
 * DELETE CONNECTION
 *
 * This guarantees App.jsx always receives the exact same
 * result structure.
 */
const getValidatedConnectionResult = (instance) => ({
  ...validateOldExperimentConnections(instance),
  ...getConnectionDetails(instance),
})


// =========================================================
// AI GUIDE CONNECTION ORDER
// =========================================================

const REQUIRED_PAIR_KEYS =
  DEFAULT_AUTO_CONNECTIONS.map(
    ([a, b]) => normalizePairKey(a, b)
  )

const FIRST_CONNECTION_STEP_ID = 3
const ALL_CONNECTIONS_DONE_STEP_ID = 22
const WRONG_CONNECTION_STEP_ID = 23


// =========================================================
// EXPERIMENT STEPS
// =========================================================

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
  GENERATE_REPORT: 10,
}


const getJsPlumbZoom = (scale) => (
  Number.isFinite(scale) && scale > 0
    ? scale
    : 1
)


// =========================================================
// CONNECTION LAB
// =========================================================

const ConnectionLab = ({
  aiGuide,
  aiGuideActiveStepId,
  onPendingGuideStep,
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
  currentStep = 1,
}) => {

  const containerRef = useRef(null)
  const instanceRef = useRef(null)

  const onCheckConnectionsRef =
    useRef(onCheckConnections)

  const onConnectionReadinessChangeRef =
    useRef(onConnectionReadinessChange)

  const scaleRef =
    useRef(getJsPlumbZoom(scale))

  const aiGuideRef =
    useRef(aiGuide)

  const onPendingGuideStepRef =
    useRef(onPendingGuideStep)

  const isAutoConnectingRef =
    useRef(false)

  const madeConnectionsRef =
    useRef(new Set())

  const lastProcessedAutoConnectRef =
    useRef(0)


  const [isLocked, setIsLocked] =
    useState(false)

  const [
    ammeterCurrentKeys,
    setAmmeterCurrentKeys,
  ] = useState(DEFAULT_AMMETER_CURRENT_KEYS)


  // =======================================================
  // KEEP CALLBACK REFS UPDATED
  // =======================================================

  useEffect(() => {
    onCheckConnectionsRef.current =
      onCheckConnections
  }, [onCheckConnections])


  useEffect(() => {
    onConnectionReadinessChangeRef.current =
      onConnectionReadinessChange
  }, [onConnectionReadinessChange])


  useEffect(() => {
    aiGuideRef.current = aiGuide
  }, [aiGuide])


  useEffect(() => {
    onPendingGuideStepRef.current =
      onPendingGuideStep
  }, [onPendingGuideStep])


  // =======================================================
  // AI GUIDE TERMINAL HIGHLIGHT
  // =======================================================

  useEffect(() => {
    const container = containerRef.current

    const connectionIndex =
      Number(aiGuideActiveStepId) -
      FIRST_CONNECTION_STEP_ID

    const activePair =
      DEFAULT_AUTO_CONNECTIONS[
        connectionIndex
      ]

    if (!container || !activePair) {
      return undefined
    }

    const highlightedElements = []

    activePair.forEach((terminalId) => {
      const label = container.querySelector(
        `[data-terminal-id="${terminalId}"]`
      )

      if (label) {
        label.classList.add(
          'ai-guide-label-highlight'
        )

        highlightedElements.push(label)
      }
    })

    return () => {
      highlightedElements.forEach(
        (element) => {
          element.classList.remove(
            'ai-guide-label-highlight'
          )
        }
      )
    }
  }, [aiGuideActiveStepId])


  // =======================================================
  // MANUAL CONNECTION + AI GUIDE
  // =======================================================

  const handleManualConnection = (
    sourceId,
    targetId
  ) => {
    const guide = aiGuideRef.current

    /*
     * Auto Connect creates many wires at once.
     * Do not narrate every wire during Auto Connect.
     */
    if (isAutoConnectingRef.current) {
      return
    }

    const key =
      normalizePairKey(
        sourceId,
        targetId
      )

    const madeSet =
      madeConnectionsRef.current


    /*
     * If this correct connection was already made,
     * do not repeat narration.
     */
    if (madeSet.has(key)) {
      return
    }


    const requiredIndex =
      REQUIRED_PAIR_KEYS.indexOf(key)


    // =====================================================
    // WRONG MANUAL CONNECTION
    // =====================================================

    if (requiredIndex === -1) {
      const nextExpectedIndex =
        REQUIRED_PAIR_KEYS.findIndex(
          (requiredKey) =>
            !madeSet.has(requiredKey)
        )

      const repeatStepId =
        nextExpectedIndex >= 0 &&
        nextExpectedIndex <
          REQUIRED_PAIR_KEYS.length

          ? nextExpectedIndex +
            FIRST_CONNECTION_STEP_ID

          : ALL_CONNECTIONS_DONE_STEP_ID


      if (guide?.playStep) {
        guide
          .playStep(
            WRONG_CONNECTION_STEP_ID
          )
          .then((completed) => {
            if (completed) {
              guide.playStep(
                repeatStepId
              )
            }
          })
      }

      return
    }


    // =====================================================
    // CORRECT MANUAL CONNECTION
    // =====================================================

    madeSet.add(key)

    const nextIndex =
      REQUIRED_PAIR_KEYS.findIndex(
        (requiredKey) =>
          !madeSet.has(requiredKey)
      )


    if (nextIndex >= 0) {
      onPendingGuideStepRef.current?.(
        nextIndex +
        FIRST_CONNECTION_STEP_ID
      )

      onConnectionReadinessChangeRef
        .current?.(false)

      guide?.playStep?.(
        nextIndex +
        FIRST_CONNECTION_STEP_ID
      )

      return
    }


    /*
     * Every required connection has been made.
     */
    onPendingGuideStepRef.current?.(
      ALL_CONNECTIONS_DONE_STEP_ID
    )

    onConnectionReadinessChangeRef
      .current?.(true)

    guide?.playStep?.(
      ALL_CONNECTIONS_DONE_STEP_ID
    )
  }


  // =======================================================
  // INITIALISE JSPLUMB
  // =======================================================

  useEffect(() => {
    let cancelled = false


    const initJsPlumb = async () => {
      const jsPlumbModule =
        await import('jsplumb')

      const jsPlumb =
        resolveJsPlumb(jsPlumbModule)


      if (
        cancelled ||
        !containerRef.current ||
        !jsPlumb?.getInstance
      ) {
        return
      }


      instanceRef.current?.reset()


      containerRef.current.classList.remove(
        'connection-lab--locked'
      )

      setIsLocked(false)

      setAmmeterCurrentKeys(
        DEFAULT_AMMETER_CURRENT_KEYS
      )

      madeConnectionsRef.current =
        new Set()

      lastProcessedAutoConnectRef.current =
        autoConnectRequest


      const instance =
        jsPlumb.getInstance({
          Container:
            containerRef.current,

          ConnectionsDetachable: true,

          ReattachConnections: true,

          Connector: [
            'Bezier',
            { curviness: 72 },
          ],

          PaintStyle: {
            ...wirePaintStyles.positive,
          },

          HoverPaintStyle: {
            ...wireHoverPaintStyles.positive,
          },

          Endpoint: [
            'Dot',
            { radius: 5 },
          ],
        })


      instanceRef.current =
        instance

      instance.setZoom?.(
        scaleRef.current
      )


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


      /*
       * AI GUIDE:
       * Trigger narration whenever a user manually
       * creates a connection.
       */
      instance.bind(
        'connection',
        (info) => {
          const sourceId =
            info?.sourceId ||
            info?.source?.id ||
            info?.connection?.sourceId

          const targetId =
            info?.targetId ||
            info?.target?.id ||
            info?.connection?.targetId


          if (
            sourceId &&
            targetId
          ) {
            handleManualConnection(
              sourceId,
              targetId
            )
          }
        }
      )


      instance.setSuspendDrawing(true)

      addAllEndpoints(instance)

      instance.setSuspendDrawing(
        false,
        true
      )


      window.setTimeout(() => {
        instance.repaintEverything()
      }, 100)
    }


    initJsPlumb()


    const handleResize = () => {
      window.setTimeout(() => {
        instanceRef.current
          ?.repaintEverything()
      }, 100)
    }


    const resizeObserver =
      new ResizeObserver(
        handleResize
      )


    if (containerRef.current) {
      resizeObserver.observe(
        containerRef.current
      )
    }


    window.addEventListener(
      'resize',
      handleResize
    )


    return () => {
      cancelled = true

      resizeObserver.disconnect()

      window.removeEventListener(
        'resize',
        handleResize
      )

      instanceRef.current?.reset()
      instanceRef.current = null
    }

    /*
     * Reset owns jsPlumb initialization.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRequest])


  // =======================================================
  // JSPLUMB ZOOM
  // =======================================================

  useEffect(() => {
    const instance =
      instanceRef.current

    const zoom =
      getJsPlumbZoom(scale)

    scaleRef.current = zoom


    if (!instance?.setZoom) {
      return
    }


    instance.setZoom(
      zoom,
      true
    )


    window.setTimeout(() => {
      instance.repaintEverything?.()
    }, 0)
  }, [scale])


  // =======================================================
  // AUTO CONNECT
  // =======================================================

  useEffect(() => {

    if (
      autoConnectRequest === 0 ||
      autoConnectRequest ===
        lastProcessedAutoConnectRef.current ||
      !instanceRef.current ||
      isLocked
    ) {
      return
    }


    const executeWiring = () => {
      const instance =
        instanceRef.current

      if (!instance) {
        return
      }


      lastProcessedAutoConnectRef.current =
        autoConnectRequest

      isAutoConnectingRef.current =
        true


      try {

        addAllEndpoints(instance)

        autoConnectDefaultCircuit(
          instance
        )


        instance.repaintEverything()


        window.setTimeout(
          () =>
            instanceRef.current
              ?.repaintEverything(),
          50
        )


        window.setTimeout(
          () =>
            instanceRef.current
              ?.repaintEverything(),
          150
        )


        /*
         * Auto Connect creates every correct wire.
         * Mark all AI Guide connection steps as done.
         */
        madeConnectionsRef.current =
          new Set(REQUIRED_PAIR_KEYS)


        onConnectionReadinessChangeRef
          .current?.(true)


        /*
         * IMPORTANT:
         * Use the same detailed validation result
         * as the CHECK button.
         */
        const result =
          getValidatedConnectionResult(
            instance
          )


        if (result.isCorrect) {
          setAmmeterCurrentKeys(
            getAmmeterCurrentKeys(
              instance
            )
          )


          /*
           * Restore original lock behavior.
           */
          lockJsPlumbCircuit(
            instance,
            containerRef.current
          )


          setIsLocked(true)
        }


        /*
         * silent:true prevents CHECK alert
         * from appearing after Auto Connect.
         */
        onCheckConnectionsRef.current?.(
          result,
          { silent: true }
        )

      } catch (error) {

        console.error(
          'Wiring bypass failed:',
          error
        )

      } finally {

        window.setTimeout(() => {
          isAutoConnectingRef.current =
            false
        }, 200)

      }
    }


    executeWiring()

  }, [
    autoConnectRequest,
    isLocked,
  ])


  // =======================================================
  // CHECK CONNECTIONS
  // =======================================================

  useEffect(() => {

    if (
      checkRequest === 0 ||
      !instanceRef.current
    ) {
      return
    }


    /*
     * This now returns:
     *
     * isCorrect
     * incorrectCount
     * wrongConnections
     * missingCount
     * missingConnections
     * correctCount
     * correctConnections
     */
    const result =
      getValidatedConnectionResult(
        instanceRef.current
      )


    if (result.isCorrect) {
      setAmmeterCurrentKeys(
        getAmmeterCurrentKeys(
          instanceRef.current
        )
      )
    }


    onCheckConnectionsRef.current?.(
      result
    )

  }, [checkRequest])


  // =======================================================
  // DELETE CONNECTION BY TERMINAL LABEL
  // =======================================================

  const handleLabelClick = (event) => {

    const label =
      event.target.closest(
        '.terminal-number-label'
      )


    if (
      !label ||
      !containerRef.current
        ?.contains(label)
    ) {
      return
    }


    event.preventDefault()
    event.stopPropagation()


    /*
     * Connections cannot be changed once
     * a correct circuit has been locked.
     */
    if (isLocked) {
      return
    }


    const terminalId =
      label.dataset.terminalId


    if (
      !terminalId ||
      !instanceRef.current
    ) {
      return
    }


    const deletedCount =
      deleteConnectionsForTerminal(
        instanceRef.current,
        terminalId
      )


    instanceRef.current
      .repaintEverything?.()


    /*
     * Recalculate detailed connection state
     * immediately after deletion.
     *
     * silent:true updates App state without
     * opening another popup automatically.
     */
    if (deletedCount > 0) {

      const result =
        getValidatedConnectionResult(
          instanceRef.current
        )


      onCheckConnectionsRef.current?.(
        result,
        { silent: true }
      )
    }


    // =====================================================
    // UPDATE AI GUIDE AFTER CONNECTION REMOVAL
    // =====================================================

    let removedRequiredConnection =
      false


    madeConnectionsRef.current.forEach(
      (key) => {

        if (
          key
            .split('|')
            .includes(
              String(terminalId)
            )
        ) {
          madeConnectionsRef.current
            .delete(key)

          removedRequiredConnection =
            true
        }

      }
    )


    if (removedRequiredConnection) {

      onConnectionReadinessChangeRef
        .current?.(false)


      const nextIndex =
        REQUIRED_PAIR_KEYS.findIndex(
          (key) =>
            !madeConnectionsRef.current
              .has(key)
        )


      if (nextIndex >= 0) {

        onPendingGuideStepRef.current?.(
          nextIndex +
          FIRST_CONNECTION_STEP_ID
        )


        aiGuideRef.current?.playStep?.(
          nextIndex +
          FIRST_CONNECTION_STEP_ID
        )
      }
    }
  }


  // =======================================================
  // METER READINGS
  // =======================================================

  const combinedReadings = {
    ...readings,

    A1:
      readings[
        ammeterCurrentKeys.A1
      ] ??
      readings.current ??
      0,

    A2:
      readings[
        ammeterCurrentKeys.A2
      ] ??
      readings.current ??
      0,

    A3:
      readings[
        ammeterCurrentKeys.A3
      ] ??
      readings.current ??
      0,
  }


  // =======================================================
  // HIGHLIGHT CURRENT CONNECTION PHASE
  // =======================================================

  const isConnectPhase =
    currentStep === STEPS.CONNECT ||
    currentStep === STEPS.CHECK


  // =======================================================
  // UI
  // =======================================================

  return (
    <div
      className={
        `connection-lab ${
          isConnectPhase
            ? 'connection-lab--connect-phase'
            : ''
        }`
      }
      onClick={handleLabelClick}
      ref={containerRef}
    >

      <section className="workspace grid">

        <aside className="left-panel">

          <div className="panel-content-wrapper panel-content-wrapper--equipment">

            <EquipmentPanel
              onTogglePower={
                onTogglePower
              }

              onVariacBlocked={
                onVariacBlocked
              }

              onVariacOn={
                onVariacOn
              }

              onVariacRotate={
                onVariacRotate
              }

              powerOn={
                powerOn
              }

              connectionsVerified={
                connectionsVerified
              }

              readings={
                combinedReadings
              }

              setVoltage={
                setVoltage
              }

              currentStep={
                currentStep
              }

              isResistorCorrect={
                isResistorCorrect
              }

              resetRequest={
                resetRequest
              }

              componentsSelected={
                componentsSelected
              }

              selectedResistor={
                selectedResistor
              }

              selectedInductor={
                selectedInductor
              }

              selectedCapacitor={
                selectedCapacitor
              }

              onResistorChange={
                onResistorChange
              }

              onInductorChange={
                onInductorChange
              }

              onCapacitorChange={
                onCapacitorChange
              }
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