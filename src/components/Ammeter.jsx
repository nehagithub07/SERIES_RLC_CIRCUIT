import '../App.css' 
import a1Img from '../assets/A.png'
import needleImg from '../assets/needle.png'
import { DIAL_GEOMETRY } from '../utils/rlcMeterCalibration.js'

// 🎯 Shared with the RLC meter calibration table — see
// src/utils/rlcMeterCalibration.js for how to hand-tune needle angles.
// Value is in milliAmps (mA), matching the RLC reference readings table.
const METER_MAX_CURRENT = DIAL_GEOMETRY.ammeter.maxValue
const DIAL_START_ANGLE = DIAL_GEOMETRY.ammeter.startAngle
const DIAL_SWEEP_ANGLE = DIAL_GEOMETRY.ammeter.sweepAngle

const Ammeter = ({ value = 0, angleDeg = null }) => {
  const current = Number.isFinite(value) ? value : 0
  const ratio = Math.min(Math.max(current / METER_MAX_CURRENT, 0), 1)
  // If an explicit angle was computed upstream (see rlcMeterCalibration.js),
  // use it directly so the RLC-case needle calibration can override the
  // generic value-based calculation below.
  const angle = Number.isFinite(angleDeg)
    ? angleDeg
    : DIAL_START_ANGLE + ratio * DIAL_SWEEP_ANGLE

  return (
    <div className="meter-shell meter-shell--ammeter">
      
      <article className="ammeter"> 
        {/* Background Dial/Meter Image */}
        <img src={a1Img} alt="A1 ammeter dial" className="ammeter__dial" />

        {/* NEEDLE PIVOT — zero-size rotation anchor */}
        <div
          className="ammeter__needle" 
          aria-hidden="true"
          style={{ '--ammeter-needle-rotation': `${angle}deg` }}
        >
          <img alt="" className="meter-needle-image" src={needleImg} />
        </div>
      </article>

      {/* Production Walkthrough Target Container */}
      <div
        id="ammeter-main"
        style={{
          position: 'absolute',
          
          // 1. POSITIONING
          left: '-390px',       
          top: '20px',        

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

export default Ammeter
