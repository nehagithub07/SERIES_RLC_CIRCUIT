const HeaderBoard = () => (
  <header className="header-board" id="experiment-title-board" style={{ position: 'relative' }}>
    <span className="header-board__ornament" />
    <h2>TO STUDY AND MEASURE THE VOLTAGE, CURRENT, POWER AND POWER FACTOR IN SERIES RLC CIRCUIT</h2>
    <span className="header-board__ornament header-board__ornament--right" />

    {/* TEMPORARY HEADER BOARD WALKTHROUGH BOX */}
    <div
      id="experiment-title-board-walkthrough-target"
      style={{
        position: 'absolute',
        
        // 1. POSITIONING & BOUNDS 
        // Adjust these to fine-tune the red dashed box over your title board
        left: '10px',       
        top: '11px',        
        width: '99%',    
        height: '60%',   

        pointerEvents: 'none', // Allows hover and clicks to pass through safely
        zIndex: 1000,          // Places target layer above text assets

        // 2. TEMPORARY DEBUG STYLES (Delete these two lines once aligned)
        // backgroundColor: 'rgba(255, 0, 0, 0.2)', 
        // border: '1px dashed red'                 
      }}
    />
  </header>
)

export default HeaderBoard
