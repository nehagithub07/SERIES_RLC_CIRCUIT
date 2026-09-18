import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { createNarrationPlayer } from '../../utils/narrationPlayback.js'
import { resolveWalkthroughAudio } from '../walkthroughAudio.js'

const EDGE_GAP = 16
const TARGET_GAP = 18
const DEFAULT_POPUP_SIZE = {
  height: 280,
  width: 360,
}

const isValidAudioSource = (audio) => Boolean(audio && audio !== '#')
const canUseSpeechSynthesis = () => (
  typeof window !== 'undefined'
  && typeof window.speechSynthesis !== 'undefined'
  && typeof window.SpeechSynthesisUtterance !== 'undefined'
)

const renderNotation = (text, keyPrefix) => (
  text.split(/(V_R|V_L|V_C)/g).map((part, index) => {
    const match = /^V_([RLC])$/.exec(part)

    return match
      ? <Fragment key={`${keyPrefix}-${index}`}>V<sub>{match[1]}</sub></Fragment>
      : <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
  })
)

const renderDescriptionBlock = (block, blockIndex) => (
  block.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => {
    const isStrong = part.startsWith('**') && part.endsWith('**')
    const text = isStrong ? part.slice(2, -2) : part
    const content = renderNotation(text, `${blockIndex}-${partIndex}`)

    return isStrong
      ? <strong key={`${blockIndex}-${partIndex}`}>{content}</strong>
      : <Fragment key={`${blockIndex}-${partIndex}`}>{content}</Fragment>
  })
)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getPlacementOrder = (placement) => {
  const fallbackPlacements = ['bottom', 'right', 'left', 'top']

  return [
    placement,
    ...fallbackPlacements.filter((item) => item !== placement),
  ].filter(Boolean)
}

