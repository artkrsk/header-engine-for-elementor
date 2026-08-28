import { OPTIONS_ATTR } from '../constants'
import type { IHeaderOptions } from '../interfaces'
import { JSONParse, logger } from '../utils'
import { isPlainObject, sanitizeInlineOptions } from './sanitize'

/**
 * Reads the inline `data-arts-header-options` JSON. Returns `undefined` both when the attribute is
 * absent AND when it is present but garbage — distinguished so garbage warns instead of silently
 * winning: `JSONParse` hands back `{}` for unparseable input, and an `inline ?? constructor`
 * precedence would let that empty object discard perfectly good constructor options.
 */
export function readInlineOptions(container: HTMLElement): IHeaderOptions | undefined {
  const raw = container.getAttribute(OPTIONS_ATTR)
  if (raw === null) {
    return undefined
  }
  const parsed: unknown = JSONParse(raw)
  const authoredEmpty = raw.replace(/\s/g, '') === '{}'
  if (!isPlainObject(parsed) || (Object.keys(parsed).length === 0 && !authoredEmpty)) {
    logger.warn(`ignoring malformed ${OPTIONS_ATTR} JSON`, raw)
    return undefined
  }
  return sanitizeInlineOptions(parsed)
}
