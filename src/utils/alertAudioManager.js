// 1. DIRECT AUDIO PATH STRINGS (Cleaned up from JSON mapping)
const afterCorrVerifAudio = "/audio/After correct verification, verify button.wav";
const forCorrConnCheckClickAudio = "/audio/For correct connections, check click.wav";
const genRepBtnClickAudio = "/audio/Generate Report button click.wav";

// 2. CREATE AUDIO OBJECTS
const alertSounds = {
  // Setup interface & connections
  aiGuideClick: typeof Audio !== "undefined" ? new Audio('/audio/AI Guide click.wav') : null,
  interfaceWalkthroughComplete: typeof Audio !== "undefined" ? new Audio('/audio/The interface walkthrough is now complete.wav') : null,
  correctConnections: typeof Audio !== "undefined" ? new Audio('/audio/Correct Connections.wav') : null,
  connectTerminal2To24: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 2 to terminal 24.wav') : null,
  connectTerminal3To25: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 3 to terminal 25.wav') : null,
  connectTerminal4To26: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 4 to terminal 26.wav') : null,
  connectTerminal5To25: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 5 to terminal 25.wav') : null,
  connectTerminal6To9: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 6 to terminal 9.wav') : null,
  connectTerminal9To10: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 9 to terminal 10.wav') : null,
  connectTerminal7To18: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 7 to terminal 18.wav') : null,
  connectTerminal7To26: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 7 to terminal 26.wav') : null,
  connectTerminal8To17: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 8 to terminal 17.wav') : null,
  connectTerminal11To17: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 11 to terminal 17.wav') : null,
  connectTerminal12To18: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 12 to terminal 18.wav') : null,
  connectTerminal13To19: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 13 to terminal 19.wav') : null,
  connectTerminal14To20: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 14 to terminal 20.wav') : null,
  connectTerminal15To21: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 15 to terminal 21.wav') : null,
  connectTerminal16To22: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 16 to terminal 22.wav') : null,
  connectTerminal18To19: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 18 to terminal 19.wav') : null,
  connectTerminal20To21: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 20 to terminal 21.wav') : null,
  connectTerminal22To26: typeof Audio !== "undefined" ? new Audio('/audio/Connect terminal 22 to terminal 26.wav') : null,
  
  // Checking rules & validation alerts
  guideAllComplete: typeof Audio !== "undefined" ? new Audio('/audio/Guide all complete conn.wav') : null,
  wrongConn: typeof Audio !== "undefined" ? new Audio('/audio/Wrong connection.wav') : null,
  multiWrong: typeof Audio !== "undefined" ? new Audio('/audio/Multiple wrong connections.wav') : null,
  firstCheck: typeof Audio !== "undefined" ? new Audio('/audio/1st time check button click.wav') : null,
  autoConnect: typeof Audio !== "undefined" ? new Audio('/audio/Autoconnect.wav') : null,
  mcbAlert: typeof Audio !== "undefined" ? new Audio('/audio/Before connection, on-click MCB Alert.wav') : null,
  firstAutoTransClick: typeof Audio !== "undefined" ? new Audio('/audio/1st time autotransformer click or after ch...wav') : null,
  forCorrConnCheckClick: typeof Audio !== "undefined" ? new Audio(forCorrConnCheckClickAudio) : null,
  
  // Simulation hardware operational phases
  mcbOn: typeof Audio !== "undefined" ? new Audio('/audio/MCB ON.wav') : null,
  afterAutoTransOn: typeof Audio !== "undefined" ? new Audio('/audio/After the autotransformer is ON.wav') : null,
  afterVolSet: typeof Audio !== "undefined" ? new Audio('/audio/After Voltage is set.wav') : null,
  
  // Table action & Calculations verification responses
  firstReadAdded: typeof Audio !== "undefined" ? new Audio('/audio/1st readings added.wav') : null,
  afterReadAddClick: typeof Audio !== "undefined" ? new Audio('/audio/After taking the readings, Add click.wav') : null,
  afterCorrVerif: typeof Audio !== "undefined" ? new Audio(afterCorrVerifAudio) : null,
  incompltMultiVal: typeof Audio !== "undefined" ? new Audio('/audio/Incomplete more than one value.wav') : null,
  incompltOneVal: typeof Audio !== "undefined" ? new Audio('/audio/Incomplete one value.wav') : null,
  incorrCalcMulti: typeof Audio !== "undefined" ? new Audio('/audio/Incorrect calculations, more than one.wav') : null,
  incorrCalcOne: typeof Audio !== "undefined" ? new Audio('/audio/Incorrect calculation, one only.wav') : null,
  
  // Footer utilities / report actions
  genRepBtnClick: typeof Audio !== "undefined" ? new Audio(genRepBtnClickAudio) : null,
  reset: typeof Audio !== "undefined" ? new Audio('/audio/Reset.wav') : null,
  print: typeof Audio !== "undefined" ? new Audio('/audio/Print.wav') : null,
};

let currentPlayingAudio = null;

// 3. PLAY FUNCTION
export const playAlertSound = (key) => {
  const sound = alertSounds[key];
  if (sound) {
    if (currentPlayingAudio) {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    }
    
    sound.currentTime = 0;
    sound.onended = () => {
      if (currentPlayingAudio === sound) {
        currentPlayingAudio = null;
      }
    };
    sound.play().catch((e) => console.warn(`Audio playback blocked for ${key}:`, e));
    
    currentPlayingAudio = sound;
  } else {
    console.log(`Audio key '${key}' not found.`);
  }
};

// 4. STOP FUNCTION 
export const stopAlertSound = () => {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
    currentPlayingAudio = null;
  }
};
