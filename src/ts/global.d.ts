import type {
  $e,
  ElementorEditor,
  ElementorFrontend,
  ElementorModules
} from '@artemsemkin/elementor-types'
import type { IHeaderApp } from './interfaces/IHeaderApp'

declare global {
  interface Window {
    $e?: $e
    elementor?: ElementorEditor
    elementorFrontend?: ElementorFrontend
    elementorModules?: ElementorModules
    artsHeaderForElementor?: IHeaderApp
    artsHeaderOptions?: {
      isElementorEditor: boolean
    }
  }
}
