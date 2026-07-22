import { elementorEditorLoaded, logger } from '../utils'
import { HeaderApp } from './HeaderApp'

export const init = (): void => {
  const elementorLoaded = elementorEditorLoaded()
  const isElementorEditor = !!window.artsHeaderOptions?.isElementorEditor

  HeaderApp.create({ autoInit: !isElementorEditor })
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
