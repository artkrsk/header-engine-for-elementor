import { coalesceToFrame } from '../utils/coalesceToFrame'
import { resolveValueHost } from './resolveValueHost'

const REVISION_VAR = '--arts-header-values-revision'

/**
 * WebKit can retain viewport lengths on display:contents after a viewport resize. Invalidate
 * only this nonanimated host, without layout reads or document-wide variable writes. Its typed
 * lengths then inherit as pixels, so the animated descendants keep interpolating (Velum #290).
 */
export function createValueHostInvalidation(container: HTMLElement): {
  refresh(): void
  destroy(revert: boolean): void
} {
  const host = resolveValueHost(container)
  const win = container.ownerDocument.defaultView
  const original = host?.style.getPropertyValue(REVISION_VAR) ?? ''
  const priority = host?.style.getPropertyPriority(REVISION_VAR) ?? ''
  let revision = original === '1' ? 1 : 0
  const invalidate = (): void => {
    revision = 1 - revision
    host?.style.setProperty(REVISION_VAR, String(revision))
  }
  const frame = coalesceToFrame(invalidate)
  const onResize = (): void => frame.schedule()
  if (host) {
    win?.addEventListener('resize', onResize, { passive: true })
  }
  return {
    refresh() {
      frame.cancel()
      if (host) invalidate()
    },
    destroy(revert) {
      win?.removeEventListener('resize', onResize)
      frame.cancel()
      if (revert && host) {
        if (original) host.style.setProperty(REVISION_VAR, original, priority)
        else host.style.removeProperty(REVISION_VAR)
      }
    }
  }
}
