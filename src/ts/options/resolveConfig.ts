import { defaultConfig } from '../constants'
import type { IConfig, IResolvedConfig } from '../interfaces'
import { deepmerge } from '../utils'

export function resolveConfig(overrides?: IConfig): IResolvedConfig {
  // Hand deepmerge a fresh copy per call: it only spreads the top level, so merging straight over
  // defaultConfig would alias the nested sections into every resolved config — a later mutation
  // would silently corrupt the shared defaults for every subsequent instance.
  const defaults: IResolvedConfig = {
    vars: { ...defaultConfig.vars },
    classes: { ...defaultConfig.classes },
    selectors: { ...defaultConfig.selectors }
  }
  return deepmerge(defaults, overrides ?? {}) as IResolvedConfig
}
