import { EVENTS } from '../constants'
import type { IResolvedConfig, IZone } from '../interfaces'
import type { THeaderEventName, TZoneMode } from '../types'
import { dispatchHeaderEvent } from './events'
import { Plugin } from './Plugin'

/**
 * Zero-dependency sticky/reveal engine.
 *
 * Flow mode (default) rides native `position: sticky`; a sentinel + IntersectionObserver detects
 * the stick transition at the header's natural position (works at page top, below a topbar, or at
 * a hero's bottom edge alike). A single passive scroll listener + rAF drives direction; the
 * hide-on-scroll-down / reveal-on-scroll-up animation is owned by CSS via state classes
 * (compositor-friendly, no per-frame JS writes). Hide-over/lock-over zones are observed
 * declaratively from `data-arts-header-*` attributes.
 */
export class Sticky extends Plugin {
  private barHeight = 0
  private stickyTop = 0

  private sentinel: HTMLElement | null = null
  private stickyObserver: IntersectionObserver | null = null
  private zones: IZone[] = []
  private zoneMutationObserver: MutationObserver | null = null

  private sticking = false
  private revealing = false
  private scrollingDown = false
  private hidden = false
  private locked = false
  private displacedState = false
  private revealOffset = 0

  private lastScrollY = 0
  private rafId = 0
  private scrollQueued = false

  private onScroll = (): void => {
    if (this.scrollQueued) {
      return
    }
    this.scrollQueued = true
    this.rafId = requestAnimationFrame(this.processScroll)
  }
  private processScroll = (): void => {
    this.scrollQueued = false
    this.updateDirection()
  }

  // --- Public state --------------------------------------------------------

  /** Wired by `Header` — notifies the height observer on sticky transitions (single consumer). */
  public onStickyChange?: (isSticking: boolean) => void

  public get isSticking(): boolean {
    return this.sticking
  }

  public get isHidden(): boolean {
    return this.hidden
  }

  public get isLocked(): boolean {
    return this.locked
  }

  /** Hide/show the whole bar (zone- or API-driven). Suppresses reveal while hidden. */
  public setHidden(value: boolean): void {
    if (this.hidden === value) {
      return
    }
    this.hidden = value
    this.toggleStateClass('hidden', value)
    if (value && this.isScrubMode()) {
      // JS owns the transform in scrub — force fully hidden (a later scroll-up reveals).
      this.revealOffset = this.barHeight
      this.applyScrubTransform()
    }
    this.notify(EVENTS.HIDDEN, value)
  }

  /** Freeze the current sticky/reveal state (zone- or API-driven). */
  public setLocked(value: boolean): void {
    if (this.locked === value) {
      return
    }
    this.locked = value
    this.toggleStateClass('locked', value)
    this.notify(EVENTS.LOCKED, value)
  }

  /** Re-scan the DOM for hide-over / lock-over zones (call after layout-affecting changes). */
  public refreshZones(): void {
    this.teardownZones()
    this.setupZones()
  }

  // --- Lifecycle -----------------------------------------------------------

  protected override onInit(): void {
    this.measure()
    this.setupSentinel()
    this.setupSticky()

    if (this.isRevealEnabled()) {
      window.addEventListener('scroll', this.onScroll, { passive: true })
      this.lastScrollY = this.clampScroll(window.scrollY)
      if (this.isScrubMode()) {
        // Marks the wrapper so CSS drops its transform transition (per-frame writes own it).
        this.toggleStateClass('revealScrub', true)
      }
    }

    this.setupZones()
  }

  protected override onUpdate(): void {
    const previousStickyTop = this.stickyTop
    this.measure()
    // Sentinel/observer positions are viewport-relative, so a remeasure is enough; re-arm the
    // sticky observer only if the sticky top offset changed (admin bar toggled, etc.).
    if (this.stickyTop !== previousStickyTop || !this.stickyObserver) {
      this.setupSticky()
    }
    this.refreshZones()
  }

  protected override onDestroy(revert: boolean): void {
    window.removeEventListener('scroll', this.onScroll)
    cancelAnimationFrame(this.rafId)

    this.stickyObserver?.disconnect()
    this.stickyObserver = null
    this.teardownZones()
    this.zoneMutationObserver?.disconnect()
    this.zoneMutationObserver = null

    if (this.sentinel?.parentNode) {
      this.sentinel.parentNode.removeChild(this.sentinel)
    }
    this.sentinel = null

    // Clear the scrub inline transform + mode class.
    this.container.style.transform = ''
    this.toggleStateClass('revealScrub', false)

    if (revert) {
      this.setSticking(false)
      this.setRevealing(false)
      this.setScrollingDown(false)
      this.setHidden(false)
      this.setLocked(false)
    } else {
      this.sticking = false
      this.revealing = false
      this.scrollingDown = false
      this.hidden = false
      this.locked = false
    }
    this.displacedState = false
  }

  // --- Measurement ---------------------------------------------------------

