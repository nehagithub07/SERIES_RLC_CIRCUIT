// ============================================================================
// RLC METER CALIBRATION
// ============================================================================
// This is the single source of truth for what the voltmeters (V2/V3/V4),
// ammeter (A1), and wattmeter (W1) should display — and how far their
// needles should rotate — for every selectable Resistor / Inductor /
// Capacitor combination.
//
// There are 3 resistor values x 2 inductor values x 2 capacitor values = 12
// possible combinations. Each one has its own row below, taken from the
// experiment's reference observation table (readings recorded at the rated
// 30 V supply).
//
// HOW THE READINGS ARE USED
// ----------------------------------------------------------------------------
// As the Variac dial is turned from 0 V to 30 V, every reading below scales
// linearly with the supply voltage:
//     displayedValue = ratedValue * (currentVoltage / 30)
//
// HOW THE NEEDLE ANGLES ARE USED (AND HOW TO MANUALLY RE-CALIBRATE THEM)
// ----------------------------------------------------------------------------
// By default, a needle's rotation at the rated (30 V) reading is calculated
// automatically from the physical dial geometry in DIAL_GEOMETRY below:
//     angleAt30V = startAngle + (ratedValue / maxValue) * sweepAngle
// At any other supply voltage, the needle interpolates smoothly between the
// dial's zero position (startAngle) and that angleAt30V.
//
// If, for a specific R/L/C combination, the automatically computed angle
// doesn't line up visually with a meter's printed scale, you can override it
// by hand: open the matching row below and set the corresponding field
// inside `angles` (vR / vL / vC / current / power) to the exact angle in
// degrees (as used by the CSS custom properties, e.g. --voltmeter-needle-
// rotation) you want that needle to point to once the supply reaches 30 V.
// Leave a field as `null` to keep using the automatic calculation.
// ============================================================================

// Shared analog dial geometry. The same dial artwork is reused for every
// meter of a given type, so its "zero" pointer angle, "full-scale" sweep,
// and full-scale physical value live in one place.
export const DIAL_GEOMETRY = {
  // The needle artwork points straight up at 0deg. These angles follow the
  // first and last printed tick marks on each meter face.
  voltmeter: { maxValue: 50, startAngle: -90, sweepAngle: 180 }, // Volts
  // The current artwork is a 0-30 mA dial, matching the stored readings.
  ammeter: { maxValue: 30, startAngle: -90, sweepAngle: 180 }, // milliAmps
  // The current wattmeter artwork is a 0-1 W dial.
  wattmeter: { maxValue: 1, startAngle: -90, sweepAngle: 180 }, // Watts
}

