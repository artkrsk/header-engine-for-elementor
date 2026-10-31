/**
 * Inline custom-property writes that skip when the value already matches. An inherited var on a
 * root-level element re-resolves every `var()` user beneath it, so an unchanged write is a whole
 * page's style recalc for nothing; the inline read is a CSSOM read and never flushes layout. An
 * empty configured name is a deliberate opt-out.
 */
export const setInlineVar = (el: HTMLElement, name: string, value: string): boolean => {
  if (!name.length || el.style.getPropertyValue(name) === value) {
    return false
  }
  el.style.setProperty(name, value)
  return true
}

export const removeInlineVar = (el: HTMLElement, name: string): void => {
  if (name.length) {
    el.style.removeProperty(name)
  }
}
