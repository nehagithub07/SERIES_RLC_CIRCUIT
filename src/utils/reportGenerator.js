import { OBSERVATION_COLUMNS, formatObservationValue, RLC_EQUATIONS } from './reportContent.js'

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const toNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

const formatNumber = (value, fractionDigits = 3) => toNumber(value).toFixed(fractionDigits)

// Verification fields are free-text answers typed by the student,
// so we display them as-entered rather than reformatting/rounding them.
const formatEntry = (value, fallback = '—') => {
  const text = `${value ?? ''}`.trim()

  return text === '' ? fallback : escapeHtml(text)
}

const getSessionDurationText = (sessionStart, sessionEnd) => {
  const durationMs = Math.max(0, sessionEnd - sessionStart)
  const durationTotalSeconds = Math.floor(durationMs / 1000)
  const durationMinutes = Math.floor(durationTotalSeconds / 60)
  const durationSeconds = durationTotalSeconds % 60

  return `${durationMinutes} min ${String(durationSeconds).padStart(2, '0')} sec`
}

const createObservationRows = (observations) => (
  observations.map((row, index) => `
      <tr>
        <td data-label="Reading">${index + 1}</td>
        <td data-label="V (V)">${formatEntry(row.voltage)}</td>
        ${OBSERVATION_COLUMNS.map((column) => `<td data-label="${escapeHtml(column.label.replace(/<[^>]*>/g, '') + (column.unit ? ` (${column.unit})` : ''))}">${escapeHtml(formatObservationValue(row, column))}</td>`).join('')}
      </tr>
    `).join('')
)