const getCandidatePosition = (rect, size, placement) => {
  const target = rect ?? {
    height: 0,
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    width: 0,
  }

  if (placement === 'top') {
    return {
      left: target.left + target.width / 2 - size.width / 2,
      top: target.top - size.height - TARGET_GAP,
    }
  }

  if (placement === 'left') {
    return {
      left: target.left - size.width - TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  if (placement === 'right') {
    return {
      left: target.left + target.width + TARGET_GAP,
      top: target.top + target.height / 2 - size.height / 2,
    }
  }

  return {
    left: target.left + target.width / 2 - size.width / 2,
    top: target.top + target.height + TARGET_GAP,
  }
}

const getPopupPosition = (rect, size, preferredPlacement) => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const maxLeft = Math.max(EDGE_GAP, viewportWidth - size.width - EDGE_GAP)
  const maxTop = Math.max(EDGE_GAP, viewportHeight - size.height - EDGE_GAP)
  const placements = getPlacementOrder(preferredPlacement)

  for (const placement of placements) {
    const candidate = getCandidatePosition(rect, size, placement)
    const fitsHorizontally = candidate.left >= EDGE_GAP && candidate.left + size.width <= viewportWidth - EDGE_GAP
    const fitsVertically = candidate.top >= EDGE_GAP && candidate.top + size.height <= viewportHeight - EDGE_GAP

    if (fitsHorizontally && fitsVertically) {
      return {
        placement,
        left: candidate.left,
        top: candidate.top,
      }
    }
  }

  const fallback = getCandidatePosition(rect, size, preferredPlacement)

  return {
    placement: preferredPlacement,
    left: clamp(fallback.left, EDGE_GAP, maxLeft),
    top: clamp(fallback.top, EDGE_GAP, maxTop),
  }
}

const WalkthroughPopup = ({
  activeStep,
  autoPlayAudio,
  canGoNext,
  canGoPrevious,
  currentStep,
  isLastStep = false,
  onClose,
  onNext,
  onPrevious,
  onSkip,
  targetRect,
  totalSteps,
}) => {
  const popupRef = useRef(null)
  const player = useMemo(() => createNarrationPlayer('walkthrough'), [])
  const [popupSize, setPopupSize] = useState(DEFAULT_POPUP_SIZE)
  const [audioState, setAudioState] = useState('idle')
  const isPlaying = audioState === 'playing'
  const playbackRef = useRef(null)
  const configuredAudioSource = isValidAudioSource(activeStep.audio) ? activeStep.audio : null
  const audioSource = resolveWalkthroughAudio(configuredAudioSource)
  const speechNarration = activeStep.narration?.trim() || activeStep.description.replace(/\*\*/g, '')
  const hasNarration = Boolean(audioSource || (speechNarration && canUseSpeechSynthesis()))
  const titleId = `walkthrough-title-${activeStep.id}`
  const descriptionId = `walkthrough-description-${activeStep.id}`
  const progressPercent = (currentStep / totalSteps) * 100

  useFocusTrap(popupRef, true)

  useLayoutEffect(() => {
    if (!popupRef.current) {
      return
    }

    const popupBox = popupRef.current.getBoundingClientRect()

    setPopupSize({
      height: popupBox.height,
      width: popupBox.width,
    })
  }, [activeStep.id, targetRect])

  useEffect(() => {
    let disposed = false
    const play = () => player.play({
      audioUrl: audioSource,
      text: speechNarration,
      onState: (state) => { if (!disposed) setAudioState(state) },
    })
    playbackRef.current = play
    if (autoPlayAudio) play()
    return () => {
      disposed = true
      player.stop()
      playbackRef.current = null
    }
  }, [activeStep.id, audioSource, autoPlayAudio, player, speechNarration])

  const popupPosition = useMemo(
    () => getPopupPosition(targetRect, popupSize, activeStep.placement),
    [activeStep.placement, popupSize, targetRect],
  )

  const toggleAudio = () => {
    if (isPlaying) player.pause()
    else if (audioState === 'paused' || audioState === 'blocked') player.resume()
    else playbackRef.current?.()
  }

  return (
    <motion.aside
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="walkthrough-popup"
      data-placement={popupPosition.placement}
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      ref={popupRef}
      role="dialog"
      style={{
        left: popupPosition.left,
        top: popupPosition.top,
      }}
      tabIndex={-1}
      transition={{
        duration: 0.18,
        ease: 'easeOut',
      }}
    >
      <div className="walkthrough-popup__header">
        <div>
          <p className="walkthrough-popup__eyebrow">Guided Walkthrough</p>
          <h2 id={titleId}>{activeStep.title}</h2>
        </div>
      </div>

      <div className="walkthrough-popup__description" id={descriptionId}>
        {activeStep.description.split(/\n\s*\n/).map((block, index) => (
          <p key={`${activeStep.id}-description-${index}`}>
            {renderDescriptionBlock(block, index)}
          </p>
        ))}
      </div>

      <div className="walkthrough-popup__progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="walkthrough-popup__meta">
        <span aria-label={`Step ${currentStep} of ${totalSteps}`}>
          {currentStep} / {totalSteps}
        </span>

        <button
          aria-label={hasNarration ? (isPlaying ? 'Pause audio narration' : 'Play audio narration') : 'Audio narration unavailable'}
          aria-pressed={hasNarration ? isPlaying : undefined}
          className="walkthrough-popup__audio"
          disabled={!hasNarration}
          onClick={toggleAudio}
          type="button"
        >
          <span aria-hidden="true">{isPlaying ? 'Pause' : audioState === 'blocked' ? 'Play audio' : 'Audio'}</span>
        </button>
      </div>

      <div className="walkthrough-popup__actions">
        {isLastStep ? (
          <button
            className="walkthrough-popup__button walkthrough-popup__button--primary"
            data-autofocus
            onClick={onClose}
            type="button"
          >
            Exit
          </button>
        ) : (
          <>
            <button
              className="walkthrough-popup__button walkthrough-popup__button--secondary"
              disabled={!canGoPrevious}
              onClick={onPrevious}
              type="button"
            >
              Previous
            </button>
            <button
              className="walkthrough-popup__button walkthrough-popup__button--secondary"
              onClick={onSkip}
              type="button"
            >
              Skip
            </button>
            <button
              className="walkthrough-popup__button walkthrough-popup__button--primary"
              data-autofocus
              disabled={!canGoNext}
              onClick={onNext}
              type="button"
            >
              Next
            </button>
          </>
        )}
      </div>
    </motion.aside>
  )
}

export default WalkthroughPopup
