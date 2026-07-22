import type { EVENTS } from '../constants/events'

export type THeaderEventName = (typeof EVENTS)[keyof typeof EVENTS]
