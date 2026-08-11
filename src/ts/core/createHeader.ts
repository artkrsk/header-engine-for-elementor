import { createHeightObserver } from '../heightObserver/createHeightObserver'
import type {
  IHeader,
  IHeaderArgs,
  IHeightObserver,
  IResolvedConfig,
  IResolvedHeaderOptions,
  ISticky
} from '../interfaces'
import { resolveConfig } from '../options/config'
import { resolveHeaderOptions } from '../options/headerOptions'
import { readInlineOptions } from '../options/inlineOptions'
import { createSticky } from '../sticky/createSticky'
import { logger } from '../utils'

/**
 * The composition root: resolves options/config once, and `init()` wires the sticky engine and the
 * height publisher together. Missing elements are reported but never thrown — `init()` no-ops so a
 * half-rendered page (e.g. the Elementor editor mid-edit) degrades silently instead of crashing
 * the bundle.
 */
export function createHeader(
  container: HTMLElement,
  bar: HTMLElement,
  args: IHeaderArgs = {}
): IHeader {
  if (!container) {
    logger.error('containerElement is required')
  }
  if (!bar) {
    logger.error('barElement is required')
  }

  // Inline `data-arts-header-options` JSON takes precedence over constructor options.
  const inlineOptions = container ? readInlineOptions(container) : undefined
  const options: IResolvedHeaderOptions = resolveHeaderOptions(inlineOptions ?? args.options)
  const config: IResolvedConfig = resolveConfig(args.config)

  let sticky: ISticky | null = null
  let heightObserver: IHeightObserver | null = null
  let initialized = false

  return {
    init() {
      if (initialized || !container || !bar) {
        return
      }

      const stickyOptions = options.sticky
      if (stickyOptions !== false) {
        sticky = createSticky({ container, bar, options: stickyOptions, config })
      }

      if (options.heightObserver !== false) {
        heightObserver = createHeightObserver({
          bar,
          options: options.heightObserver,
          config,
          isSticking: () => sticky?.isSticking ?? false
        })
      }

      sticky?.on('change', (isSticking) => {
        heightObserver?.handleStickyChange(isSticking)
      })

      initialized = true
    },
    destroy(revert = false) {
      if (!initialized) {
        return
      }
      sticky?.destroy(revert)
      heightObserver?.destroy(revert)
      sticky = null
      heightObserver = null
      initialized = false
    },
    refresh() {
      sticky?.update()
      heightObserver?.update()
    },
    toggleHidden(hidden) {
      sticky?.setHidden(hidden)
    },
    lockSticky(locked) {
      sticky?.setLocked(locked)
    },
    refreshZones() {
      sticky?.refreshZones()
    },
    get isInitialized() {
      return initialized
    },
    get isSticking() {
      return sticky?.isSticking ?? false
    },
    get isHidden() {
      return sticky?.isHidden ?? false
    },
    get isLocked() {
      return sticky?.isLocked ?? false
    },
    get isReleased() {
      return sticky?.isReleased ?? false
    },
    get isDisplaced() {
      return sticky?.isDisplaced ?? false
    }
  }
}
