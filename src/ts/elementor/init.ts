import { elementorEditorLoaded, logger } from '../utils'
import { createHeaderApp } from './createHeaderApp'

export const init = (): void => {
  const elementorLoaded = elementorEditorLoaded()
  const isElementorEditor = !!window.artsHeaderOptions?.isElementorEditor

  createHeaderApp({ autoInit: false })
    .then(async (instance) => {
      window.artsHeaderForElementor = instance

      if (!isElementorEditor) {
        await instance.init()
      }

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
