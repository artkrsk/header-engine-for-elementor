/** Payload carried by every `arts/header/*` CustomEvent. */
export interface IHeaderEventDetail {
  value: boolean
  header: HTMLElement
}
