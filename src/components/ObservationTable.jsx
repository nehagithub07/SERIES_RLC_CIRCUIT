import SectionCard from './SectionCard.jsx'

const formatValue = (value) => value !== undefined && value !== null ? value.toFixed(2) : ''
const formatComponentValue = (value) => value !== undefined && value !== null ? String(Number(value)) : ''

const ObservationTable = ({ observations }) => (
  <SectionCard className="observation-card" icon="table" id="observation-table-panel" title="OBSERVATION TABLE">
    <div className="observation-table-wrap">
      <div className="observation-table-meta">
        <span className="observation-table-voltage-row">
          <span>Supply voltage</span>
          <strong>30 V</strong>
        </span>
        <span className="observation-table-count">{observations?.length || 0} / 12 recorded</span>
      </div>

      <table className="observation-table" aria-label="Series RLC observations">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>R<br /><span>(kΩ)</span></th>
              <th>L<br /><span>(H)</span></th>
              <th>C<br /><span>(µF)</span></th>
              <th>Nature</th>
              <th>I<br /><span>(mA)</span></th>
              <th>V<sub>R</sub><br /><span>(V)</span></th>
              <th>V<sub>L</sub><br /><span>(V)</span></th>
              <th>V<sub>C</sub><br /><span>(V)</span></th>
              <th>Power<br /><span>(W)</span></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, index) => {
              const row = observations?.[index]
              return (
                <tr className={row ? 'observation-row--recorded' : 'observation-row--empty'} key={row?.id || index}>
                  <td><span className="observation-row-number">{index + 1}</span></td>
                  <td>{formatComponentValue(row?.r)}</td>
                  <td>{formatComponentValue(row?.l)}</td>
                  <td>{formatComponentValue(row?.c)}</td>
                  <td>{row?.nature ? <span className="observation-nature">{row.nature}</span> : ''}</td>
                  <td>{formatValue(row?.current)}</td>
                  <td>{formatValue(row?.vR)}</td>
                  <td>{formatValue(row?.vL)}</td>
                  <td>{formatValue(row?.vC)}</td>
                  <td>{formatValue(row?.power)}</td>
                </tr>
              )
            })}
          </tbody>
      </table>
    </div>
  </SectionCard>
)

export default ObservationTable