const createLineChart = (observations, series, yAxisLabel) => {
  const width = 720
  const height = 230
  const plot = { left: 54, right: 18, top: 20, bottom: 42 }
  const plotWidth = width - plot.left - plot.right
  const plotHeight = height - plot.top - plot.bottom
  const values = series.flatMap(({ key }) => observations.map((row) => toNumber(row[key])))
  const maximumValue = Math.max(1, ...values)
  const yMaximum = maximumValue * 1.1
  const xForIndex = (index) => plot.left + (observations.length <= 1 ? plotWidth / 2 : (index / (observations.length - 1)) * plotWidth)
  const yForValue = (value) => plot.top + plotHeight - (toNumber(value) / yMaximum) * plotHeight
  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const y = plot.top + ratio * plotHeight
    const label = yMaximum * (1 - ratio)
    return `<line x1="${plot.left}" y1="${y.toFixed(2)}" x2="${width - plot.right}" y2="${y.toFixed(2)}" class="chart-grid-line"/><text x="${plot.left - 8}" y="${(y + 3).toFixed(2)}" text-anchor="end" class="chart-axis-label">${formatNumber(label, label >= 10 ? 0 : 1)}</text>`
  }).join('')
  const xLabels = observations.map((_, index) => (
    `<text x="${xForIndex(index).toFixed(2)}" y="${height - 18}" text-anchor="middle" class="chart-axis-label">${index + 1}</text>`
  )).join('')
  const svgPaths = series.map(({ color, key }) => {
    const points = observations.map((row, index) => `${xForIndex(index).toFixed(2)},${yForValue(row[key]).toFixed(2)}`).join(' ')
    const markers = observations.map((row, index) => (
      `<circle cx="${xForIndex(index).toFixed(2)}" cy="${yForValue(row[key]).toFixed(2)}" r="3" fill="${color}"/>`
    )).join('')
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${markers}`
  }).join('')
  const legend = series.map(({ color, label }) => (
    `<span class="graph-legend-item"><i style="background:${color}"></i>${label}</span>`
  )).join('')

  return `
    <svg class="report-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(yAxisLabel)} by reading number">
      ${gridLines}
      <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${height - plot.bottom}" class="chart-axis"/>
      <line x1="${plot.left}" y1="${height - plot.bottom}" x2="${width - plot.right}" y2="${height - plot.bottom}" class="chart-axis"/>
      ${xLabels}
      ${svgPaths}
      <text x="${width / 2}" y="${height - 2}" text-anchor="middle" class="chart-axis-title">Reading number</text>
      <text x="14" y="${height / 2}" text-anchor="middle" class="chart-axis-title" transform="rotate(-90 14 ${height / 2})">${escapeHtml(yAxisLabel)}</text>
    </svg>
    <div class="graph-legend">${legend}</div>
  `
}

// Columns for the verified-reading table, matching the
// observation table's Excel-style headings (label on top, unit below).
const THEORETICAL_COLUMNS = [
  ['V', '(V)', 'voltage'],
  ['I', '(mA)', 'current'],
  ['R', '(kΩ)', 'r'],
  ['L', '(H)', 'l'],
  ['C', '(µF)', 'c'],
  ['V<sub>R</sub>', '(V)', 'vR'],
  ['Error', '(%)', 'vRError'],
  ['V<sub>L</sub>', '(V)', 'vL'],
  ['Error', '(%)', 'vLError'],
  ['V<sub>C</sub>', '(V)', 'vC'],
  ['Error', '(%)', 'vCError'],
  ['cosφ', '(PF)', 'cosPhi'],
  ['Error', '(%)', 'cosPhiError'],
  ['Power', '(W)', 'power'],
  ['Error', '(%)', 'powerError'],
]

const createTheoreticalTableHeader = () => `
      <tr>
        <th>S.No.</th>
        ${THEORETICAL_COLUMNS.map(([label, unit]) => `<th>${label}<br/>${unit}</th>`).join('')}
      </tr>
    `

const createTheoreticalRows = (theoreticalCalculations) => {
  const rows = Array.isArray(theoreticalCalculations)
    ? theoreticalCalculations.filter((row) => row && Number.isInteger(row.observationIndex) && row.observationIndex >= 0)
    : []

  return rows.map((row, index) => {
    const readingNumber = Number.isInteger(row.observationIndex)
      ? row.observationIndex + 1
      : index + 1

    return `
      <tr>
        <td data-label="Reading">${readingNumber}</td>
        ${THEORETICAL_COLUMNS.map(([label, unit, key]) => `<td data-label="${escapeHtml(label.replace(/<[^>]*>/g, '') + ' ' + unit)}">${key.endsWith('Error') && row[key] != null ? formatNumber(row[key], 2) : formatEntry(row[key])}</td>`).join('')}
      </tr>
    `
  }).join('')
}

export const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  theoreticalCalculations,
  sessionStart,
  virtualLabsLogoSrc,
}) => {
  const reportDate = new Date()
  const sessionEnd = reportDate.getTime()
  const reportDateText = reportDate.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const startTimeText = new Date(sessionStart).toLocaleTimeString()
  const endTimeText = reportDate.toLocaleTimeString()
  const durationText = getSessionDurationText(sessionStart, sessionEnd)
  const observationRows = createObservationRows(observations)
  const theoreticalRows = createTheoreticalRows(theoreticalCalculations?.filter((row) => row?.observationIndex < observations.length))
  const parameterList = [['R', 'r', 'kΩ'], ['L', 'l', 'H'], ['C', 'c', 'µF'], ['V', 'voltage', 'V']]
    .map(([label, key, unit]) => `<li>${label} = ${[...new Set(observations.map((row) => row[key]).filter((value) => value != null && value !== ''))].map((value) => `${escapeHtml(value)} ${unit}`).join(', ') || '—'}</li>`).join('')
  const voltageGraph = createLineChart(observations, [
    { key: 'vR', label: 'V<sub>R</sub>', color: '#2563eb' },
    { key: 'vL', label: 'V<sub>L</sub>', color: '#d97706' },
    { key: 'vC', label: 'V<sub>C</sub>', color: '#7c3aed' },
  ], 'Voltage (V)')
  const currentGraph = createLineChart(observations, [
    { key: 'current', label: 'Current', color: '#0f766e' },
  ], 'Current (mA)')
  const powerGraph = createLineChart(observations, [
    { key: 'power', label: 'Power', color: '#b42318' },
  ], 'Power (W)')

  const css = `
.equation-fraction { display: inline-grid; vertical-align: middle; text-align: center; }
.equation-fraction i { font-style: normal; padding: 0 4px; }
.equation-fraction i:first-child { border-bottom: 1px solid currentColor; }
.report-formula { font-family: "Cambria Math", "Times New Roman", serif; }
@media screen and (max-width: 768px) {
  .graph-grid { grid-template-columns: minmax(0, 1fr) !important; }
  .compact-table, .compact-table tbody { display: block; width: 100%; }
  .compact-table thead { display: none; }
  .compact-table tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 12px 0; border: 1px solid #d3ddea; }
  .compact-table td { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .compact-table td::before { content: attr(data-label); font-weight: 700; color: #50657c; }
}

body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%);
  color: #1f2d3d;
  margin: 0;
  padding: 18px 14px 30px;
  font-size: 14px;
  line-height: 1.42;
  overflow-wrap: break-word;
}
*,
*::before,
*::after {
  box-sizing: border-box;
}
.report-page {
  width: min(100%, 960px);
  margin: 0 auto 18px;
  padding: 22px 26px;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid #d3ddea;
  box-shadow: 0 12px 28px rgba(23, 50, 77, 0.1);
  break-inside: avoid-page;
  page-break-inside: avoid;
  overflow: visible;
  background-clip: padding-box;
}
.report-page:last-of-type {
  margin-bottom: 0;
}
.report-page--results {
  break-before: page;
  page-break-before: always;
}
h1,
h2,
h3 {
  color: #1f2d3d;
  margin-top: 0;
  font-weight: 700;
}
h1 {
  font-size: 28px;
  margin: 0;
  padding: 0;
  line-height: 1.15;
}
h2 {
  font-size: 20px;
  margin-bottom: 12px;
  color: #243b53;
}
h3 {
  font-size: 15px;
  margin-bottom: 7px;
  color: #2d4b68;
}
p {
  margin: 0 0 8px;
}
li {
  margin-bottom: 4px;
}
.section {
  background: linear-gradient(180deg, #f9fbfe 0%, #f4f7fb 100%);
  padding: 16px 18px;
  margin-bottom: 14px;
  border-radius: 12px;
  border: none;
  box-shadow: none;
  break-inside: auto;
  page-break-inside: auto;
  background-clip: padding-box;
}
.section:last-child {
  margin-bottom: 0;
}
.section > h2:first-child {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e1e9f3;
}
.label {
  font-weight: 600;
  color: #1f2d3d;
}
ul {
  padding-left: 20px;
  margin: 7px 0 0;
}
.two-column-list {
  column-count: 2;
  column-gap: 32px;
  list-style-position: inside;
  margin-top: 10px;
}
.report-overview-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.report-stamp {
  margin: 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: #ffffff;
  border: none;
  color: #50657c;
  font-size: 13px;
  font-weight: 600;
}
.report-experiment-label {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #60778f;
  font-weight: 700;
}
.report-experiment-title {
  margin: 0 0 14px;
  font-size: 22px;
  line-height: 1.3;
  font-weight: 700;
  color: #16324b;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.info-card {
  background: #fff;
  border: none;
  border-radius: 9px;
  padding: 10px 12px;
  box-shadow: none;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
}
.table-shell {
  display: block;
  width: 100%;
  align-self: stretch;
  overflow-x: auto;
  overflow-y: visible;
  border: none;
  border-radius: 12px;
  max-width: 100%;
  background: #ffffff;
  box-shadow: none;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  box-shadow: none;
  background-color: white;
  table-layout: auto;
}
th,
td {
  border: 1px solid #d9e2ec;
  padding: 9px 10px;
  text-align: center;
  font-size: 13px;
  vertical-align: middle;
  overflow-wrap: anywhere;
  word-break: break-word;
}
th {
  background: linear-gradient(135deg, #2f7bfa 0%, #1f62d0 100%);
  border-color: #c6d7ec;
  border-bottom-color: #b4cae5;
  color: white;
  font-weight: 700;
  letter-spacing: 0;
}
thead {
  display: table-header-group;
}
tbody {
  display: table-row-group;
}
tr {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
tr:nth-child(even) {
  background-color: #f8fbff;
}
.results-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.results-card {
  background: #ffffff;
  border: none;
  border-radius: 12px;
  padding: 14px;
  box-shadow: none;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: visible;
  background-clip: padding-box;
}
.results-card h3 {
  margin: 0;
  text-align: left;
  padding-bottom: 0;
  border-bottom: none;
}
.graph-section {
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.graph-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.graph-card {
  min-width: 0;
  padding: 13px;
  border: 1px solid #d9e2ec;
  border-radius: 12px;
  background: #ffffff;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.graph-card--wide {
  grid-column: 1 / -1;
}
.graph-card h3 {
  margin-bottom: 7px;
}
.report-graph {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.chart-grid-line {
  stroke: #dbe5ef;
  stroke-width: 1;
}
.chart-axis {
  stroke: #50657c;
  stroke-width: 1.2;
}
.chart-axis-label,
.chart-axis-title {
  fill: #50657c;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 10px;
}
.chart-axis-title {
  font-size: 11px;
  font-weight: 700;
}
.graph-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 7px 14px;
  margin-top: 4px;
  color: #40566d;
  font-size: 11px;
  font-weight: 600;
}
.graph-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.graph-legend-item i {
  width: 16px;
  height: 3px;
  border-radius: 99px;
}
.compact-table {
  margin-top: 0;
}
.compact-table th,
.compact-table td {
  padding: 8px 10px;
  font-size: 13px;
}
.report-equation-expression,
.report-error-expression {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.report-equation-fraction,
.report-error-fraction {
  display: inline-grid;
  grid-template-rows: auto auto;
  align-items: center;
  text-align: center;
  vertical-align: middle;
}
.report-equation-fraction i,
.report-error-fraction i {
  padding: 0 4px;
  font-style: normal;
  line-height: 1.2;
}
.report-equation-fraction i:first-child,
.report-error-fraction i:first-child {
  border-bottom: 1px solid currentColor;
}
.report-error-note {
  display: block;
  margin-top: 4px;
  color: #50657c;
  font-size: 0.92em;
}
.error-analysis-title {
  margin: 0 0 7px;
}
.header-row {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 108px;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  break-inside: avoid-page;
  page-break-inside: avoid;
}
.report-title-block {
  text-align: center;
  margin: 0;
  padding-bottom: 10px;
  border-bottom: 3px solid #2f7bfa;
  min-width: 0;
}
.report-title-block h1 {
  font-size: 25px;
}
.report-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #5c6f84;
}
.badge {
  margin: 0;
  padding: 7px 12px;
  border-radius: 20px;
  background: #e8f1ff;
  color: #1f62d0;
  font-weight: 600;
  font-size: 12px;
}
.report-logo {
  height: auto;
  width: auto;
  max-width: 108px;
  max-height: 84px;
  object-fit: contain;
  flex-shrink: 0;
  justify-self: center;
}
.report-logo--virtual-labs {
  max-width: 190px;
  max-height: 86px;
  justify-self: start;
}
.report-logo--iit {
  max-width: 88px;
  max-height: 88px;
  justify-self: end;
}
.report-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  width: min(100%, 960px);
  margin: 20px auto 0;
}
.print-btn,
.download-btn {
  padding: 12px 24px;
  font-size: 15px;
  border: none;
  border-radius: 30px;
  color: white;
  cursor: pointer;
  transition: all 0.25s ease;
}
.print-btn {
  background: linear-gradient(to right, #2f7bfa, #1f62d0);
}
.download-btn {
  background: linear-gradient(to right, #28a745, #1f8d38);
}
.print-btn:hover,
.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(31, 45, 61, 0.12);
}
body.pdf-exporting {
  width: 210mm;
  margin: 0;
  padding: 0;
  background: #fff;
  font-size: 9px;
  line-height: 1.2;
}
.pdf-exporting .report-document,
.pdf-exporting .report-page {
  width: 210mm;
}
.pdf-exporting .report-page {
  min-height: 297mm;
  margin: 0;
  padding: 7mm 8mm;
  overflow: visible;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.pdf-exporting .report-page--overview {
  break-after: auto;
  page-break-after: auto;
}
.pdf-exporting .report-page--results {
  break-before: page;
  break-after: auto;
  page-break-before: always;
  page-break-after: auto;
}
.pdf-exporting .header-row {
  grid-template-columns: 40mm minmax(0, 1fr) 19mm;
  gap: 3mm;
  margin-bottom: 3mm;
}
.pdf-exporting .report-logo,
.pdf-exporting .report-logo--virtual-labs,
.pdf-exporting .report-logo--iit {
  max-height: 14mm;
}
.pdf-exporting .report-title-block {
  padding-bottom: 4px;
}
.pdf-exporting .report-title-block h1 {
  font-size: 17px;
}
.pdf-exporting .report-subtitle,
.pdf-exporting .report-stamp,
.pdf-exporting .badge {
  font-size: 8px;
}
.pdf-exporting .section {
  margin-bottom: 5px;
  padding: 6px 8px;
  border-radius: 5px;
}
.pdf-exporting .section > h2:first-child {
  margin-bottom: 5px;
  padding-bottom: 3px;
}
.pdf-exporting h2 {
  margin-bottom: 5px;
  font-size: 13px;
}
.pdf-exporting h3 {
  margin-bottom: 3px;
  font-size: 10px;
}
.pdf-exporting p,
.pdf-exporting li {
  margin-bottom: 2px;
  font-size: 8.5px;
}
.pdf-exporting .report-overview-top {
  margin-bottom: 4px;
}
.pdf-exporting .report-experiment-label {
  margin-bottom: 2px;
  font-size: 7px;
}
.pdf-exporting .report-experiment-title {
  margin-bottom: 5px;
  font-size: 13px;
}
.pdf-exporting .info-grid {
  gap: 4px;
  margin-top: 4px;
}
.pdf-exporting .info-card {
  gap: 1px;
  padding: 4px 6px;
  font-size: 8px;
}
.pdf-exporting ul,
.pdf-exporting .two-column-list {
  margin-top: 3px;
}
.pdf-exporting .results-stack {
  gap: 4px;
}
.pdf-exporting .results-card {
  gap: 3px;
  padding: 0;
  overflow: visible;
}
.pdf-exporting .table-shell {
  overflow: visible;
}
.pdf-exporting .compact-table th,
.pdf-exporting .compact-table td {
  padding: 2px 2.5px;
  font-size: 8.2px;
  line-height: 1.1;
}
.pdf-exporting .graph-grid {
  gap: 7px;
}
.pdf-exporting .graph-card {
  padding: 6px;
  border-radius: 6px;
}
.pdf-exporting .graph-legend {
  gap: 3px 8px;
  margin-top: 1px;
  font-size: 7.5px;
}
@media (max-width: 768px) {
  body {
    padding: 20px 14px 30px;
  }
  .report-page {
    margin-bottom: 18px;
    padding: 20px 18px;
    border-radius: 16px;
  }
  .header-row {
    grid-template-columns: 1fr;
    gap: 14px;
    text-align: center;
  }
  .report-title-block {
    padding-bottom: 12px;
  }
  .report-logo,
  .report-logo--virtual-labs,
  .report-logo--iit {
    max-height: 72px;
    justify-self: center;
  }
  .two-column-list {
    column-count: 1;
    column-gap: 0;
  }
  .compact-table th,
  .compact-table td {
    padding: 9px 8px;
    font-size: 13px;
  }
  .report-actions {
    justify-content: center;
  }
}
@media print {
  @page {
    size: A4;
    margin: 0;
  }
  .print-btn,
  .download-btn,
  .report-actions {
    display: none !important;
  }
  html,
  body,
  body * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    width: 210mm;
    margin: 0;
    padding: 0;
    background: #ffffff;
    overflow: visible;
    font-size: 9px;
    line-height: 1.2;
  }
  .report-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    padding: 7mm 8mm;
    border: none;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .report-page--overview {
    break-after: auto;
    page-break-after: auto;
  }
  .report-page--results {
    break-before: page;
    break-after: auto;
    page-break-before: always;
    page-break-after: auto;
  }
  .header-row {
    grid-template-columns: 40mm minmax(0, 1fr) 19mm;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .report-logo,
  .report-logo--virtual-labs,
  .report-logo--iit { max-height: 14mm; }
  .report-title-block { padding-bottom: 4px; }
  .report-title-block h1 { font-size: 17px; }
  .report-subtitle,
  .report-stamp,
  .badge { font-size: 8px; }
  .section {
    margin-bottom: 5px;
    padding: 6px 8px;
    border-radius: 5px;
  }
  .section > h2:first-child {
    margin-bottom: 5px;
    padding-bottom: 3px;
  }
  h2 { margin-bottom: 5px; font-size: 13px; }
  h3 { margin-bottom: 3px; font-size: 10px; }
  p,
  li { margin-bottom: 2px; font-size: 8.5px; }
  .report-overview-top { margin-bottom: 4px; }
  .report-experiment-label { margin-bottom: 2px; font-size: 7px; }
  .report-experiment-title {
    margin-bottom: 5px;
    font-size: 13px;
  }
  .info-grid { gap: 4px; margin-top: 4px; }
  .info-card { gap: 1px; padding: 4px 6px; font-size: 8px; }
  ul,
  .two-column-list { margin-top: 3px; }
  .results-stack { gap: 4px; }
  .results-card { gap: 3px; padding: 0; }
  .compact-table th,
  .compact-table td { padding: 2px 2.5px; font-size: 8.2px; line-height: 1.1; }
  .graph-grid { gap: 7px; }
  .graph-card { padding: 6px; border-radius: 6px; }
  .graph-legend { gap: 3px 8px; margin-top: 1px; font-size: 7.5px; }
  .section,
  .header-row,
  .info-grid,
  .results-section,
  .results-card,
  .table-shell,
  .graph-card,
  .report-graph,
  thead,
  tr {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .table-shell {
    overflow: visible;
  }
}
  `

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Series RLC Circuit Simulation Report</title>
  <base href="${escapeHtml(baseHref)}">
  <style>${css}</style>
</head>
<body id="report-root">
  <main class="report-document" id="report-document">
  <div class="report-page report-page--overview">
    <div class="header-row">
      <img src="${escapeHtml(virtualLabsLogoSrc)}" class="report-logo report-logo--virtual-labs" alt="Virtual Labs logo">
      <div class="report-title-block">
        <h1>Virtual Labs Simulation Report</h1>
      </div>
      <img src="${escapeHtml(iitLogoSrc)}" class="report-logo report-logo--iit" alt="Indian Institute of Technology Roorkee logo">
    </div>

    <div class="section report-overview">
      <div class="report-overview-top">
        <p class="badge">AI-Enhanced Basic Electrical Science Lab</p>
        <p class="report-stamp">Generated on ${escapeHtml(reportDateText)}</p>
      </div>
      <p class="report-experiment-label">Experiment Title</p>
      <p class="report-experiment-title">To Study and measure the Voltage, Current, Power and Power Factor in a Series RLC Circuit</p>
      <div class="info-grid">
        <div class="info-card"><span class="label">Start Time:</span>${escapeHtml(startTimeText)}</div>
        <div class="info-card"><span class="label">End Time:</span>${escapeHtml(endTimeText)}</div>
        <div class="info-card"><span class="label">Total Time Spent:</span>${escapeHtml(durationText)}</div>
      </div>
    </div>

    <div class="section">
      <h3>Simulation Summary</h3>
      <p>The guided walkthrough familiarised the user with the simulation's interface. The circuit was connected, and the connections were verified successfully. The MCB was switched ON, and the desired voltage was set using the autotransformer. The readings were measured using the voltmeters, ammeter, and wattmeter for different RLC combinations, and these measured values were used to calculate the error analysis. Finally, the calculated values were verified, and the performance of the series RLC circuit was analysed successfully. </p>
      <p>${observations.length} observation readings were recorded. The tables below contain the recorded component selections and measurements, together with the theoretical values entered for the selected readings.</p>
      <h3>Apparatus Used:</h3>
      <ul class="two-column-list">
        <li>MCB: 6A, DP, 240V AC, Input Supply: 230 V AC, 50 Hz </li>
        <li>Autotransformer: 0 - 240 V AC. 4.05 kVA, 15 A</li>
        <li>AC Voltmeter 1: 0 - 50 V</li>
        <li>AC Voltmeter 2: 0 - 50 V</li>
        <li>AC Voltmeter 3: 0 - 50 V</li>
        <li>AC Voltmeter 4: 0 - 50 V</li>
        <li>AC Ammeter: 0 -30 mA</li>
        <li>AC Wattmeter: 0 - 1 W</li>
        <li>Resistor: 1 kΩ, 2 kΩ, 3 kΩ</li>
        <li>Inductor: 2 H, 5 H</li>
        <li>Capacitor: 2.2 µF, 4.7 µF</li>
        <li>Connecting Wires</li>
      </ul>     
    </div>

    <div class="section results-section">
      <h2>Observation Table</h2>
      <div class="results-stack">
        <div class="results-card">
          <div class="table-shell">
            <table class="compact-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>V<br/>(V)</th>
                  ${OBSERVATION_COLUMNS.map(({ label, unit }) => `<th>${label}${unit ? `<br/>(${unit})` : ''}</th>`).join('')}
                </tr>
              </thead>
              <tbody>${observationRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="section results-section">
      <h2>Theoretical Verification and Error Analysis</h2>
      <div class="results-stack">
        <div class="results-card">
          <div class="table-shell">
            <table class="compact-table">
              <thead>${createTheoreticalTableHeader()}</thead>
              <tbody>${theoreticalRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="report-page report-page--results">

    <div class="section">
      <h3>Conclusion</h3>
      <p style="text-align: justify;">The voltage, current, power, and power factor of the series RLC circuit were successfully measured and analyzed.</p>
    </div>
  </div>
  </main>

  <div class="report-actions" data-html2canvas-ignore="true">
    <button class="print-btn" type="button" onclick="window.print()">PRINT</button>
    <button class="download-btn" type="button" onclick="downloadReport()">DOWNLOAD REPORT</button>
  </div>

  <script>
    function ensureHtml2Pdf() {
      return new Promise(function(resolve, reject) {
        if (window.html2pdf) return resolve();
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    function downloadReport() {
      ensureHtml2Pdf().then(function() {
        var element = document.getElementById('report-document') || document.body;
        var opts = {
          margin: 0,
          filename: 'series-rlc-simulation-report.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            onclone: function(clonedDoc) {
              clonedDoc.body.classList.add('pdf-exporting');
            }
          },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: ['.report-page--results'],
            avoid: ['.header-row', '.report-overview', '.info-grid', '.graph-card', 'thead', 'tr']
          }
        };
        return window.html2pdf().set(opts).from(element).save();
      }).catch(function() {
        alert('Unable to download the report automatically. Please use your browser\\'s Save as PDF option.');
      });
    }
  </script>
</body>
</html>
  `
}

export const generateRlcReport = ({ observations, theoreticalCalculations, sessionStart }) => {
  const baseHref = new URL(import.meta.env.BASE_URL, window.location.origin).href
  const iitLogoSrc = new URL('../assets/IIT Logo.png', import.meta.url).href
  const virtualLabsLogoSrc = new URL('../assets/image.png', import.meta.url).href
  const reportHtml = createReportHtml({
    baseHref,
    iitLogoSrc,
    observations,
    theoreticalCalculations,
    sessionStart,
    virtualLabsLogoSrc,
  })
  const reportBlob = new Blob([reportHtml], { type: 'text/html' })
  const reportUrl = URL.createObjectURL(reportBlob)
  const reportWindow = window.open(reportUrl, '_blank')

  if (!reportWindow) {
    URL.revokeObjectURL(reportUrl)
    return false
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(reportUrl)
  }, 60000)
  reportWindow.focus()

  return true
}
