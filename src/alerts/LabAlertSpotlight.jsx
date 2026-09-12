import { useEffect, useState } from 'react'

const getElementRect = (selector) => {
  if (!selector || typeof document === 'undefined') {
    return null
  }

  const element = document.querySelector(selector)

  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  }
}

const LabAlertSpotlight = ({ target, type }) => {
  const [spotlight, setSpotlight] = useState(null)

  useEffect(() => {
    if (!target || typeof document === 'undefined') {
      return undefined
    }

    const element = document.querySelector(target)
    let animationFrame = null

    if (!element) {
      animationFrame = window.requestAnimationFrame(() => {
        setSpotlight(null)
      })

      return () => window.cancelAnimationFrame(animationFrame)
    }

    const refreshRect = () => {
      const nextRect = getElementRect(target)

      setSpotlight(nextRect ? { rect: nextRect, target } : null)
    }

    const scheduleRefresh = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      animationFrame = window.requestAnimationFrame(refreshRect)
    }

    element.classList.add('lab-alert-active-target')
    scheduleRefresh()

    window.addEventListener('resize', scheduleRefresh)
    window.addEventListener('scroll', scheduleRefresh, true)

    return () => {
      element.classList.remove('lab-alert-active-target')
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
      window.removeEventListener('resize', scheduleRefresh)
      window.removeEventListener('scroll', scheduleRefresh, true)
    }
  }, [target])

  if (!target || !spotlight || spotlight.target !== target) {
    return null
  }

  const { rect } = spotlight

  return (
    <span
      aria-hidden="true"
      className={`lab-alert-spotlight lab-alert-spotlight--${type}`}
      style={{
        height: `${rect.height + 18}px`,
        left: `${rect.left - 9}px`,
        top: `${rect.top - 9}px`,
        width: `${rect.width + 18}px`,
      }}
    />
  )
}

export default LabAlertSpotlight
