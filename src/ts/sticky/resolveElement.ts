import { logger } from '../utils'

/**
 * Resolve a selector-or-element option to an element. A configured selector that matches nothing
 * warns — silently falling back to default behavior used to hide typos from whoever configured it.
 */
export const resolveElementRef = (
  ref: string | HTMLElement | undefined,
  label: string
): HTMLElement | null => {
  if (!ref) {
    return null
  }
  if (typeof ref !== 'string') {
    return ref
  }
  const element = document.querySelector<HTMLElement>(ref)
  if (!element) {
    logger.warn(`sticky.${label} selector matched nothing`, ref)
  }
  return element
}
