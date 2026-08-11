import type { IHeaderOptions } from '../interfaces'

/**
 * Map raw Elementor panel values to engine options — the editor-side mirror of the options
 * contract. Reveal is AND-gated by the sticky toggle (it can't be on while sticky itself is off),
 * and `toggleAttributes` is deliberately never emitted: the editor doesn't drive the attribute
 * swap, so the engine default (`false`) applies.
 */
export const mapPanelSettings = (settings: {
  stickyEnabled: unknown
  toggleRevealEnabled: unknown
}): IHeaderOptions => {
  if (!settings.stickyEnabled) {
    return { sticky: false }
  }
  return { sticky: { reveal: settings.toggleRevealEnabled ? {} : false } }
}
