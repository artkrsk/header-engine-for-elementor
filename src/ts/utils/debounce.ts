/** Trailing-edge debounce backed by `window.setTimeout`; `cancel()` drops a pending call. */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): T & { cancel(): void } => {
  let timeout: number | undefined
  const run = function (this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = window.setTimeout(() => fn.apply(this, args), wait)
  }
  run.cancel = (): void => {
    clearTimeout(timeout)
  }
  return run as unknown as T & { cancel(): void }
}
