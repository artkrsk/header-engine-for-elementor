// Public library surface — consumed by the playground (via the `@engine` alias) and by monorepo
// consumers. NO side effects: importing this never boots an instance. The WordPress bundle boots
// through `boot.ts` instead.

export { defaultConfig, defaultHeaderOptions, EVENTS } from './constants'
export { HeaderApp } from './elementor/HeaderApp'
export { resolveConfig } from './header/config'
export { dispatchHeaderEvent, offHeaderEvent, onHeaderEvent } from './header/events'
export { Header } from './header/Header'
export { resolveHeaderOptions } from './header/options'
export type {
  IConfig,
  IHeaderAppArgs,
  IHeaderEventDetail,
  IHeaderOptions,
  IResolvedConfig,
  IResolvedHeaderOptions
} from './interfaces'
export type { THeaderEventName, THeaderMode, TRevealMode, TToggleAttributes } from './types'
