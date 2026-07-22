/**
 * Public header state event names, dispatched on `document` as CustomEvents so consumers outside
 * the bundle can subscribe with plain `document.addEventListener`.
 */
export const EVENTS = {
  STICKY: 'arts/header/sticky',
  HIDDEN: 'arts/header/hidden',
  LOCKED: 'arts/header/locked',
  DISPLACED: 'arts/header/displaced'
} as const
