import { SENTINEL_CLASS } from '../constants'

/**
 * Insert the zero-flow-footprint 1px marker (styled by `.arts-header__sentinel`) as a sibling
 * BEFORE the target — outside it, so it isn't carried along when the target pins or scrolls.
 * Returns `null` when the target has no parent to insert into (half-rendered page).
 */
export const insertSentinelBefore = (target: Element): HTMLElement | null => {
  const parent = target.parentNode
  if (!parent) {
    return null
  }
  const sentinel = document.createElement('div')
  sentinel.className = SENTINEL_CLASS
  sentinel.setAttribute('aria-hidden', 'true')
  parent.insertBefore(sentinel, target)
  return sentinel
}
