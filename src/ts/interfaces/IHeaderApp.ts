import type { IHeader } from './IHeader'

/** The global app wrapper the WordPress bundle boots (`window.artsHeaderForElementor`). */
export interface IHeaderApp {
  /** (Re)discover the header in the DOM and boot it. Concurrent calls await the same in-flight run. */
  init(): Promise<boolean>
  /** Destroy the live header; see `IHeader.destroy` for the `revert` semantics. */
  destroy(revert?: boolean): Promise<boolean>
  /** Register the Elementor editor container handler once (editor mode only). */
  loadElementorEditorHandler(): void
  readonly artsHeader: IHeader | undefined
}