  private measure(): void {
    this.barHeight = Math.round(this.bar.getBoundingClientRect().height)
    // The wrapper is the sticky element in flow mode; its resolved `top` is the sticky line.
    const top = parseFloat(getComputedStyle(this.container).top)
    this.stickyTop = Number.isFinite(top) ? top : 0
  }

  // --- Sticky detection (sentinel + IntersectionObserver) ------------------

  private setupSentinel(): void {
    if (this.sentinel) {
      return
    }
    const parent = this.container.parentNode
    if (!parent) {
      return
    }
    const sentinel = document.createElement('div')
    sentinel.className = 'arts-header__sentinel'
    sentinel.setAttribute('aria-hidden', 'true')
    // Zero-footprint marker at the header's natural top edge. Placed as a sibling *before* the
    // wrapper (not inside it) so it isn't carried along when the wrapper pins.
    sentinel.style.cssText =
      'width:1px;height:1px;margin:0;padding:0;pointer-events:none;visibility:hidden'
    parent.insertBefore(sentinel, this.container)
    this.sentinel = sentinel
  }

  private setupSticky(): void {
    this.stickyObserver?.disconnect()
    if (!this.sentinel) {
      return
    }
    // Shrink the root's top edge to the sticky line so the sentinel "leaves" exactly when the
    // header pins. Anchors to the header's natural position, not scrollY=0.
    const margin = Math.max(0, Math.round(this.stickyTop))
    this.stickyObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        // Distinguish "scrolled above the sticky line" (stuck) from "still below the fold"
        // (not stuck) — the boundingClientRect check makes mid-page headers work too.
        const stuck = !entry.isIntersecting && entry.boundingClientRect.top <= this.stickyTop
        this.setSticking(stuck)
      },
      { rootMargin: `${-margin}px 0px 0px 0px`, threshold: [0] }
    )
    this.stickyObserver.observe(this.sentinel)
  }

  private setSticking(value: boolean): void {
    if (value !== this.sticking) {
      this.toggleStateClass('sticking', value)
      this.toggleAttributes(value)
      this.sticking = value

      this.onStickyChange?.(value)
      this.notify(EVENTS.STICKY, value)

      if (value && !this.isRevealEnabled()) {
        // Simple sticky: displaced immediately on stick.
        this.setDisplaced(true)
      } else if (!value) {
        this.setScrollingDown(false)
        this.setRevealing(false)
        if (this.isScrubMode()) {
          // Reset the scrub accumulator so each stick cycle starts fully shown.
          this.revealOffset = 0
          this.applyScrubTransform()
        }
        if (this.displacedState) {
          this.setDisplaced(false)
        }
      }
    }
  }

  // --- Direction / auto-hide reveal ---------------------------------------

  private updateDirection(): void {
    // Always keep `lastScrollY` current — even before the header sticks — so the first real delta
    // after sticking reflects true direction rather than a stale baseline.
    const y = this.clampScroll(window.scrollY)
    const delta = y - this.lastScrollY
    this.lastScrollY = y

    // Gate the direction *actions* (not the tracking): a lock freezes state, and there's nothing
    // to reveal/hide before sticking. Sub-pixel jitter / overscroll bounce is ignored. Hidden is
    // deliberately NOT gated — `_hidden` wins visually, but the underlying state must stay live so
    // exiting a hide-over zone reveals correctly.
    if (this.locked || !this.sticking || Math.abs(delta) < 1) {
      return
    }

    if (this.isScrubMode()) {
      this.updateScrub(delta, y)
    } else {
      this.updateAutoHide(delta, y)
    }
  }

  private updateAutoHide(delta: number, y: number): void {
    if (delta > 0 && y > this.stickyTop + this.barHeight) {
      // Scrolling down, past the bar's own height → hide (CSS owns the transform).
      this.setScrollingDown(true)
      this.setRevealing(false)
      if (!this.displacedState) {
        this.setDisplaced(true)
      }
    } else if (delta < 0) {
      // Scrolling up → reveal.
      this.setScrollingDown(false)
      this.setRevealing(true)
      if (this.displacedState) {
        this.setDisplaced(false)
      }
    }
  }

  /**
   * Scrub reveal: the bar follows scroll 1:1 within a barHeight window (v1 GSAP parity). The
   * clamped accumulator IS the moving window — reversing decreases the offset immediately from the
   * current scroll position, matching v1's re-anchoring. Transform is written inline (composited,
   * JS-authoritative); the `_reveal-scrub` class drops the CSS transition so writes aren't fought.
   */
  private updateScrub(delta: number, y: number): void {
    if (this.hidden) {
      // A hide-over zone forces fully hidden; frozen until it clears.
      return
    }
    // Gate the hide near the top exactly like auto-hide; reveal (delta < 0) always runs.
    if (delta > 0 && y <= this.stickyTop + this.barHeight) {
      return
    }
    const next = Math.min(this.barHeight, Math.max(0, this.revealOffset + delta))
    if (next === this.revealOffset) {
      return
    }
    this.revealOffset = next
    this.applyScrubTransform()
    // Keep the direction classes live for consumer styling (transform is JS-owned in scrub).
    this.setScrollingDown(delta > 0)
    this.setRevealing(delta < 0)
    if (this.revealOffset >= this.barHeight && !this.displacedState) {
      this.setDisplaced(true)
    } else if (this.revealOffset <= 0 && this.displacedState) {
      this.setDisplaced(false)
    }
  }

  private applyScrubTransform(): void {
    this.container.style.transform = `translateY(-${this.revealOffset}px)`
  }

  private clampScroll(y: number): number {
    const max = document.documentElement.scrollHeight - window.innerHeight
    return Math.max(0, Math.min(y, Math.max(0, max)))
  }

  private setScrollingDown(value: boolean): void {
    if (value === this.scrollingDown) {
      return
    }
    this.scrollingDown = value
    this.toggleStateClass('scrollingDown', value)
  }

  private setRevealing(value: boolean): void {
    if (value === this.revealing) {
      return
    }
    this.revealing = value
    this.toggleStateClass('revealing', value)
  }

  // --- Zones (hide-over / lock-over) --------------------------------------

  private setupZones(): void {
    const hideEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-arts-header-hide-over]')
    )
    const lockEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-arts-header-lock-over]')
    )

    for (const el of hideEls) {
      this.observeZone(el, 'hide', this.readZoneMode(el.getAttribute('data-arts-header-hide-over')))
    }
    for (const el of lockEls) {
      this.observeZone(el, 'lock', this.readZoneMode(el.getAttribute('data-arts-header-lock-over')))
    }

    // Re-scan when zone attributes are added/removed elsewhere (e.g. the horizontal-scroll plugin
    // toggling them on breakpoint layout swaps).
    if (!this.zoneMutationObserver) {
      this.zoneMutationObserver = new MutationObserver(() => this.refreshZones())
      this.zoneMutationObserver.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-arts-header-hide-over', 'data-arts-header-lock-over']
      })
    }
  }

  private readZoneMode(raw: string | null): TZoneMode {
    return raw === 'band' || raw === 'enter' ? raw : 'cover'
  }

  private observeZone(element: HTMLElement, kind: IZone['kind'], mode: TZoneMode): void {
    // `cover`: fires when the zone's top crosses the viewport top (zone fills the screen). The
    // edge-line rootMargin makes IO usable on elements taller than the viewport, where thresholds
    // never approach 1. `band`: intersects the header strip. `enter`: any viewport intersection.
    let rootMargin = '0px'
    if (mode === 'cover') {
      rootMargin = '0px 0px -100% 0px'
    } else if (mode === 'band') {
      rootMargin = `${-(this.stickyTop + this.barHeight)}px 0px 0px 0px`
    }

    const zone: IZone = {
      element,
      kind,
      observer: null as unknown as IntersectionObserver,
      active: false
    }
    zone.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        zone.active = entry.isIntersecting
        this.applyZones()
      },
      { rootMargin, threshold: [0] }
    )
    zone.observer.observe(element)
    this.zones.push(zone)
  }

  private applyZones(): void {
    const anyHide = this.zones.some((z) => z.kind === 'hide' && z.active)
    const anyLock = this.zones.some((z) => z.kind === 'lock' && z.active)
    this.setHidden(anyHide)
    this.setLocked(anyLock)
  }

  private teardownZones(): void {
    for (const zone of this.zones) {
      zone.observer.disconnect()
    }
    this.zones = []
  }

  // --- Shared helpers ------------------------------------------------------

  private isRevealEnabled(): boolean {
    return this.options.sticky.toggleReveal
  }

  private isScrubMode(): boolean {
    return this.options.sticky.revealMode === 'scrub'
  }

  private toggleStateClass(key: keyof IResolvedConfig['classes'], value: boolean): void {
    // An empty string in config is a deliberate opt-out for that state class.
    const className = this.config.classes[key]
    if (className.length) {
      this.container.classList.toggle(className, value)
    }
  }

  private notify(name: THeaderEventName, value: boolean): void {
    dispatchHeaderEvent(name, { value, header: this.container })
  }

  private setDisplaced(value: boolean): void {
    if (value === this.displacedState) {
      return
    }
    this.displacedState = value
    this.notify(EVENTS.DISPLACED, value)
  }

  private toggleAttributes(apply = true): void {
    const toggleAttributes = this.options.sticky.toggleAttributes

    // The Elementor editor serializes `toggleAttributes: false` to disable the swap — guard the
    // runtime shape, not just `undefined`.
    if (!toggleAttributes || typeof toggleAttributes !== 'object') {
      return
    }

    for (const key in toggleAttributes) {
      const { inactive, active } = toggleAttributes[key] || {}
      if (apply) {
        if (active?.length) {
          this.container.setAttribute(key, active)
        }
      } else if (inactive?.length) {
        this.container.setAttribute(key, inactive)
      }
    }
  }
}
