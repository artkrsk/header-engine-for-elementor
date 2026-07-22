import { defaultConfig } from '../constants'
import type { IConfig, IResolvedConfig } from '../interfaces'
import { deepmerge } from '../utils'

export function resolveConfig(overrides?: IConfig): IResolvedConfig {
  return deepmerge(defaultConfig, overrides ?? {}) as IResolvedConfig
}
