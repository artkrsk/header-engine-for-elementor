/** Trailing-edge debounce backed by `window.setTimeout`. */
export const debounce = <T extends (...args: any[]) => any>(fn: T, wait: number): T => {
  let timeout: number | undefined
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = window.setTimeout(() => fn.apply(this, args), wait)
  } as unknown as T
}
