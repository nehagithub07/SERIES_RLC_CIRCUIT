import { useState } from 'react';
import ResistorImg from '../assets/Resistor.png';
import Resistor1Img from '../assets/Resistor1.png';
import Resistor1OhmImg from '../assets/1ohm.png';
import Resistor2OhmImg from '../assets/2ohm.png';
import Resistor3OhmImg from '../assets/3ohm.png';
import '../App.css';

// 🔧 Map each selectable resistor value to its corresponding labeled image
const RESISTOR_VALUE_IMAGES = {
  '1': Resistor1OhmImg,
  '2': Resistor2OhmImg,
  '3': Resistor3OhmImg,
};

const Resistor = ({ isCorrect, onValueChange, disabled = false, selectedValue: controlledValue }) => {
  const [internalValue, setInternalValue] = useState('');
  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (event) => {
    const value = event.target.value;
    setInternalValue(value);
    if (typeof onValueChange === 'function') {
      onValueChange(value);
    }
  };

  // Priority: verified-correct badge > user-selected value image > blank resistor
  const resolvedImage = isCorrect
    ? Resistor1Img
    : (RESISTOR_VALUE_IMAGES[selectedValue] || ResistorImg);

  const resolvedAlt = isCorrect
    ? 'Resistor Correct Value'
    : (selectedValue ? `Resistor ${selectedValue} Ohm` : 'Resistor');

  return (
    <article className="resistor-component" id="resistor-main">
      <h4 className="resistor-component__label">RESISTOR</h4>

      <div className="resistor-body-assembly">
        <div className="resistor-asset-wrapper">
          <img
            src={resolvedImage}
            alt={resolvedAlt}
            className="resistor-asset-graphic"
          />
        </div>
      </div>

      <select
        className="resistor-component__value-select"
        value={selectedValue}
        onChange={handleValueChange}
        disabled={disabled}
        aria-label="Select resistor value"
      >
        <option value="" disabled>Select kΩ</option>
        <option value="1">1 kΩ</option>
        <option value="2">2 kΩ</option>
        <option value="3">3 kΩ</option>
      </select>
    </article>
  );
};

export default Resistor;
