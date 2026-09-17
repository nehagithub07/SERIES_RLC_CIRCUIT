import { motion } from 'framer-motion'

import { useWalkthrough } from '../useWalkthrough.js'

const WalkthroughStartButton = ({ highlighted = false }) => {
  const { experimentName, isOpen, start, totalSteps } = useWalkthrough()

  if (isOpen || totalSteps === 0) {
    return null
  }

  return (
    <motion.button
      aria-label={`Start walkthrough for ${experimentName}`}
      className={`walkthrough-start-button ${highlighted ? 'walkthrough-start-button--highlighted' : ''}`}
      data-ai-guide-highlighted={highlighted ? 'true' : 'false'}
      id="walkthrough-start-button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => start()}
      type="button"
    >
      <span className="walkthrough-start-button__spark" aria-hidden="true" />
      <span>Start Walkthrough</span>
    </motion.button>
  )
}

export default WalkthroughStartButton
