import { createContext, useContext } from 'react'

export const WalkthroughContext = createContext(null)

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext)

  if (!context) {
    throw new Error('useWalkthrough must be used inside WalkthroughProvider.')
  }

  return context
}
