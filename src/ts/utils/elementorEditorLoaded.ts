/**
 * Resolves the edit-mode flag once `elementorFrontend.elementsHandler` exists (immediately, or
 * after the `elementor/frontend/init` event). Resolves `false` outside a browser/editor.
 */
let elementorInitPromise: Promise<boolean> | null = null

export const elementorEditorLoaded = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false
  }
  if (window.elementorFrontend?.elementsHandler) {
    return window.elementorFrontend?.isEditMode?.() ?? false
  }
  if (elementorInitPromise) {
    return elementorInitPromise
  }
  elementorInitPromise = new Promise<boolean>((resolve) => {
    window.addEventListener('elementor/frontend/init', () => {
      elementorInitPromise = null
      resolve(
        window.elementorFrontend?.elementsHandler
          ? (window.elementorFrontend?.isEditMode?.() ?? false)
          : false
      )
    })
  })
  return elementorInitPromise
}
