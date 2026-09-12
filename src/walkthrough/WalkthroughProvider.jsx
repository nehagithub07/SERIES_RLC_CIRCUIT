import { useCallback, useEffect, useMemo, useState } from 'react'

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

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
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
    () => loadWalkthroughConfig(config, locale ?? config?.defaultLocale),
    [config, locale],
  )
  const [isOpen, setIsOpen] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPositioningTarget, setIsPositioningTarget] = useState(false)
  const [targetRect, setTargetRect] = useState(null)

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
    const nextRect = getElementRect(target)

    setTargetRect(nextRect)

    return target
  }, [activeTargetSelector])

  const moveToStep = useCallback((stepIndex) => {
    if (totalSteps === 0) {
      return
    }

    setTargetRect(null)
    setIsPositioningTarget(true)
    setCurrentStepIndex(clamp(stepIndex, 0, totalSteps - 1))
  }, [totalSteps])

  const start = useCallback((stepIndex = 0) => {
    onStart?.()
    moveToStep(stepIndex)
    setIsOpen(true)
  }, [moveToStep, onStart])

  const close = useCallback(() => {
    const wasCompleted = currentStepIndex >= totalSteps - 1

    setIsOpen(false)
    setIsPositioningTarget(false)
    setTargetRect(null)

    // Let the popup unmount (and stop its own audio) before starting any
    // post-walkthrough experiment narration.
    window.setTimeout(() => {
      if (wasCompleted) {
        onComplete?.()
      } else {
        onExit?.()
      }
    }, 0)
  }, [currentStepIndex, totalSteps, onComplete, onExit])

  const next = useCallback(() => {
    moveToStep(currentStepIndex + 1)
  }, [currentStepIndex, moveToStep])

  const previous = useCallback(() => {
    moveToStep(currentStepIndex - 1)
  }, [currentStepIndex, moveToStep])

  const goToStep = useCallback((stepIndex) => {
    moveToStep(stepIndex)
  }, [moveToStep])

  // --- NEW: BLOCK BODY SCROLL WHEN OPEN ---
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    // Cleanup logic when component unmounts or closes
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])
  // ----------------------------------------

  useEffect(() => {
    if (!isOpen || !activeTargetSelector) {
      return undefined
    }

    // NOTE: scrollIntoView intentionally removed. The simulation stage is a
    // fixed-size canvas scaled to fit the viewport, so scrolling it into
    // view was shifting the whole layout (e.g. during the Autotransformer
    // step) instead of just highlighting the target in place.

    let secondAnimationFrame = null
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

    window.addEventListener('resize', scheduleRefresh)
    window.visualViewport?.addEventListener('resize', scheduleRefresh)

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      window.removeEventListener('resize', scheduleRefresh)
      window.visualViewport?.removeEventListener('resize', scheduleRefresh)
    }
  }, [isOpen, isPositioningTarget, readActiveTarget])

  useEffect(() => {
    if (!isOpen || !activeTargetSelector) {
      return undefined
    }

    const target = document.querySelector(activeTargetSelector)

    if (!target) {
      return undefined
    }

    target.classList.add('walkthrough-active-target')

    return () => {
      target.classList.remove('walkthrough-active-target')
    }
  }, [activeTargetSelector, isOpen])

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
