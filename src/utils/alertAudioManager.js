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
  multiWrong: 'Multiple wrong connections.wav',
  firstCheck: '1st time check button click.wav',
  autoConnect: 'Autoconnect.wav',
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
  allReadingsRecorded: '12th reading added All readings recorded.wav',
  maximumReadingsReached: 'Max. readings,  Add click.wav',
  calculationsVerified: 'After correct verification, verify button.wav',

  // Existing aliases used by other alert call sites
  firstAutoTransClick: '1st time autotransformer click or after check disabled (1).wav',
  forCorrConnCheckClick: 'For correct connections, check click.wav',
  afterAutoTransOn: 'After the autotransformer is ON.wav',
  afterVolSet: 'After Voltage is set.wav',
  firstReadAdded: '1st reading added.wav',
  afterReadAddClick: 'After taking the readings, Add click.wav',
  afterCorrVerif: 'After correct verification, verify button.wav',
  incompltMultiVal: 'Incomplete more than one value.wav',
  incompltOneVal: 'Incomplete one value.wav',
  incorrCalcMulti: 'Incorrect calculations, more than one.wav',
  incorrCalcOne: 'Incorrect calculation, one only.wav',
  genRepBtnClick: 'Generate Report button click.wav',
  reset: 'Reset.wav',
  print: 'Print.wav',
}

let currentPlayingAudio = null
let currentSpeech = null
let playbackId = 0

const canSpeak = () => (
  typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined'
)

const speakFallback = (text, runId) => {
  if (!text || runId !== playbackId || !canSpeak()) {
    return
  }

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.95
  utterance.pitch = 1
  utterance.onend = () => {
    if (currentSpeech === utterance) {
      currentSpeech = null
    }
  }
  utterance.onerror = utterance.onend

  currentSpeech = utterance
  window.speechSynthesis.speak(utterance)
}

export const stopAlertSound = () => {
  playbackId += 1

  if (currentPlayingAudio) {
    currentPlayingAudio.pause()
    currentPlayingAudio.currentTime = 0
    currentPlayingAudio = null
  }

  if (canSpeak() && currentSpeech) {
    window.speechSynthesis.cancel()
    currentSpeech = null
  }
}

export const playAlertSound = (key, fallbackNarration = '') => {
  stopAlertSound()

  const source = ALERT_AUDIO_SOURCES[key]
  const audioUrl = resolveAudioAsset(source)
  const runId = playbackId

  if (!audioUrl || typeof Audio === 'undefined') {
    if (source && !audioUrl) {
      console.warn(`Alert audio file not found in src/audios: ${source}`)
    }

    speakFallback(fallbackNarration, runId)
    return
  }

  const sound = new Audio(audioUrl)
  let fallbackStarted = false

  const playFallback = (error) => {
    if (fallbackStarted || runId !== playbackId) {
      return
    }

    fallbackStarted = true
    sound.pause()

    if (currentPlayingAudio === sound) {
      currentPlayingAudio = null
    }

    console.warn(`Unable to play alert audio "${source}"; using browser narration instead.`, error)
    speakFallback(fallbackNarration, runId)
  }

  sound.addEventListener('ended', () => {
    if (currentPlayingAudio === sound) {
      currentPlayingAudio = null
    }
  }, { once: true })
  sound.addEventListener('error', () => playFallback(), { once: true })

  currentPlayingAudio = sound
  sound.play().catch(playFallback)
}
