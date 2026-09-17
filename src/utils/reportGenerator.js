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
        <td>${index + 1}</td>
        <td>${formatNumber(row.voltage, 1)}</td>
        <td>${formatNumber(row.current)}</td>
        <td>${formatNumber(row.vR)}</td>
        <td>${formatNumber(row.vL)}</td>
        <td>${formatNumber(row.vC)}</td>
        <td>${formatNumber(row.power, 4)}</td>
      </tr>
    `).join('')
)

// Columns for the verified-reading table, matching the
// observation table's Excel-style headings (label on top, unit below).
const THEORETICAL_COLUMNS = [
  ['V', '(V)', 'voltage'],
  ['I', '(mA)', 'current'],
  ['R', '(kΩ)', 'r'],
  ['L', '(H)', 'l'],
  ['C', '(µF)', 'c'],
  ['VR', '(V)', 'vR'],
  ['Error', '(%)', 'vRError'],
  ['VL', '(V)', 'vL'],
  ['Error', '(%)', 'vLError'],
  ['VC', '(V)', 'vC'],
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
  const rows = Array.isArray(theoreticalCalculations) ? theoreticalCalculations : []

  return Array.from({ length: 5 }, (_, index) => {
    const row = rows[index] ?? {}

    return `
      <tr>
        <td>${index + 1}</td>
        ${THEORETICAL_COLUMNS.map(([, , key]) => `<td>${formatEntry(row[key])}</td>`).join('')}
      </tr>
    `
  }).join('')
}

const createReportHtml = ({
  baseHref,
  iitLogoSrc,
  observations,
  parameters,
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
  const theoreticalRows = createTheoreticalRows(theoreticalCalculations)

  const resistanceOhms = toNumber(parameters?.r)
  const inductanceHenries = toNumber(parameters?.l)
  const capacitanceFarads = toNumber(parameters?.c)
  const inductanceMh = inductanceHenries * 1000
  const capacitanceUf = capacitanceFarads * 1e6

  const css = `
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
.compact-table {
  margin-top: 0;
}
.compact-table th,
.compact-table td {
  padding: 8px 10px;
  font-size: 13px;
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
.pdf-exporting .report-page {
  border-color: transparent !important;
  box-shadow: none !important;
  margin-bottom: 0 !important;
}
.pdf-exporting .section,
.pdf-exporting .results-card,
.pdf-exporting .table-shell {
  overflow: visible !important;
}
.pdf-exporting .report-page--overview,
.pdf-exporting .report-page--results {
  break-after: page !important;
  page-break-after: always !important;
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
    margin: 12mm;
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
    margin: 0;
    padding: 0;
    background: #ffffff;
    overflow: visible;
  }
  .report-page {
    width: 100%;
    margin: 0;
    padding: 16px 18px;
    border: none;
    box-shadow: none;
    border-radius: 0;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  .header-row {
    grid-template-columns: 150px minmax(0, 1fr) 86px;
    gap: 16px;
  }
  .report-experiment-title {
    font-size: 22px;
  }
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
        <p class="report-subtitle">AI-Enhanced Basic Electrical Science Lab</p>
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
      <p style="text-align: justify;">The simulation analyzed the characteristics of a series RLC circuit by applying an AC voltage across a resistor, inductor and capacitor connected in series. Key observations included measuring the supply voltage, circuit current, the voltage drop across each component, and the active power. These readings were used to validate AC circuit principles, and to theoretically calculate the circuit's overall impedance, reactances and power factor.</p>

      <h3>Apparatus Used</h3>
      <ul class="two-column-list">
        <li>MCB : 6A, DP, 240 V AC</li>
        <li>Autotransformer : 0-30V AC</li>
        <li>AC Voltmeter (V1) for supply voltage : 0-50 V</li>
        <li>AC Voltmeter (V2) for voltage across Resistor : 0-50 V</li>
        <li>AC Voltmeter (V3) for voltage across Inductor : 0-50 V</li>
        <li>AC Voltmeter (V4) for voltage across Capacitor : 0-50 V</li>
        <li>AC Ammeter (A1) for circuit current : 0-2 A</li>
        <li>AC Wattmeter : 0-50W AC</li>
        <li>Resistor (R) : ${formatNumber(resistanceOhms, 0)} &Omega;</li>
        <li>Inductor (L) : ${formatNumber(inductanceMh, 0)} mH</li>
        <li>NonPolar Capacitor (C) : ${formatNumber(capacitanceUf, 0)} &micro;F</li>
        <li>Connecting leads</li>
      </ul>

      <h3>Calculation Formulae</h3>
      <ul>
        <li><strong>Resistive Voltage:</strong> V<sub>R</sub> = I &times; R</li>
        <li><strong>Inductive Voltage:</strong> V<sub>L</sub> = I &times; X<sub>L</sub></li>
        <li><strong>Capacitive Voltage:</strong> V<sub>C</sub> = I &times; X<sub>C</sub></li>
        <li><strong>Inductive Reactance:</strong> X<sub>L</sub> = 2&pi;fL</li>
        <li><strong>Capacitive Reactance:</strong> X<sub>C</sub> = 1 / (2&pi;fC)</li>
        <li><strong>Impedance:</strong> Z = &radic;(R&sup2; + (X<sub>L</sub> &minus; X<sub>C</sub>)&sup2;)</li>
        <li><strong>Circuit Current:</strong> I = V / Z</li>
        <li><strong>Active Power:</strong> P = VI cos(&phi;)</li>
      </ul>
    </div>
  </div>

  <div class="report-page report-page--results">
    <div class="section results-section">
      <h2>Observation Table</h2>
      <div class="results-stack">
        <div class="results-card">
          <div class="table-shell">
            <table class="compact-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>V<sub>R</sub> (V)</th>
                  <th>V<sub>L</sub> (V)</th>
                  <th>V<sub>C</sub> (V)</th>
                  <th>Power (kW)</th>
                </tr>
              </thead>
              <tbody>${observationRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="section results-section">
      <h2>Verified Readings</h2>
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
          margin: [0.18, 0.18, 0.18, 0.18],
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
            avoid: ['.report-page', '.header-row', '.report-overview', '.info-grid', 'thead', 'tr']
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

export const generateRlcReport = ({ observations, parameters, theoreticalCalculations, sessionStart }) => {
  const baseHref = new URL(import.meta.env.BASE_URL, window.location.origin).href
  const iitLogoSrc = new URL('../assets/IIT Logo.png', import.meta.url).href
  const virtualLabsLogoSrc = new URL('../assets/image.png', import.meta.url).href
  const reportHtml = createReportHtml({
    baseHref,
    iitLogoSrc,
    observations,
    parameters,
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
