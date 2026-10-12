import type { IStateFlag } from '../interfaces'

/**
 * One memoized state flag per published boolean, bound to its container class. Event dispatch stays
 * in the orchestrator so side effects (attribute swaps, the internal sticking callback) sequence
 * exactly between the class write and the event, as consumers observe them.
 *
 * `false` always means the class is absent: `destroy(false)` leaves classes on the DOM to hold the
 * visual state through a swap, so a flag born over a surviving class drops it — the boot's
 * synchronous evaluate publishes the real state again in the same task, with the usual events.
 */
export function createStateFlag(container: HTMLElement, className: string): IStateFlag {
  let value = false
  if (className.length && container.classList.contains(className)) {
    container.classList.remove(className)
  }
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
