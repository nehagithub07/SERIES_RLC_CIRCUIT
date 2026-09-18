// A single owner prevents guide, walkthrough, and alert narration overlap.
let activePlayer = null
let sharedAudio = null

export const stopNarration = (owner) => {
  if (!owner || activePlayer?.owner === owner) activePlayer?.stop()
}

export const createNarrationPlayer = (owner) => {
  let run = null
  const player = {
    owner,
    stop() { run?.finish('cancelled') },
    pause() {
      if (!run) return
      if (run.speech) window.speechSynthesis.pause()
      else run.audio?.pause()
      run.onState('paused')
    },
    async resume() {
      const current = run
      if (!current) return false
      try {
        if (current.speech) window.speechSynthesis.resume()
        else await current.audio.play()
        if (run !== current) return false
        current.onState('playing')
        return true
      } catch {
        if (run === current) current.onState('blocked')
        return false
      }
    },
    play({ audioUrl, text = '', lang = 'en-US', onState = () => {} }) {
      activePlayer?.stop()
      activePlayer = player
      return new Promise((resolve) => {
        const current = { audio: null, speech: null, onState, finish: null }
        run = current
        const isCurrent = () => run === current
        const detachAudio = () => {
          if (!current.audio) return
          current.audio.onended = null
          current.audio.onerror = null
          current.audio.pause()
          current.audio = null
        }
        current.finish = (status) => {
          if (!isCurrent()) return
          run = null
          detachAudio()
          if (current.speech) {
            current.speech.onend = null
            current.speech.onerror = null
            window.speechSynthesis.cancel()
          }
          if (activePlayer === player) activePlayer = null
          onState(status)
          resolve(status)
        }
        const speak = () => {
          if (!isCurrent()) return
          detachAudio()
          if (!text || !globalThis.window?.speechSynthesis || !window.SpeechSynthesisUtterance) {
            current.finish('failed')
            return
          }
          const speech = new window.SpeechSynthesisUtterance(text)
          current.speech = speech
          speech.lang = lang
          speech.rate = 0.95
          speech.onend = () => current.finish('completed')
          speech.onerror = () => current.finish('failed')
          window.speechSynthesis.speak(speech)
          onState('playing')
        }
        onState('loading')
        if (!audioUrl || typeof Audio === 'undefined') {
          speak()
          return
        }
        // Reusing the element preserves the user's playback permission on mobile.
        sharedAudio ??= new Audio()
        const audio = sharedAudio
        current.audio = audio
        audio.src = audioUrl
        audio.preload = 'auto'
        audio.onended = () => current.finish('completed')
        audio.onerror = speak
        audio.play().then(() => {
          if (isCurrent()) onState('playing')
        }).catch((error) => {
          if (!isCurrent()) return
          if (error.name === 'NotAllowedError') onState('blocked')
          else speak()
        })
      })
    },
  }
  return player
}
