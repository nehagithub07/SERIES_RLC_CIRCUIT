// =================================================================
// 1. TERMINAL POLARITY GROUPS (Red vs Black)
// =================================================================

// Positive terminals use red binding posts.
export const POSITIVE_TERMINALS = [
  '1-endpoint',  // MCB +
  '3-endpoint',  // Voltmeter V1 +
  '5-endpoint',  // Ammeter A1 +
  '8-endpoint',  // Wattmeter W1 (L)
  '9-endpoint',  // Wattmeter W1 (M)
  '10-endpoint', // Wattmeter W1 (C)
  '11-endpoint', // Voltmeter V2 +
  '13-endpoint', // Voltmeter V3 +
  '15-endpoint'  // Voltmeter V4 +
]

// Negative terminals use black binding posts.
export const NEGATIVE_TERMINALS = [
  '2-endpoint',  // MCB -
  '4-endpoint',  // Voltmeter V1 -
  '6-endpoint',  // Ammeter A1 -
  '7-endpoint',  // Wattmeter W1 (V) -> Matches your updated red dot
  '12-endpoint', // Voltmeter V2 -
  '14-endpoint', // Voltmeter V3 -
  '16-endpoint'  // Voltmeter V4 -
]

// Component bench positive terminals (red binding posts).
export const CIRCUIT_POSITIVE_TERMINALS = [
  '17-endpoint', // Resistor Left
  '19-endpoint', // Inductor Left
  '21-endpoint', // Capacitor Left
  '23-endpoint', // Variac Input +
  '25-endpoint'  // Variac Output +
]

// Component bench negative terminals (black binding posts).
export const CIRCUIT_NEGATIVE_TERMINALS = [
  '18-endpoint', // Resistor Right
  '20-endpoint', // Inductor Right
  '22-endpoint', // Capacitor Right
  '24-endpoint', // Variac Input -
  '26-endpoint'  // Variac Output -
]

// =================================================================
// MCB STATE HELPERS
// =================================================================

export const isMcbOn = () => {
  const mcbTerminal2 = document.getElementById('2-endpoint')
  return mcbTerminal2?.dataset.live === 'true'
}

export const getMcbPowerState = () => ({
  isOn: isMcbOn(),
  terminal1Live: true,
  terminal2Live: isMcbOn()
})

// =================================================================
// 2. AUTO-CONNECTION AND VALIDATION SEQUENCES
// =================================================================

export const VALID_CONNECTION_SEQUENCE = [
  '1-endpoint', '23-endpoint',
  '2-endpoint', '24-endpoint',
  '3-endpoint', '25-endpoint',
  '4-endpoint', '26-endpoint',
  '5-endpoint', '25-endpoint',
  '6-endpoint', '9-endpoint',
  '9-endpoint', '10-endpoint',
  '7-endpoint', '18-endpoint',
  '7-endpoint', '26-endpoint',
  '8-endpoint', '17-endpoint',
  '11-endpoint', '17-endpoint',
  '12-endpoint', '18-endpoint',
  '13-endpoint', '19-endpoint',
  '14-endpoint', '20-endpoint',
  '15-endpoint', '21-endpoint',
  '16-endpoint', '22-endpoint',
  '18-endpoint', '19-endpoint',
  '20-endpoint', '21-endpoint',
  '22-endpoint', '26-endpoint'
]

export const DEFAULT_AUTO_CONNECTIONS = [
  ['1-endpoint', '23-endpoint'],
  ['2-endpoint', '24-endpoint'],
  ['3-endpoint', '25-endpoint'],
  ['4-endpoint', '26-endpoint'],
  ['5-endpoint', '25-endpoint'],
  ['6-endpoint', '9-endpoint'],
  ['9-endpoint', '10-endpoint'],
  ['7-endpoint', '18-endpoint'],
  ['7-endpoint', '26-endpoint'],
  ['8-endpoint', '17-endpoint'],
  ['11-endpoint', '17-endpoint'],
  ['12-endpoint', '18-endpoint'],
  ['13-endpoint', '19-endpoint'],
  ['14-endpoint', '20-endpoint'],
  ['15-endpoint', '21-endpoint'],
  ['16-endpoint', '22-endpoint'],
  ['18-endpoint', '19-endpoint'],
  ['20-endpoint', '21-endpoint'],
  ['22-endpoint', '26-endpoint']
]

// =================================================================
// 3. INSTRUMENT DATA STRATEGIES
// =================================================================

export const DEFAULT_AMMETER_CURRENT_KEYS = {
  A1: 'iTotal',
  A2: 'v1',
  A3: 'v2',
  A4: 'v3',
  A5: 'v4',
  A6: 'p1'
}

