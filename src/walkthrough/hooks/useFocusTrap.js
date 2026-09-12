import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const getFocusableElements = (container) => (
  Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => (
      element instanceof HTMLElement
      && !element.hasAttribute('hidden')
      && element.getAttribute('aria-hidden') !== 'true'
    ))
)

export const useFocusTrap = (containerRef, active) => {
  useEffect(() => {
    if (!active) {
      return undefined
    }

    const previouslyFocused = document.activeElement

    const focusInitialElement = () => {
      const container = containerRef.current

      if (!container) {
        return
      }

      const autofocusElement = container.querySelector('[data-autofocus]')
      const focusableElements = getFocusableElements(container)
      const nextFocus = autofocusElement ?? focusableElements[0] ?? container

      nextFocus.focus({ preventScroll: true })
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') {
        return
      }

      const container = containerRef.current

      if (!container) {
        return
      }

      const focusableElements = getFocusableElements(container)

      if (focusableElements.length === 0) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus({ preventScroll: true })
        return
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus({ preventScroll: true })
      }
    }

    const focusTimer = window.setTimeout(focusInitialElement, 0)
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown, true)

      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [active, containerRef])
}
