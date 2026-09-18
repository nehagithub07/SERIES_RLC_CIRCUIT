import ObservationTable from './ObservationTable.jsx'
import CorrectValuesPanel from './CorrectValuesPanel.jsx'

const ControlPanel = ({ observations, showCorrectValues = false, onCloseCorrectValues }) => (
  <div className="control-panel">
    <ObservationTable observations={observations} />
    {showCorrectValues && <CorrectValuesPanel onClose={onCloseCorrectValues} />}
  </div>
)

export default ControlPanel
