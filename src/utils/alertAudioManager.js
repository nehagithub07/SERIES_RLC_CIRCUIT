import { createNarrationPlayer } from './narrationPlayback.js'
import { resolveAudioAsset } from './audioAssets.js'

const ALERT_AUDIO_SOURCES = {
  // Connection and setup alerts
  aiGuideClick: 'AI Guide click.wav',
  interfaceWalkthroughComplete: 'The interface walkthrough is now complete..wav',
  correctConnections: 'Click and drag the wire from terminal 1 and drop it on terminal 23.wav',
  connectTerminal2To24: "Let's move on to the next connection. Connect terminal 2 to terminal 24..wav",
  connectTerminal3To25: 'Connect terminal 3 to terminal 25.wav',
  connectTerminal4To26: 'Connect terminal 4 to terminal 26.wav',
  connectTerminal5To25: 'Connect terminal 5 to terminal 25.wav',
  connectTerminal6To9: 'Connect terminal 6 to terminal 9.wav',
  connectTerminal9To10: 'Connect terminal 9 to terminal 10.wav',
  connectTerminal7To18: 'Connect terminal 7 to terminal 18.wav',
  connectTerminal7To26: 'Connect terminal 7 to terminal 26.wav',
  connectTerminal8To17: 'Connect terminal 8 to terminal 17.wav',
  connectTerminal11To17: 'Connect terminal 11 to terminal 17.wav',
  connectTerminal12To18: 'Connect terminal 12 to terminal 18.wav',
  connectTerminal13To19: 'Connect terminal 13 to terminal 19.wav',
  connectTerminal14To20: 'Connect terminal 14 to terminal 20.wav',
  connectTerminal15To21: 'Connect terminal 15 to terminal 21.wav',
  connectTerminal16To22: 'Connect terminal 16 to terminal 22..wav',
  connectTerminal18To19: 'Connect terminal 18 to terminal 19. .wav',
  connectTerminal20To21: 'Connect terminal 20 to terminal 21..wav',
  connectTerminal22To26: 'Connect terminal 22 to terminal 26.wav',
  guideAllComplete: 'Guide all complete conn.wav',
  wrongConn: 'Wrong connection.wav',
  firstCheck: '1st time check button click.wav',
  autoConnect: 'Autoconnect.wav',
  // Updated messages use speech synthesis so stale prerecorded wording is
  // never replayed after copy changes.
  autoConnectNarration: 'Autoconnect.wav',
  mcbAlert: 'Before connection, on-click MCB Alert.wav',
  autotransformerNotReady: '1st time autotransformer click or after check disabled (1).wav',
  connectionsVerified: 'For correct connections, check click.wav',
  mcbOn: 'MCB ON.wav',

  // Series RLC experiment steps
  componentValuesSelected: 'Component Values Selected.wav',
  autotransformerOn: 'After the autotransformer is ON.wav',
  voltageSet: 'After Voltage is set.wav',
  firstReadingAdded: '1st reading added.wav',
  newRlcValueSelected: '2nd time value selected.wav',
  duplicateRlcCombination: 'Dropdown alert.wav',
  secondReadingAdded: '2nd reading added.wav',
  fifthReadingAdded: '5th reading added.wav',
  allReadingsRecorded: '12th reading added All readings recorded.wav',
  maximumReadingsReached: 'Max. readings,  Add click.wav',
  calculationsVerified: 'After correct verification, verify button.wav',
  verificationSuccessNarration: 'Verification successful.wav',

  // Existing aliases used by other alert call sites
  firstAutoTransClick: '1st time autotransformer click or after check disabled (1).wav',
  forCorrConnCheckClick: 'For correct connections, check click.wav',
  afterAutoTransOn: 'After the autotransformer is ON.wav',
  afterVolSet: 'After Voltage is set.wav',
  firstReadAdded: '1st reading added.wav',
  afterReadAddClick: 'After taking the readings, Add click.wav',
  afterCorrVerif: 'After correct verification, verify button.wav',
  // Speak the exact alert text; these recordings contain outdated wording.
  incompltMultiVal: 'Incomplete more than one value.wav',
  incompltOneVal: 'Incomplete one value.wav',
  incorrCalcMulti: 'Incorrect calculation more than one value.wav',
  incorrCalcOne: 'Incorrect calculation one value.wav',
  incorrCalc: 'Incorrect calculations, more than one.wav',
  incorrCalCR: 'Incorrect calculation, one only.wav',
  genRepBtnClick: 'Generate Report button click.wav',
  reset: 'Reset.wav',
  print: 'Print.wav', 
}

const alertPlayer = createNarrationPlayer('alert')

export const stopAlertSound = () => alertPlayer.stop()

export const playAlertSound = (key, fallbackNarration = '') => {
  window.dispatchEvent(new Event('lab-alert:sound'))
  return alertPlayer.play({ audioUrl: resolveAudioAsset(ALERT_AUDIO_SOURCES[key]), text: fallbackNarration })
}
