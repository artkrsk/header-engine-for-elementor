import type { IHeaderOptions } from '../interfaces'

/**
 * Map the panel's On Scroll behavior to engine options — the editor-side mirror of the options
 * contract. Position never travels here (docking is a markup/CSS concern), and the reveal offset
 * is a CSS var the engine reads directly. A secondary header (not first in DOM order) is kept off
 * the page globals: it publishes no height vars and ignores zone attributes. `toggleAttributes`
 * is deliberately never emitted: the editor doesn't drive the attribute swap, so the engine
 * default (`false`) applies.
 */
export const mapPanelSettings = (settings: {
  onScroll: unknown
  isPrimary: boolean
}): IHeaderOptions => {
  const machineryOn = settings.onScroll === 'sticky' || settings.onScroll === 'auto-hide'
  const sticky: IHeaderOptions['sticky'] = machineryOn
    ? settings.isPrimary
      ? { reveal: settings.onScroll === 'auto-hide' }
      : { reveal: settings.onScroll === 'auto-hide', zones: false }
    : false
  return settings.isPrimary ? { sticky } : { sticky, heightObserver: false }
}
