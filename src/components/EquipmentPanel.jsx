import { Fragment } from 'react';
import Ammeter from './Ammeter.jsx';
import Voltmeter from './Voltmeter.jsx';
import Wattmeter from './Wattmeter.jsx';
import Resistor from './Resistor.jsx';
import Capacitor from './Capacitor.jsx';
import Inductor from './inductor.jsx';
import MCB from './MCB.jsx';
import Variac from './Variac.jsx';

const mcbTerminals = [
  { id: '1-endpoint', label: '1', polarity: 'plus', left: 33, top: 155, lLeft: 45, lTop: 190 },
  { id: '2-endpoint', label: '2', polarity: 'minus', left: 70, top: 155, lLeft: 84, lTop: 190 },
];

const voltmeter1Terminals = [
  { id: '3-endpoint', label: '3', polarity: 'plus', left: 160, top: 175, lLeft: 173, lTop: 210 },
  { id: '4-endpoint', label: '4', polarity: 'minus', left: 235, top: 175, lLeft: 248, lTop: 210 },
];

const ammeter1Terminals = [
  { id: '5-endpoint', label: '5', polarity: 'plus', left: 338, top: 170, lLeft: 351, lTop: 205 },
  { id: '6-endpoint', label: '6', polarity: 'minus', left: 413, top: 170, lLeft: 426, lTop: 205 },
];

const wattmeterTerminals = [
  { id: '7-endpoint', label: '7', polarity: 'minus', left: 492, top: 205, lLeft: 505, lTop: 240 },
  { id: '8-endpoint', label: '8', polarity: 'plus', left: 530, top: 205, lLeft: 543, lTop: 240 },
  { id: '9-endpoint', label: '9', polarity: 'plus', left: 568, top: 205, lLeft: 582, lTop: 240 },
  { id: '10-endpoint', label: '10', polarity: 'plus', left: 605, top: 205, lLeft: 620, lTop: 240 },
];

const voltmeter2Terminals = [
  { id: '11-endpoint', label: '11', polarity: 'plus', left: 690, top: 180, lLeft: 703, lTop: 215 },
  { id: '12-endpoint', label: '12', polarity: 'minus', left: 760, top: 180, lLeft: 773, lTop: 215 },
];

const voltmeter3Terminals = [
  { id: '13-endpoint', label: '13', polarity: 'plus', left: 695, top: 435, lLeft: 710, lTop: 480 },
  { id: '14-endpoint', label: '14', polarity: 'minus', left: 770, top: 435, lLeft: 785, lTop: 480 },
];

const voltmeter4Terminals = [
  { id: '15-endpoint', label: '15', polarity: 'plus', left: 690, top: 710, lLeft: 703, lTop: 745 },
  { id: '16-endpoint', label: '16', polarity: 'minus', left: 770, top: 710, lLeft: 783, lTop: 745 },
];

const resistorTerminals = [
  { id: '17-endpoint', label: '17', polarity: 'plus', left: 380, top: 380, lLeft: 394, lTop: 338 },
  { id: '18-endpoint', label: '18', polarity: 'minus', left: 610, top: 380, lLeft: 625, lTop: 420 },
];

const inductorTerminals = [
  { id: '19-endpoint', label: '19', polarity: 'plus', left: 488, top: 706, lLeft: 501, lTop: 741 },
  { id: '20-endpoint', label: '20', polarity: 'minus', left: 537, top: 706, lLeft: 550, lTop: 741 },
];

const capacitorTerminals = [
  { id: '21-endpoint', label: '21', polarity: 'plus', left: 306, top: 734, lLeft: 319, lTop: 769 },
  { id: '22-endpoint', label: '22', polarity: 'minus', left: 344, top: 734, lLeft: 360, lTop: 769 },
];

const variacTerminals = [
  { id: '23-endpoint', label: '23', polarity: 'plus', left: 240, top: 365, lLeft: 253, lTop: 400 },
  { id: '24-endpoint', label: '24', polarity: 'minus', left: 315, top: 365, lLeft: 330, lTop: 405 },
  { id: '25-endpoint', label: '25', polarity: 'plus', left: 240, top: 465, lLeft: 252, lTop: 503 },
  { id: '26-endpoint', label: '26', polarity: 'minus', left: 315, top: 465, lLeft: 330, lTop: 503 },
];

