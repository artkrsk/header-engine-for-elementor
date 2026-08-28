/**
 * Resolves the edit-mode flag once `elementorFrontend.elementsHandler` exists (immediately, or
 * after the `elementor/frontend/init` event). Resolves `false` outside a browser/editor.
 */

/**
 * The slice of Elementor's frontend global this check reads, typed locally on purpose: consumers
 * compile this source with their own configs, and the repo's ambient Window augmentation
 * (global.d.ts) doesn't travel with the module graph.
 */
interface IElementorFrontendLike {
  elementsHandler?: unknown
  isEditMode?: () => boolean
}

const getElementorFrontend = (): IElementorFrontendLike | undefined =>
  (window as { elementorFrontend?: IElementorFrontendLike }).elementorFrontend

let elementorInitPromise: Promise<boolean> | null = null

export const elementorEditorLoaded = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false
  }
  const elementorFrontend = getElementorFrontend()
  if (elementorFrontend?.elementsHandler) {
    return elementorFrontend.isEditMode?.() ?? false
  }
  if (elementorInitPromise) {
    return elementorInitPromise
  }
  elementorInitPromise = new Promise<boolean>((resolve) => {
    window.addEventListener('elementor/frontend/init', () => {
      elementorInitPromise = null
      const loaded = getElementorFrontend()
      resolve(loaded?.elementsHandler ? (loaded.isEditMode?.() ?? false) : false)
    })
  })
  return elementorInitPromise
}
