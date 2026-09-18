import { useState, useRef, useEffect } from 'react';
import '../App.css';

import variacOffImg from '../assets/Variac_ON.png';
import variacOnImg from '../assets/Variac_OFF.png';
import innerKnob from '../assets/inner.jpg';

const Variac = ({ onValueChange, maxVal = 30, powerOn, componentsSelected = true, onBlocked, onTurnedOn, onRotate, resetRequest }) => {
  const [isOn, setIsOn] = useState(false);
  const [rotationRun, setRotationRun] = useState(0);
  // Tracks whether the knob has completed at least one move to 30 V.
  const [isLocked, setIsLocked] = useState(false);

  // RESET: only a full laboratory reset returns the variac to OFF.
  const isFirstResetRef = useRef(true);
  useEffect(() => {
    if (isFirstResetRef.current) {
      // Skip on initial mount so we don't re-trigger a no-op reset.
      isFirstResetRef.current = false;
      return;
    }

    setIsOn(false);
    setRotationRun(0);
    setIsLocked(false);
  }, [resetRequest]);

  const handleDialClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOn) {
      onBlocked?.();
      return;
    }

    // Remounting the knob image restarts the 0-to-30 CSS animation reliably.
    setRotationRun((current) => current + 1);
    setIsLocked(true);

    onRotate?.();

    if (onValueChange) {
      onValueChange(maxVal);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      
      <div className="variac-container" id="autotransformer-panel">
        <div className="variac-visual">
          <img
            src={isOn === true ? variacOnImg : variacOffImg}
            alt={isOn ? "Variac Panel ON" : "Variac Panel OFF"}
            className="variac-bg"
          />
        </div>

        <button
          type="button"
          className="variac-knob-wrapper"
          onClick={handleDialClick}
          tabIndex={isOn ? 0 : -1}
          aria-label={isLocked ? 'Variac is at 30 volts; click to replay movement' : 'Set Variac to 30 volts'}
          aria-disabled={!isOn}
          style={{ cursor: isOn ? 'pointer' : 'default' }}
        >
          <img
            key={rotationRun}
            src={innerKnob}
            alt="Variac Knob"
            className={`variac-knob-inner ${rotationRun > 0 ? 'variac-knob-inner--to-thirty' : ''}`}
          />
        </button>

        <button
          type="button"
          className={`variac-power-button-target ${isOn ? 'disabled' : ''}`}
          disabled={isOn}
          onClick={(e) => {
            e.stopPropagation();
            if (!powerOn) {
              onBlocked?.();
              return;
            }
            if (!componentsSelected) {
              onBlocked?.();
              return;
            }
            if (isOn === false) {
              setIsOn(true);
              setRotationRun(0);
              setIsLocked(false);
              onTurnedOn?.();
            }
          }}
          aria-label="Turn Power On"
          title={isOn ? "Power is ON" : "Turn Power ON"}
          style={{ cursor: isOn ? 'not-allowed' : 'pointer' }}
        />

      </div>
    </div>
  );
};

export default Variac;
