import { motion } from 'framer-motion'

import { useWalkthrough } from '../useWalkthrough.js'
import Spotlight from './Spotlight.jsx'
import WalkthroughPopup from './WalkthroughPopup.jsx'

const WalkthroughOverlay = () => {
  const {
    activeStep,
    autoPlayAudioForStep,
    canGoNext,
    canGoPrevious,
    close,
    currentStep,
    goToStep,
    isOpen,
    isPositioningTarget,
    next,
    previous,
    targetRect,
    totalSteps,
  } = useWalkthrough()

  const handleSkip = () => {
    goToStep(totalSteps - 1)
  }

  return (
    <>
      {isOpen && activeStep ? (
        <motion.div
          aria-live="polite"
          className="walkthrough-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div aria-hidden="true" className="walkthrough-interaction-shield" />
          <Spotlight rect={isPositioningTarget ? null : targetRect} />
            {!isPositioningTarget ? (
              <WalkthroughPopup
                activeStep={activeStep}
                autoPlayAudio={autoPlayAudioForStep}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                currentStep={currentStep}
                isLastStep={currentStep >= totalSteps}
                key={activeStep.id}
                onClose={close}
                onNext={next}
                onPrevious={previous}
                onSkip={handleSkip}
                targetRect={targetRect}
                totalSteps={totalSteps}
              />
            ) : null}
          <span className="sr-only">
            Step {currentStep} of {totalSteps}: {activeStep.title}
          </span>
        </motion.div>
      ) : null}
    </>
  )
}

export default WalkthroughOverlay
