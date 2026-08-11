// Public library surface — consumed by the playground (via the `@engine` alias) and by monorepo
// consumers. NO side effects: importing this never boots an instance. The WordPress bundle boots
// through `boot.ts` instead.

export { defaultConfig, defaultHeaderOptions, EVENTS } from './constants'
export { createHeader } from './core/createHeader'
export { createHeaderApp } from './elementor/createHeaderApp'
export { dispatchHeaderEvent, offHeaderEvent, onHeaderEvent } from './events/headerEvents'
export type {
  IConfig,
  IHeader,
  IHeaderApp,
  IHeaderAppArgs,
  IHeaderArgs,
  IHeaderEventDetail,
  IHeaderOptions,
  IHeightObserverOptions,
  IResolvedConfig,
  IResolvedHeaderOptions,
  IRevealOptions,
  IStickyOptions
} from './interfaces'
export { resolveConfig } from './options/config'
export { resolveHeaderOptions } from './options/headerOptions'
export type { THeaderEventName, TRevealMode, TToggleAttributes, TZoneMode } from './types'
