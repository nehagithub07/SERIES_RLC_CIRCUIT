import { useState } from 'react';
import CapacitorImg from '../assets/Capacitor.png'; // Make sure the asset exists in your folder
import '../App.css';

const Capacitor = ({ onValueChange, disabled = false, selectedValue: controlledValue }) => {
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
    <article className="capacitor-component" >
      
      {/* The outer wrapper is given relative positioning so that the 
        absolute walkthrough target aligns itself perfectly to this element.
      */}
      <div 
        className="capacitor-container" 
        style={{ position: 'relative', display: 'inline-block' }}
      >
        
        {/* Core Asset Graphic - the select lives INSIDE this transformed wrapper
            so it automatically tracks the image's translate(-500px,150px) scale(2.2).
            An inner "anchor" cancels the 2.2x scale so the dropdown renders at
            normal, readable size while staying pinned to the image. */}
        <div className="capacitor-asset-wrapper">
          <img 
            src={CapacitorImg} 
            alt="Capacitor Asset" 
            className="capacitor-asset-graphic" 
            data-spotlight-bounds="0.291,0.100,0.346,0.744"
          />

          {/* VALUE DROPDOWN - anchored to the bottom-center of the capacitor image.
              Fine-tune with --capacitor-select-x / --capacitor-select-y in App.css
              (both are real on-screen pixels, not affected by the image's 2.2x scale). */}
          <div className="capacitor-select-anchor">
            <select
              className="capacitor-component__value-select"
              value={selectedValue}
              onChange={handleValueChange}
              disabled={disabled}
              aria-label="Select capacitor value"
            >
              <option value="" disabled>Select µF</option>
              <option value="2.2">2.2 µF</option>
              <option value="4.7">4.7 µF</option>
            </select>
          </div>
        </div>

        {/* TEMPORARY CAPACITOR WALKTHROUGH BOX */}
        <div
          id="capacitor-panel-walkthrough-target"
          style={{
            position: 'absolute',
            
            // 1. POSITIONING & BOUNDS 
            // Adjust left, top, width, and height to match your visual asset casing layout
            left: '-500px',       
            top: '145px',        
            width: '80%',    
            height: '120%',   

            pointerEvents: 'none', // Allows clicks to pass through safely
            zIndex: 1000,          // Forces target layer above background assets

            // 2. TEMPORARY DEBUG STYLES (Delete these two lines once aligned)
            // backgroundColor: 'rgba(255, 0, 0, 0.3)', 
            // border: '2px dashed red'                 
          }}
        />

      </div>
    </article>
  );
};

export default Capacitor;
