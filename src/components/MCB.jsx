import mcbOff from '../assets/MCB_OFF.jpeg'
import mcbOnImg from '../assets/MCB_ON.jpeg'
import '../App.css'; 

const MCB = ({ powerOn, onTogglePower }) => {
  return (
    <div style={{ width: '120px', height: 'auto' }}>
      <article
        id="mcb-supply"
        className="mcb"
        style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      >
        <img
          alt={powerOn ? 'MCB switched on' : 'MCB switched off'}
          className="mcb__image"
          src={powerOn ? mcbOnImg : mcbOff}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />

        <button
          aria-label={powerOn ? 'MCB is on for this laboratory run' : 'Switch MCB on'}
          aria-pressed={powerOn}
          className="mcb__button"
          disabled={powerOn}
          onClick={() => {
            if (powerOn) {
              // If it's already ON, do nothing (prevent turning off during experiment)
              return;
            }
            
            // Turn it ON smoothly without browser alert side-effects
            onTogglePower();
          }}
          type="button"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: powerOn ? 'not-allowed' : 'pointer',
            border: 'none',
            padding: 0,
            background: 'none'
          }}
        />
      </article>
    </div>
  )
}

export default MCB
