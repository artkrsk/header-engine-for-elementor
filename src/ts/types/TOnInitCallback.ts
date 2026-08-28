/** Editor-handler hook: (re)boot the header from externally resolved elements. */
export type TOnInitCallback = (elements: {
  container?: HTMLElement | null
  bar?: HTMLElement | null
}) => Promise<void>
