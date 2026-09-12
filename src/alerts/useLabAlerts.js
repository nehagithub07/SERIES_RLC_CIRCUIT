import { useContext } from 'react'

import { LabAlertContext } from './LabAlertContext.js'

export const useLabAlerts = () => {
  const context = useContext(LabAlertContext)

  if (!context) {
    throw new Error('useLabAlerts must be used inside LabAlertProvider.')
  }

  return context
}
