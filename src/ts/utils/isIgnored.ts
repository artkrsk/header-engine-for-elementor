import { IGNORE_ATTR } from '../constants'

/** Whether `element` sits in (or is) a subtree an integrator stamped as leaving the page. */
export const isIgnored = (element: Element): boolean => element.closest(`[${IGNORE_ATTR}]`) !== null
