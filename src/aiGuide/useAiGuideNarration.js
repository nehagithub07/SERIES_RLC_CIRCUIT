import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import defaultAiGuideConfig from './aiGuideConfig.json'
import { loadAiGuideConfig } from './aiGuideConfigLoader.js'
import { resolveAudioAsset } from '../utils/audioAssets.js'
import { createNarrationPlayer } from '../utils/narrationPlayback.js'

export const useAiGuideNarration = ({ config = defaultAiGuideConfig, locale, onError, onFinish, onStart } = {}) => {
  const guideConfig = useMemo(() => loadAiGuideConfig(config, locale ?? config?.defaultLocale), [config, locale])
  const player = useMemo(() => createNarrationPlayer('guide'), [])
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeStepId, setActiveStepId] = useState(null)
  const runId = useRef(0)
  const callbacks = useRef({ onError, onFinish, onStart })
  useEffect(() => { callbacks.current = { onError, onFinish, onStart } }, [onError, onFinish, onStart])

  const stop = useCallback(() => {
    runId.current += 1
    player.stop()
    setIsPlaying(false)
    setActiveStepId(null)
  }, [player])

  const playStep = useCallback(async (stepId) => {
    stop()
    const step = guideConfig.steps.find((entry) => entry.id === stepId)
    if (!step) return false
    const id = runId.current
    setActiveStepId(step.id)
    callbacks.current.onStart?.(guideConfig)
    const result = await player.play({
      audioUrl: resolveAudioAsset(step.audio),
      text: step.text,
      lang: guideConfig.locale === 'en' ? 'en-US' : guideConfig.locale,
      onState: (state) => {
        if (id === runId.current) setIsPlaying(state === 'playing')
      },
    })
    if (id !== runId.current || result === 'cancelled') return false
    if (result === 'completed') callbacks.current.onFinish?.(guideConfig)
    else callbacks.current.onError?.(new Error(`Unable to narrate guide step ${stepId}`))
    // Keep the action highlighted until the learner advances or stops the guide.
    return result === 'completed'
  }, [guideConfig, player, stop])

  useEffect(() => () => { runId.current += 1; player.stop() }, [player])

  return { activeStepId, config: guideConfig, isPlaying, playStep, stop }
}
