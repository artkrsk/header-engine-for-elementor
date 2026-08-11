import type { IEmitter } from '../interfaces'

/**
 * Listener sets keyed by event name, created on first subscription. Internal wiring only — the
 * public consumer channel stays the document CustomEvents.
 */
export function createEmitter<
  M extends Record<keyof M, (...args: never[]) => void>
>(): IEmitter<M> {
  const sets = new Map<keyof M, Set<M[keyof M]>>()

  return {
    on(event, cb) {
      let set = sets.get(event)
      if (!set) {
        set = new Set()
        sets.set(event, set)
      }
      const listeners = set
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    emit(event, ...payload) {
      const set = sets.get(event)
      if (!set) {
        return
      }
      for (const cb of set) {
        ;(cb as (...args: typeof payload) => void)(...payload)
      }
    }
  }
}