const AMMETER_BRANCH_CONNECTIONS = {
  A1: [
    {
      currentKey: 'iTotal',
      positiveTerminal: '5-endpoint',
      negativeTerminal: '6-endpoint',
      circuitPositiveTerminal: '25-endpoint',
      circuitNegativeTerminal: '9-endpoint'
    }
  ]
}

// =================================================================
// 4. CORE JSPLUMB METHODS
// =================================================================

export const resolveJsPlumb = (module) => (
  module?.jsPlumb
  || module?.default?.jsPlumb
  || module?.default
  || window.jsPlumb
)

const getAllConnections = (instance) => {
  if (!instance) return []
  if (typeof instance.getAllConnections === 'function') return instance.getAllConnections()
  if (typeof instance.getConnections === 'function') return instance.getConnections()
  return []
}

export const deleteConnectionsForTerminal = (instance, terminalId) => {
  const matchingConnections = getAllConnections(instance).filter((connection) => {
    const sourceId = connection.sourceId || connection.source?.id
    const targetId = connection.targetId || connection.target?.id
    return sourceId === terminalId || targetId === terminalId
  })

  matchingConnections.forEach((connection) => {
    if (typeof instance.deleteConnection === 'function') {
      instance.deleteConnection(connection)
      return
    }
    connection.detach?.()
  })

  return matchingConnections.length
}

const isNegativeTerminal = (terminalId) => (
  NEGATIVE_TERMINALS.includes(terminalId)
  || CIRCUIT_NEGATIVE_TERMINALS.includes(terminalId)
)

const terminalPaintStyles = {
  positive: { fill: '#e51d27', outlineStroke: '#fff8f6', outlineWidth: 2, stroke: '#8f140e', strokeWidth: 1.4 },
  negative: { fill: '#15191c', outlineStroke: '#f8fbff', outlineWidth: 2, stroke: '#030405', strokeWidth: 1.4 }
}

const terminalHoverPaintStyles = {
  positive: { fill: '#ff4a50', outlineStroke: '#ffffff', outlineWidth: 2.4, stroke: '#81130f', strokeWidth: 1.6 },
  negative: { fill: '#343b40', outlineStroke: '#ffffff', outlineWidth: 2.4, stroke: '#000000', strokeWidth: 1.6 }
}

const getTerminalNumber = (terminalId) => terminalId.replace('-endpoint', '')

const getCssValue = (styles, propertyName, fallback) => styles.getPropertyValue(propertyName).trim() || fallback
const getCssNumber = (styles, propertyName, fallback) => {
  const value = Number.parseFloat(styles.getPropertyValue(propertyName))
  return Number.isFinite(value) ? value : fallback
}

const getEndpointPaintStyle = (element, type, state = 'default') => {
  const styles = window.getComputedStyle(element)
  const prefix = state === 'hover' ? '--jtk-endpoint-hover' : '--jtk-endpoint'
  const defaults = state === 'hover' ? terminalHoverPaintStyles[type] : terminalPaintStyles[type]

  return {
    fill: getCssValue(styles, `${prefix}-fill`, defaults.fill),
    outlineStroke: getCssValue(styles, `${prefix}-outline-stroke`, defaults.outlineStroke),
    outlineWidth: getCssNumber(styles, `${prefix}-outline-width`, defaults.outlineWidth),
    stroke: getCssValue(styles, `${prefix}-stroke`, defaults.stroke),
    strokeWidth: getCssNumber(styles, `${prefix}-stroke-width`, defaults.strokeWidth)
  }
}

const getEndpointRadius = (element) => getCssNumber(window.getComputedStyle(element), '--jtk-endpoint-radius', 5)

const getEndpointCssClass = (terminalId, type) => {
  const terminalNumber = getTerminalNumber(terminalId)
  return ['jtk-endpoint--terminal', `jtk-endpoint--terminal-${terminalNumber}`, `jtk-endpoint--${terminalId}`, `jtk-endpoint--${type}`].join(' ')
}

export const wirePaintStyles = {
  positive: { outlineStroke: '#7a1018', outlineWidth: 1.15, stroke: '#e23643', strokeWidth: 4.6 },
  negative: { outlineStroke: '#050708', outlineWidth: 1.15, stroke: '#232a30', strokeWidth: 4.6 }
}

export const wireHoverPaintStyles = {
  positive: { outlineStroke: '#6b0b13', outlineWidth: 1.35, stroke: '#ff4f5c', strokeWidth: 5 },
  negative: { outlineStroke: '#000000', outlineWidth: 1.35, stroke: '#424b53', strokeWidth: 5 }
}

