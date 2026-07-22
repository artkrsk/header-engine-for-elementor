import { defaultHeaderOptions } from '../constants'
import type { IHeaderOptions, IResolvedHeaderOptions } from '../interfaces'
import { deepmerge } from '../utils'

export function resolveHeaderOptions(overrides?: IHeaderOptions): IResolvedHeaderOptions {
  return deepmerge(defaultHeaderOptions, overrides ?? {}) as IResolvedHeaderOptions
}
