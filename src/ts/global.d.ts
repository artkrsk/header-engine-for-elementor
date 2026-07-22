import type {
  $e,
  ElementorEditor,
  ElementorFrontend,
  ElementorModules
} from '@artemsemkin/elementor-types'
import type { HeaderApp } from './elementor/HeaderApp'

declare global {
  interface Window {
    $e?: $e
    elementor?: ElementorEditor
    elementorFrontend?: ElementorFrontend
    elementorModules?: ElementorModules
    artsHeaderForElementor?: HeaderApp
    artsHeaderOptions?: {
      isElementorEditor: boolean
    }
  }
}