const renderTerminals = (terminals) => (
  terminals.map(({ id, label, polarity, left, top, lLeft, lTop }, index) => (
    <Fragment key={id}>
      <span
        id={id}
        className="connection-terminal"
        data-polarity={polarity}
        aria-label={`Terminal ${label}`}
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          zIndex: 50,
          cursor: 'crosshair'
          , '--terminal-x': `${15 + (index / Math.max(1, terminals.length - 1)) * 70}%`
        }}
      />
      <span
        className="terminal-number-label"
        data-terminal-id={id}
        style={{
          position: 'absolute',
          left: `${lLeft}px`,
          top: `${lTop}px`,
          zIndex: 50,
          '--terminal-x': `${15 + (index / Math.max(1, terminals.length - 1)) * 70}%`,
        }}
      >
        {label}
      </span>
    </Fragment>
  ))
);

const EquipmentPanel = ({
  onTogglePower,
  onVariacBlocked,
  onVariacOn,
  onVariacRotate,
  powerOn,
  connectionsVerified = false,
  readings = {},
  setVoltage,
  isResistorCorrect,
  resetRequest,
  componentsSelected = true,
  selectedResistor,
  selectedInductor,
  selectedCapacitor,
  onResistorChange,
  onInductorChange,
  onCapacitorChange,
}) => {
  
  const safeReadings = {
    V1: readings.v1 ?? 0,
    V2: readings.v2 ?? 0,
    V3: readings.v3 ?? 0,
    V4: readings.v4 ?? 0,
    A1: readings.A1 ?? readings.current ?? 0,
    W1: readings.power ?? 0,
    R1: 0, 
    C1: 0, 
    I1: 0,
  };

  // 🎯 Pre-computed needle rotation angles for the selected RLC case (see
  // src/utils/rlcMeterCalibration.js). Falls back to `null` for each meter
  // so it uses its own generic value-based calculation if angles aren't
  // available yet (e.g. before a full R/L/C combination is selected).
  const needleAngles = readings.angles || {};

  return (
    <section className="equipment-panel" id="equipment-panel" style={{ position: 'relative' }}>
      
      <div className="eq-item eq-mcb">
        <MCB onTogglePower={onTogglePower} powerOn={powerOn} />
        {renderTerminals(mcbTerminals)}
      </div>
      
      <div className="eq-item eq-v1">
        <Voltmeter label="V1" value={safeReadings.V1} />
        {renderTerminals(voltmeter1Terminals)}
      </div>
      
      <div className="eq-item eq-a1">
        <Ammeter label="A1" value={safeReadings.A1} angleDeg={needleAngles.current} />
        {renderTerminals(ammeter1Terminals)}
      </div>
      
      <div className="eq-item eq-w1">
        <Wattmeter label="W1" value={safeReadings.W1} angleDeg={needleAngles.power} />
        {renderTerminals(wattmeterTerminals)}
      </div>

      <div className="eq-item eq-r1">
        {/* Pass down validation parameter cleanly */}
        <Resistor
          label="R1"
          value={safeReadings.R1}
          isCorrect={isResistorCorrect}
          disabled={!connectionsVerified || !powerOn}
          selectedValue={selectedResistor}
          onValueChange={onResistorChange}
        />
        {renderTerminals(resistorTerminals)}
      </div>

      <div className="eq-item eq-variac">
        <Variac 
          label="Variac" 
          onValueChange={setVoltage} 
          maxVal={30} 
          powerOn={powerOn} 
          componentsSelected={componentsSelected}
          onBlocked={onVariacBlocked}
          onTurnedOn={onVariacOn}
          onRotate={onVariacRotate}
          resetRequest={resetRequest}
        />
        {renderTerminals(variacTerminals)}
      </div>
      
      <div className="eq-item eq-i1">
        <Inductor
          label="I1"
          value={safeReadings.I1}
          disabled={!connectionsVerified || !powerOn}
          selectedValue={selectedInductor}
          onValueChange={onInductorChange}
        />
        {renderTerminals(inductorTerminals)}
      </div>

      <div className="v-meters-right-stack">
        <div>
          <Voltmeter label="V2" value={safeReadings.V2} angleDeg={needleAngles.vR} />
          {renderTerminals(voltmeter2Terminals)}
        </div>
        <div>
          <Voltmeter label="V3" value={safeReadings.V3} angleDeg={needleAngles.vL} />
          {renderTerminals(voltmeter3Terminals)}
        </div>
        <div>
          <Voltmeter label="V4" value={safeReadings.V4} angleDeg={needleAngles.vC} />
          {renderTerminals(voltmeter4Terminals)}
        </div>
      </div>

      <div className="eq-item eq-c1">
        <Capacitor
          label="C1"
          value={safeReadings.C1}
          disabled={!connectionsVerified || !powerOn}
          selectedValue={selectedCapacitor}
          onValueChange={onCapacitorChange}
        />
        {renderTerminals(capacitorTerminals)}
      </div>

    </section>
  );
};

export default EquipmentPanel;
