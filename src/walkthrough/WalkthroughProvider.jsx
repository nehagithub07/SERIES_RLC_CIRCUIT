import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { stopNarration } from '../utils/narrationPlayback.js'

import defaultWalkthroughConfig from './walkthroughConfig.json'
import { WalkthroughContext } from './WalkthroughContext.js'
import { loadWalkthroughConfig } from './walkthroughConfigLoader.js'
import WalkthroughOverlay from './components/WalkthroughOverlay.jsx'
//import WalkthroughStartButton from './components/WalkthroughStartButton.jsx'
import './walkthrough.css'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getElementRect = (element) => {
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  // Images with object-fit: contain include unused vertical space in their
  // element bounds. Spotlight only the displayed image, including transforms.
  if (element.tagName === 'IMG' && element.naturalWidth && getComputedStyle(element).objectFit === 'contain') {
    const ratio = Math.min(rect.width / element.naturalWidth, rect.height / element.naturalHeight)
    const imageWidth = element.naturalWidth * ratio
    const imageHeight = element.naturalHeight * ratio
    const [x, y, w, h] = (element.dataset.spotlightBounds || '0,0,1,1').split(',').map(Number)
    const width = imageWidth * w
    const height = imageHeight * h
    const left = rect.left + (rect.width - imageWidth) / 2 + imageWidth * x
    const top = rect.top + (rect.height - imageHeight) / 2 + imageHeight * y
    return { left, top, width, height, right: left + width, bottom: top + height }
  }

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

// Terminals are siblings of the artwork, and jsPlumb endpoints live on the
// wiring layer. Include all of them in the highlighted equipment bounds.
const getTargetRect = (target) => {
  const equipment = target?.closest('.eq-item, .v-meters-right-stack > div')
  if (!equipment) return getElementRect(target)

  const elements = [target, ...equipment.querySelectorAll(
    '.connection-terminal, .terminal-number-label, select, h4',
  )]
  equipment.querySelectorAll('.connection-terminal').forEach((terminal) => {
    elements.push(...document.querySelectorAll(`.jtk-endpoint--${terminal.id}`))
  })
  const rects = elements.map(getElementRect).filter(Boolean)
  if (!rects.length) return null
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

const WalkthroughProvider = ({
  autoPlayAudio = false,
  children,
  config = defaultWalkthroughConfig,
  locale,
  onComplete,
  onExit,
  onStart,
}) => {
  const walkthroughConfig = useMemo(
    () => loadWalkthroughConfig(config, locale || config?.defaultLocale),
    [config, locale],
  )
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPositioningTarget, setIsPositioningTarget] = useState(false)
  const [targetRect, setTargetRect] = useState(null)
  const closeTimerRef = useRef(null)

  const totalSteps = walkthroughConfig.steps.length
  const activeStep = isOpen ? walkthroughConfig.steps[currentStepIndex] : null
  const activeTargetSelector = activeStep?.target
  const currentStep = currentStepIndex + 1
  const canGoPrevious = currentStepIndex > 0
  const canGoNext = currentStepIndex < totalSteps - 1
  const autoPlayAudioForStep = Boolean(
    activeStep?.autoplayAudio
    ?? walkthroughConfig.audio?.autoplay
    ?? autoPlayAudio
  )

  const readActiveTarget = useCallback(() => {
    if (!activeTargetSelector) {
      setTargetRect(null)
      return null
    }

    const target = document.querySelector(activeTargetSelector)
    const nextRect = getTargetRect(target)

    setTargetRect(nextRect)

    return target
  }, [activeTargetSelector])

  const moveToStep = useCallback((stepIndex) => {
    if (totalSteps === 0) {
      return
    }

    stopNarration('walkthrough')
    setTargetRect(null)
    setIsPositioningTarget(true)
    setCurrentStepIndex(clamp(stepIndex, 0, totalSteps - 1))
  }, [totalSteps])

  const start = useCallback((stepIndex = 0) => {
    window.clearTimeout(closeTimerRef.current)
    onStart?.()
    moveToStep(stepIndex)
    setIsOpen(true)
  }, [moveToStep, onStart])

  const close = useCallback(() => {
    const wasCompleted = currentStepIndex >= totalSteps - 1

    stopNarration('walkthrough')
    setIsOpen(false)
    setIsPositioningTarget(false)
    setTargetRect(null)

    // Let the popup unmount (and stop its own audio) before starting any
    // post-walkthrough experiment narration.
    closeTimerRef.current = window.setTimeout(() => {
      if (wasCompleted) {
        onComplete?.()
      } else {
        onExit?.()
      }
    }, 0)
  }, [currentStepIndex, totalSteps, onComplete, onExit])

  useEffect(() => () => {
    window.clearTimeout(closeTimerRef.current)
    stopNarration('walkthrough')
  }, [])

  const next = useCallback(() => {
    moveToStep(currentStepIndex + 1)
  }, [currentStepIndex, moveToStep])

  const previous = useCallback(() => {
    moveToStep(currentStepIndex - 1)
  }, [currentStepIndex, moveToStep])

  const goToStep = useCallback((stepIndex) => {
    moveToStep(stepIndex)
  }, [moveToStep])

  useEffect(() => {
    if (!isOpen) return undefined

    const root = document.documentElement
    const body = document.body
    const original = [root.style.overflow, body.style.overflow, root.style.overscrollBehavior]
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'

    // Permit scrolling long popup text while preventing wheel, touch and
    // keyboard scrolling of every underlying experiment component.
    const preventBackgroundScroll = (event) => {
      if (!event.target.closest?.('.walkthrough-popup')) event.preventDefault()
    }
    const preventScrollKeys = (event) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
        preventBackgroundScroll(event)
      }
    }
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false })
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false })
    document.addEventListener('keydown', preventScrollKeys)
    return () => {
      ;[root.style.overflow, body.style.overflow, root.style.overscrollBehavior] = original
      document.removeEventListener('wheel', preventBackgroundScroll)
      document.removeEventListener('touchmove', preventBackgroundScroll)
      document.removeEventListener('keydown', preventScrollKeys)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !activeTargetSelector) {
      return undefined
    }

    let secondAnimationFrame = null
    const target = document.querySelector(activeTargetSelector)
    target?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' })
    const rect = getTargetRect(target)
    if (rect) {
      window.scrollBy({ top: rect.top + rect.height / 2 - window.innerHeight / 2, behavior: 'instant' })
    }
    const animationFrame = window.requestAnimationFrame(() => {
      secondAnimationFrame = window.requestAnimationFrame(() => {
        readActiveTarget()
        setIsPositioningTarget(false)
      })
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (secondAnimationFrame) {
        window.cancelAnimationFrame(secondAnimationFrame)
      }
    }
  }, [activeTargetSelector, isOpen, readActiveTarget])

  useEffect(() => {
    if (!isOpen || isPositioningTarget) {
      return undefined
    }

    let animationFrame = null

    const scheduleRefresh = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(readActiveTarget)
    }

    const target = activeTargetSelector
      ? document.querySelector(activeTargetSelector)
      : null
    const resizeObserver = target && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleRefresh)
      : null

    if (target && resizeObserver) {
      resizeObserver.observe(target)
    }

    window.addEventListener('resize', scheduleRefresh)
    window.addEventListener('scroll', scheduleRefresh, true)
    window.visualViewport?.addEventListener('resize', scheduleRefresh)
    window.visualViewport?.addEventListener('scroll', scheduleRefresh)

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleRefresh)
      window.removeEventListener('scroll', scheduleRefresh, true)
      window.visualViewport?.removeEventListener('resize', scheduleRefresh)
      window.visualViewport?.removeEventListener('scroll', scheduleRefresh)
    }
  }, [activeTargetSelector, isOpen, isPositioningTarget, readActiveTarget])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }

      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault()
        next()
        return
      }

      if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault()
        previous()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canGoNext, canGoPrevious, close, isOpen, next, previous])

  const contextValue = useMemo(() => ({
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    config: walkthroughConfig,
    currentStep,
    currentStepIndex,
    experimentName: walkthroughConfig.experimentName,
    goToStep,
    isOpen,
    isPositioningTarget,
    locale: walkthroughConfig.locale,
    next,
    previous,
    start,
    targetRect,
    totalSteps,
  }), [
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    currentStep,
    currentStepIndex,
    goToStep,
    isOpen,
    isPositioningTarget,
    next,
    previous,
    start,
    targetRect,
    totalSteps,
    walkthroughConfig,
  ])

  return (
    <WalkthroughContext.Provider value={contextValue}>
      {children}
     {/* <WalkthroughStartButton />*/}
      <WalkthroughOverlay />
    </WalkthroughContext.Provider>
  )
}

export default WalkthroughProvider
