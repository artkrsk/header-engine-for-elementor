import type { IHeader } from './IHeader'

/** The global app wrapper the WordPress bundle boots (`window.artsHeaderForElementor`). */
export interface IHeaderApp {
  /** (Re)discover every header in the DOM and boot one engine per wrapper. Concurrent calls await the same in-flight run. */
  init(): Promise<boolean>
  /** Destroy every live instance; see `IHeader.destroy` for the `revert` semantics. */
  destroy(revert?: boolean): Promise<boolean>
  /** Register the Elementor editor container handler once (editor mode only). */
  loadElementorEditorHandler(): void
  /** The PRIMARY instance — the first header wrapper in DOM order. */
  readonly artsHeader: IHeader | undefined
  /** Every live instance, primary first (DOM order). */
  readonly instances: IHeader[]
}
