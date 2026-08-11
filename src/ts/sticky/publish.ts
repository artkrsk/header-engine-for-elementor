import type { IStateFlag } from '../interfaces'

/**
 * One memoized state flag per published boolean, bound to its container class. Event dispatch stays
 * in the orchestrator so side effects (attribute swaps, scrub bookkeeping) sequence exactly between
 * the class write and the event, as consumers observe them.
 */
export function createStateFlag(container: HTMLElement, className: string): IStateFlag {
  let value = false
  return {
    get value() {
      return value
    },
    set(next) {
      if (next === value) {
        return false
      }
      value = next
      // An empty string in config is a deliberate opt-out for that state class.
      if (className.length) {
        container.classList.toggle(className, next)
      }
      return true
    },
    reset() {
      value = false
    }
  }
}
