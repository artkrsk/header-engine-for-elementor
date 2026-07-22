import type { IResolvedHeaderOptions } from '../interfaces/IResolvedHeaderOptions'

export const defaultHeaderOptions: IResolvedHeaderOptions = {
  mode: 'flow',
  sticky: {
    enabled: true,
    trigger: undefined,
    toggleReveal: true,
    revealMode: 'auto-hide',
    until: undefined,
    toggleAttributes: {
      'data-arts-header-logo': {
        inactive: 'data-arts-header-non-sticky-logo',
        active: 'data-arts-header-sticky-logo'
      }
    }
  },
  heightObserver: {
    enabled: true,
    observe: true,
    cleanupOnDestroy: false
  }
}
