import v1Img from '../assets/V1.png';
import v2Img from '../assets/V2.png';
import v3Img from '../assets/V3.png';
import v4Img from '../assets/V4.png';
import needleImg from '../assets/needle.png';
import '../App.css';

const voltmeterImages = {
  V1: v1Img,
  V2: v2Img,
  V3: v3Img,
  V4: v4Img,
};

import { DIAL_GEOMETRY } from '../utils/rlcMeterCalibration.js';

// Shared with the RLC meter calibration table -- see
// src/utils/rlcMeterCalibration.js for how to hand-tune needle angles.
const METER_MAX_VOLTAGE = DIAL_GEOMETRY.voltmeter.maxValue;

const voltmeterAngles = {
  V1: { start: DIAL_GEOMETRY.voltmeter.startAngle, sweep: DIAL_GEOMETRY.voltmeter.sweepAngle },
  V2: { start: DIAL_GEOMETRY.voltmeter.startAngle, sweep: DIAL_GEOMETRY.voltmeter.sweepAngle },
  V3: { start: DIAL_GEOMETRY.voltmeter.startAngle, sweep: DIAL_GEOMETRY.voltmeter.sweepAngle },
  V4: { start: DIAL_GEOMETRY.voltmeter.startAngle, sweep: DIAL_GEOMETRY.voltmeter.sweepAngle },
};

/* STATIC ARTICLE ID LOOKUP */
const articleIds = {
  V1: "voltmeter-v1",
  V2: "voltmeter-v2",
  V3: "voltmeter-v3",
  V4: "voltmeter-v4",
};

/* STATIC WALKTHROUGH TARGET ID LOOKUP */
const walkthroughIds = {
  V1: "voltmeter-v1-walkthrough-target",
  V2: "voltmeter-v2-walkthrough-target",
  V3: "voltmeter-v3-walkthrough-target",
  V4: "voltmeter-v4-walkthrough-target",
};

/* SEPARATE BOX CONFIGURATION
   The fine-tuned manual layout coordinates for each voltmeter element
*/
const walkthroughLayouts = {
  V1: {
    left: '-255px',
    top: '18px',
    width: '120px',
    height: '220px'
  },
  V2: {
    left: '65px',
    top: '-280px',
    width: '120px',
    height: '220px'
  },
  V3: {
    left: '65px',
    top: '-130px',
    width: '120px',
    height: '210px'
  },
  V4: {
    left: '65px',
    top: '30px',
    width: '120px',
    height: '210px'
  }
};

const Voltmeter = ({ label = "V1", value = 0, angleDeg = null }) => {
  const voltage = Math.max(0, Math.min(Number(value), METER_MAX_VOLTAGE));
  const ratio = voltage / METER_MAX_VOLTAGE;
  // If an explicit angle was computed upstream (see rlcMeterCalibration.js),
  // use it directly so the RLC-case needle calibration can override the
  // generic value-based calculation below.
  const angle = Number.isFinite(angleDeg)
    ? angleDeg
    : voltmeterAngles[label].start + ratio * voltmeterAngles[label].sweep;

  // Static ID assignments extracted from the dictionaries
  const articleId = articleIds[label] || "voltmeter-default";
  const walkthroughTargetId = walkthroughIds[label] || "voltmeter-default-walkthrough-target";
  
  // Safely extracts the isolated configuration for the current voltmeter view
  const currentLayout = walkthroughLayouts[label] || { left: '0px', top: '0px', width: '120px', height: '200px' };

  return (
    <div className={`meter-shell meter-shell--voltmeter meter-shell--${label}`}>
      
      <article 
        id={articleId} 
        className={`voltmeter voltmeter--${label}`}
      >
        <img
          src={voltmeterImages[label]}
          alt={`${label} AC voltmeter`}
          className="voltmeter__image"
        />

        {/* Needle Pivot — handles rotation */}
        <div
          aria-hidden="true"
          className={`voltmeter__needle voltmeter__needle--${label}`}
          style={{ '--voltmeter-needle-rotation': `${angle}deg` }}
        >
          <img alt="" className="meter-needle-image" src={needleImg} />
        </div>
      </article>

      {/* Production Walkthrough Target Container — Clean and invisible */}
      <div
        id={walkthroughTargetId}
        style={{
          position: 'absolute',
          
          // Loaded dynamically from the separate layout coordinates mapping above
          left: currentLayout.left,       
          top: currentLayout.top,        
          width: currentLayout.width,    
          height: currentLayout.height,   

          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
      
    </div>
  );
};

export default Voltmeter;
