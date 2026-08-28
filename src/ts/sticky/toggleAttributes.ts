import type { TToggleAttributes } from '../types'

/**
 * Attribute swap on sticky transitions. Symmetric by design: a side without a configured value
 * REMOVES the attribute, so an active-only mapping doesn't strand its value after unstick (and
 * vice versa).
 */

/** The value for one attribute in the given direction, or `null` meaning "remove". */
export const resolveAttributeValue = (
  entry: TToggleAttributes[string] | undefined,
  apply: boolean
): string | null => {
  const value = apply ? entry?.active : entry?.inactive
  return value?.length ? value : null
}

/** Apply the whole swap map. Guards the runtime shape — `false` is the resolver default (the
 * editor never emits this key), and inline options JSON can hand over anything. */
export const applyToggleAttributes = (
  container: HTMLElement,
  toggleAttributes: TToggleAttributes | false,
  apply: boolean
): void => {
  if (!toggleAttributes || typeof toggleAttributes !== 'object') {
    return
  }
  for (const [attribute, entry] of Object.entries(toggleAttributes)) {
    const value = resolveAttributeValue(entry, apply)
    if (value === null) {
      container.removeAttribute(attribute)
    } else {
      container.setAttribute(attribute, value)
    }
  }
}
