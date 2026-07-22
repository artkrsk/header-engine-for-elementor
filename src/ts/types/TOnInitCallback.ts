export type TOnInitCallback = (elements: {
  container?: HTMLElement | null
  bar?: HTMLElement | null
}) => Promise<any>