export const getConnectionBetween = (instance, firstId, secondId) => {
  return getAllConnections(instance).find((connection) => {
    const sourceId = connection.sourceId || connection.source?.id
    const targetId = connection.targetId || connection.target?.id
    return (sourceId === firstId && targetId === secondId) || (sourceId === secondId && targetId === firstId)
  })
}

export const hasConnectionBetween = (instance, firstId, secondId) => Boolean(getConnectionBetween(instance, firstId, secondId))

export const getAmmeterCurrentKeys = (instance) => {
  // If MCB is OFF, return default keys (readings will be zero due to powerOn check in App.jsx)
  if (!isMcbOn()) {
    return { ...DEFAULT_AMMETER_CURRENT_KEYS }
  }

  const currentKeys = { ...DEFAULT_AMMETER_CURRENT_KEYS }

  Object.entries(AMMETER_BRANCH_CONNECTIONS).forEach(([meterLabel, branches]) => {
    const matchedBranch = branches.find((branch) => (
      hasConnectionBetween(instance, branch.positiveTerminal, branch.circuitPositiveTerminal) &&
      hasConnectionBetween(instance, branch.negativeTerminal, branch.circuitNegativeTerminal)
    ))
    if (matchedBranch) {
      currentKeys[meterLabel] = matchedBranch.currentKey
    }
  })
  return currentKeys
}

export const addTerminalEndpoint = (instance, terminalId, type) => {
  const element = document.getElementById(terminalId)
  if (!element) return

  instance.addEndpoint(element, {
    uuid: terminalId,
    endpoint: ['Dot', { radius: getEndpointRadius(element) }],
    cssClass: getEndpointCssClass(terminalId, type),
    anchor: ['Center'],
    isSource: true,
    isTarget: true,
    connectionType: type,
    connectionsDetachable: true,
    connectorStyle: wirePaintStyles[type],
    connectorHoverStyle: wireHoverPaintStyles[type],
    maxConnections: -1,
    paintStyle: getEndpointPaintStyle(element, type),
    hoverPaintStyle: getEndpointPaintStyle(element, type, 'hover')
  })
}

export const addAllEndpoints = (instance) => {
  POSITIVE_TERMINALS.forEach((id) => addTerminalEndpoint(instance, id, 'positive'))
  NEGATIVE_TERMINALS.forEach((id) => addTerminalEndpoint(instance, id, 'negative'))
  CIRCUIT_POSITIVE_TERMINALS.forEach((id) => addTerminalEndpoint(instance, id, 'positive'))
  CIRCUIT_NEGATIVE_TERMINALS.forEach((id) => addTerminalEndpoint(instance, id, 'negative'))
}

// Integrated autoconnect function matching your defined DEFAULT_AUTO_CONNECTIONS mapping array
export const autoConnectDefaultCircuit = (instance) => {
  if (!instance) return;

  // Autoconnect is authoritative: discard partial or incorrect manual wires
  // before building the exact reference circuit that will then be locked.
  getAllConnections(instance).forEach((connection) => {
    if (typeof instance.deleteConnection === 'function') {
      instance.deleteConnection(connection)
    } else {
      connection.detach?.()
    }
  })

  DEFAULT_AUTO_CONNECTIONS.forEach(([source, target]) => {
    try {
      if (hasConnectionBetween(instance, source, target)) {
        return;
      }

      instance.connect({
        uuids: [source, target],
        type: isNegativeTerminal(source) ? 'negative' : 'positive',
        connector: ["Bezier", { curviness: 72 }] 
      });
    } catch (err) {
      console.error(`Error auto-connecting ${source} to ${target}:`, err);
    }
  });
}

export const validateOldExperimentConnections = (instance) => {
  let matchedCount = 0;

  DEFAULT_AUTO_CONNECTIONS.forEach(([source, target]) => {
    if (hasConnectionBetween(instance, source, target)) {
      matchedCount++;
    }
  });

  const totalConnections = getAllConnections(instance).length;
  const requiredConnections = DEFAULT_AUTO_CONNECTIONS.length;

  return {
    isCorrect: matchedCount === requiredConnections && totalConnections === requiredConnections,
    matchedCount,
    totalConnections,
    missingCount: requiredConnections - matchedCount,
    incorrectCount: totalConnections - matchedCount,
  }
}

export const lockJsPlumbCircuit = (instance, containerElement) => {
  getAllConnections(instance).forEach((connection) => {
    connection.setDetachable?.(false)
    connection.endpoints?.forEach((endpoint) => {
      endpoint.setEnabled?.(false)
    })
  })
  containerElement?.classList.add('connection-lab--locked')
}
