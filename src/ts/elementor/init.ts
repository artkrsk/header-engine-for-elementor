import { defaultConfig } from '../constants/defaultConfig'
import { registerRevealOffsetProperty } from '../sticky/measure'
import { elementorEditorLoaded, logger } from '../utils'
import { createHeaderApp } from './createHeaderApp'

export const init = (): void => {
  // Registering a custom property invalidates every element's style. At boot that folds into the
  // page's first style pass; left to the first reveal-enabled header of the session (an AJAX swap
  // onto a page with `reveal`), it would land mid-transition and recalc the whole document there.
  // `createSticky` still registers for a custom config name — a duplicate throws and is swallowed.
  registerRevealOffsetProperty(defaultConfig.vars.revealOffset)
  const elementorLoaded = elementorEditorLoaded()
  const isElementorEditor = !!window.artsHeaderOptions?.isElementorEditor

  createHeaderApp({ autoInit: !isElementorEditor })
    .then((instance) => {
      window.artsHeaderForElementor = instance

      elementorLoaded
        .then((isEditMode) => {
          if (isEditMode) {
            instance.loadElementorEditorHandler()
          }
        })
        .catch((error) => {
          logger.error('Error loading Elementor handler:', error)
        })
    })
    .catch((error) => {
      logger.error('Error initializing HeaderApp:', error)
    })
}
