import { useState } from 'react';
import InductorImg from '../assets/inductor.png';
import '../App.css';

const Inductor = ({ onValueChange, disabled = false, selectedValue: controlledValue }) => {
  const [internalValue, setInternalValue] = useState('');
  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = (event) => {
    const value = event.target.value;
    setInternalValue(value);
    if (typeof onValueChange === 'function') {
      onValueChange(value);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      
      {/* Underlying asset structure without the targeting ID */}
      <article className="inductor-component">
        <h4 className="inductor-component__label">INDUCTOR</h4>

        <div className="inductor-asset-wrapper">
          <img 
            src={InductorImg} 
            alt="Inductor Asset" 
            className="inductor-asset-graphic" 
          />
        </div>

        {/* VALUE DROPDOWN - positioned near the blue marker beside the inductor.
            Fine-tune with --inductor-select-x / --inductor-select-y in App.css */}
        <select
          className="inductor-component__value-select"
          value={selectedValue}
          onChange={handleValueChange}
          disabled={disabled}
          aria-label="Select inductor value"
        >
          <option value="" disabled>Select H</option>
          <option value="2">2 H</option>
          <option value="5">5 H</option>
        </select>
      </article>

      {/* INVISIBLE WALKTHROUGH TARGET BOX (Maintained coordinates & ID) */}
      <div
        id="inductor-main"
        style={{
          position: 'absolute',
          
          // POSITIONING & BOUNDS: Kept exactly as you aligned them
          left: '45%',       
          top: '60%',        
          width: '70%',    
          height: '80%',   

          pointerEvents: 'none',
          zIndex: 1000
          
          // Debug styles have been safely removed
        }}
      />

    </div>
  );
};

export default Inductor;
