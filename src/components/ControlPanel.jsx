import ObservationTable from './ObservationTable.jsx'

const ControlPanel = ({ observations }) => (
  <div className="control-panel">
    <ObservationTable observations={observations} />
  </div>
)

export default ControlPanel
