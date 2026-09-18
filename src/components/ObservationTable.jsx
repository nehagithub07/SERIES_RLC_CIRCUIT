import SectionCard from './SectionCard.jsx'

import { OBSERVATION_COLUMNS, formatObservationValue } from '../utils/reportContent.js'

const ObservationTable = ({ observations }) => (
  <SectionCard className="observation-card" icon="table" id="observation-table-panel" title="OBSERVATION TABLE">
    <div className="observation-table-wrap">
      <div className="observation-table-meta">
        <span className="observation-table-voltage-row">
          <span>Supply voltage</span>
          <strong>{observations?.length ? [...new Set(observations.map((row) => row.voltage))].join(', ') + ' V' : '?'}</strong>
          <span>, f = 50Hz</span>
        </span>
        <span className="observation-table-count">{observations?.length || 0} / 12 recorded</span>
      </div>

      <table className="observation-table" aria-label="Series RLC observations">
          <thead>
            <tr>
              <th>S.No.</th>
              {OBSERVATION_COLUMNS.map(({ key, label, unit }) => (
                <th key={key}><span dangerouslySetInnerHTML={{ __html: label }} />{unit && <><br /><span>({unit})</span></>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, index) => {
              const row = observations?.[index]
              return (
                <tr className={row ? 'observation-row--recorded' : 'observation-row--empty'} key={row ? `observation-${row.id}` : `empty-${index}`}>
                  <td data-label="Reading"><span className="observation-row-number">{index + 1}</span></td>
                  {OBSERVATION_COLUMNS.map((column) => (
                    <td key={column.key} data-label={`${column.label.replace(/<[^>]*>/g, '')}${column.unit ? ` (${column.unit})` : ''}`}>
                      {formatObservationValue(row, column)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
      </table>
    </div>
  </SectionCard>
)

export default ObservationTable