// 🎯 THE 12 R/L/C CASES — edit any number below to change what the meters
// display and how far the needles rotate at 30 V.
export const RLC_METER_TABLE = [
  {
    r: '1', l: '2', c: '2.2',
    nature: 'Capacitive',
    current: 22.91, vR: 22.91, vL: 14.4, vC: 33.12, power: 0.52,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '1', l: '2', c: '4.7',
    nature: 'Near Resonance',
    current: 28.45, vR: 29.62, vL: 18.43, vC: 20.30, power: 0.88,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '1', l: '5', c: '2.2',
    nature: 'Inductive',
    current: 30, vR: 30, vL: 47.11, vC: 43.42, power: 0.90,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '1', l: '5', c: '4.7',
    nature: 'Inductive',
    current: 21.55, vR: 21.55, vL: 34.23, vC: 14.15, power: 0.46,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '2', l: '2', c: '2.2',
    nature: 'Capacitive',
    current: 13.57, vR: 27.05, vL: 8.5, vC: 19.5, power: 0.36,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '2', l: '2', c: '4.7',
    nature: 'Near Resonance',
    current: 14.90, vR: 29.85, vL: 9.45, vC: 10.73, power: 0.43,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '2', l: '5', c: '2.2',
    nature: 'Inductive',
    current: 15, vR: 30, vL: 23.60, vC: 21.75, power: 0.45,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '2', l: '5', c: '4.7',
    nature: 'Inductive',
    current: 12.50, vR: 26.50, vL: 20.23, vC: 8.72, power: 0.35,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '3', l: '2', c: '2.2',
    nature: 'Capacitive',
    current: 9.55, vR: 28.5, vL: 6.25, vC: 13.85, power: 0.28,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '3', l: '2', c: '4.7',
    nature: 'Near Resonance',
    current: 9.96, vR: 28.74, vL: 6.15, vC: 6.42, power: 0.29,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '3', l: '5', c: '2.2',
    nature: 'Inductive',
    current: 10.50, vR: 31, vL: 15.65, vC: 14.11, power: 0.28,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
  {
    r: '3', l: '5', c: '4.7',
    nature: 'Inductive',
    current: 8.58, vR: 27.75, vL: 14.22, vC: 6.2, power: 0.26,
    angles: { vR: null, vL: null, vC: null, current: null, power: null },
  },
]

// Exact corrected/theoretical values accepted by the Reading Verification
// section. They stay separate from the measured meter values above so that
// verification and error calculations use the supplied answer key.
export const RLC_VERIFICATION_TABLE = [
  { r: '1', l: '2', c: '2.2', nature: 'Capacitive', current: 23.21, vR: 23.21, vL: 14.59, vC: 33.58, cosPhi: 0.77, power: 0.53 },
  { r: '1', l: '2', c: '4.7', nature: 'Near Resonance', current: 29.96, vR: 29.96, vL: 18.83, vC: 20.29, cosPhi: 0.99, power: 0.89 },
  { r: '1', l: '5', c: '2.2', nature: 'Inductive', current: 29.77, vR: 29.77, vL: 46.77, vC: 43.07, cosPhi: 0.99, power: 0.88 },
  { r: '1', l: '5', c: '4.7', nature: 'Inductive', current: 22.37, vR: 22.37, vL: 35.15, vC: 15.15, cosPhi: 0.74, power: 0.50 },
  { r: '2', l: '2', c: '2.2', nature: 'Capacitive', current: 13.88, vR: 27.76, vL: 8.72, vC: 20.08, cosPhi: 0.92, power: 0.38 },
  { r: '2', l: '2', c: '4.7', nature: 'Near Resonance', current: 15, vR: 29.99, vL: 9.42, vC: 10.16, cosPhi: 0.99, power: 0.45 },
  { r: '2', l: '5', c: '2.2', nature: 'Inductive', current: 14.97, vR: 29.94, vL: 23.52, vC: 21.66, cosPhi: 0.99, power: 0.44 },
  { r: '2', l: '5', c: '4.7', nature: 'Inductive', current: 13.70, vR: 27.39, vL: 21.52, vC: 9.27, cosPhi: 0.91, power: 0.37 },
  { r: '3', l: '2', c: '2.2', nature: 'Capacitive', current: 9.65, vR: 28.94, vL: 6.06, vC: 13.96, cosPhi: 0.96, power: 0.27 },
  { r: '3', l: '2', c: '4.7', nature: 'Near Resonance', current: 10, vR: 30, vL: 6.28, vC: 6.77, cosPhi: 0.99, power: 0.30 },
  { r: '3', l: '5', c: '2.2', nature: 'Inductive', current: 9.99, vR: 29.97, vL: 15.70, vC: 14.46, cosPhi: 0.99, power: 0.29 },
  { r: '3', l: '5', c: '4.7', nature: 'Inductive', current: 9.58, vR: 28.75, vL: 15.06, vC: 6.49, cosPhi: 0.95, power: 0.27 },
]

// Builds the "R-L-C" lookup key used to find a case, e.g. "1-2-2.2".
export const getRlcCaseKey = (r, l, c) => `${r}-${l}-${c}`

const RLC_TABLE_BY_KEY = RLC_METER_TABLE.reduce((acc, entry) => {
  acc[getRlcCaseKey(entry.r, entry.l, entry.c)] = entry
  return acc
}, {})

const RLC_VERIFICATION_BY_KEY = RLC_VERIFICATION_TABLE.reduce((acc, entry) => {
  acc[getRlcCaseKey(entry.r, entry.l, entry.c)] = entry
  return acc
}, {})

// Looks up the rated (30 V) readings + angle overrides for a given
// resistor (kΩ) / inductor (H) / capacitor (µF) selection. Returns null if
// the combination hasn't been (fully) selected yet or isn't recognized.
export const getRlcMeterCase = (r, l, c) => {
  if (!r || !l || !c) return null
  return RLC_TABLE_BY_KEY[getRlcCaseKey(r, l, c)] || null
}

export const getRlcVerificationCase = (r, l, c) => {
  if (!r || !l || !c) return null
  return RLC_VERIFICATION_BY_KEY[getRlcCaseKey(r, l, c)] || null
}

// Computes a needle's rotation angle (in degrees) for a given meter type,
// given the case's rated (30 V) value, the current supply-voltage fraction
// (0 to 1), and an optional manual angle override (see file header above).
export const getNeedleAngle = (meterType, ratedValue, voltageFraction, angleOverrideDeg) => {
  const geometry = DIAL_GEOMETRY[meterType]
  if (!geometry) return 0

  const { maxValue, startAngle, sweepAngle } = geometry
  const clampedFraction = Math.max(0, Math.min(Number(voltageFraction) || 0, 1))

  const angleAtRatedValue = Number.isFinite(angleOverrideDeg)
    ? angleOverrideDeg
    : startAngle + Math.max(0, Math.min((Number(ratedValue) || 0) / maxValue, 1)) * sweepAngle

  return startAngle + clampedFraction * (angleAtRatedValue - startAngle)
}
