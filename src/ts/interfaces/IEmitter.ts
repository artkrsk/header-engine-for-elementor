/** Typed pub/sub for internal wiring. `on` returns the unsubscribe for the given callback. */
export interface IEmitter<M extends Record<keyof M, (...args: never[]) => void>> {
  on<E extends keyof M>(event: E, cb: M[E]): () => void
  emit<E extends keyof M>(event: E, ...payload: Parameters<M[E]>): void
}
