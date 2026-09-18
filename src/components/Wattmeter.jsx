import '../App.css' 

import w1Img from '../assets/W1.png'
import needleImg from '../assets/needle.png'
import { DIAL_GEOMETRY } from '../utils/rlcMeterCalibration.js'

// Shared with the RLC meter calibration table -- see
// src/utils/rlcMeterCalibration.js for how to hand-tune needle angles.
const METER_MAX_POWER = DIAL_GEOMETRY.wattmeter.maxValue
const DIAL_START_ANGLE = DIAL_GEOMETRY.wattmeter.startAngle 
const DIAL_SWEEP_ANGLE = DIAL_GEOMETRY.wattmeter.sweepAngle

const Wattmeter = ({ value = 0, angleDeg = null }) => {
  const power = Number.isFinite(Number(value)) ? Number(value) : 0
  const ratio = Math.min(Math.max(power / METER_MAX_POWER, 0), 1)
  // If an explicit angle was computed upstream (see rlcMeterCalibration.js),
  // use it directly so the RLC-case needle calibration can override the
  // generic value-based calculation below.
  const angle = Number.isFinite(angleDeg)
    ? angleDeg
    : DIAL_START_ANGLE + ratio * DIAL_SWEEP_ANGLE

  return (
    <div className="meter-shell meter-shell--wattmeter">
      
      <article className="wattmeter wattmeter--W1" >
        {/* Background Dial Image */}
        <img src={w1Img} alt="W1 wattmeter" className="wattmeter__background-image" />

        {/* Needle Pivot — handles rotation */}
        <div
          className="wattmeter__needle" 
          aria-hidden="true"
          style={{ '--wattmeter-needle-rotation': `${angle}deg` }}
        >
          <img alt="" className="meter-needle-image" src={needleImg} />
        </div>
      </article>

      {/* Production Walkthrough Target Container — Clean and invisible */}
      <div
        id="wattmeter-w1"
        style={{
          position: 'absolute',
          
          // 1. POSITIONING
          left: '-325px',       
          top: '30px',        

          // 2. SIZING
          width: '120px',    
          height: '200px',   

          pointerEvents: 'none',
          zIndex: 1000
        }}
      />

    </div>
  )
}

export default Wattmeter
