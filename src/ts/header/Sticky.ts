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
  private triggerEl: HTMLElement | null = null
  private stickyObserver: IntersectionObserver | null = null
  private untilSentinel: HTMLElement | null = null
  private untilObserver: IntersectionObserver | null = null
  private zones: IZone[] = []
  private zoneMutationObserver: MutationObserver | null = null

  private sticking = false
  // Geometric stuck state (sentinel crossing). Usually published as `sticking` immediately — except
  // during a scrub-mode natural departure, where publishing defers (see setStuck).
  private stuck = false
  private pendingStickPublish = false
  private departureAnchorY = 0
  private revealing = false
  private scrollingDown = false
  private hidden = false
  private locked = false
  private released = false
  private displacedState = false
  private scrubOffset = 0

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
    if (this.isRevealEnabled() && this.isScrubMode()) {
      // Bookkeeping for the eventual reclaim: hidden parks the offset at full-hide (a later
      // scroll-up reveals); leaving hidden while locked parks it at shown (CSS shows the bar).
      if (value) {
        this.scrubOffset = this.barHeight
      } else if (this.locked) {
        this.scrubOffset = 0
      }
      this.syncScrubOwnership()
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
    if (this.isRevealEnabled() && this.isScrubMode()) {
      if (value && !this.hidden) {
        // Lock reveals: park the offset at shown so a later unlock reclaims from there.
        this.scrubOffset = 0
      }
      this.syncScrubOwnership()
    }
    this.notify(EVENTS.LOCKED, value)
  }

  /**
   * Scrub-mode transform ownership. JS owns the wrapper transform only while actively scrubbing;
   * locked and hidden both gate the frame writes, so in those states ownership passes to CSS —
   * dropping `_reveal-scrub` re-enables the mode transition and clearing the inline transform lets
   * the `_hidden` / locked-baseline rules animate the change, the same slides auto-hide gets.
   */
  private syncScrubOwnership(): void {
    if (this.locked || this.hidden) {
      this.toggleStateClass('revealScrub', false)
      this.container.style.removeProperty('transform')
    } else {
      // Reclaim: class back on (kills the transition), inline transform restored at the parked
      // offset — visually identical to what CSS was showing, so the swap is seamless.
      this.toggleStateClass('revealScrub', true)
      this.applyScrubTransform()
    }
  }

  /** Re-scan the DOM for hide-over / lock-over zones (call after layout-affecting changes). */
  public refreshZones(): void {
    this.teardownZones()
    this.setupZones()
  }

  // --- Lifecycle -----------------------------------------------------------

  protected override onInit(): void {
    this.measure()
    this.triggerEl = this.resolveTrigger()
    this.setupSentinel()
    this.setupSticky()
    this.setupUntil()

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
    // Re-arm unconditionally: the release line is pin + bar height, and the bar can resize without
    // the pin line moving.
    this.setupUntil()
    this.refreshZones()
  }

  protected override onDestroy(revert: boolean): void {
    window.removeEventListener('scroll', this.onScroll)
    cancelAnimationFrame(this.rafId)

    this.stickyObserver?.disconnect()
    this.stickyObserver = null
    this.untilObserver?.disconnect()
    this.untilObserver = null
    this.teardownZones()
    this.zoneMutationObserver?.disconnect()
    this.zoneMutationObserver = null

    if (this.sentinel?.parentNode) {
      this.sentinel.parentNode.removeChild(this.sentinel)
    }
    this.sentinel = null
    this.triggerEl = null
    if (this.untilSentinel?.parentNode) {
      this.untilSentinel.parentNode.removeChild(this.untilSentinel)
    }
    this.untilSentinel = null

    // Clear the scrub inline transform + mode class, and any release anchor.
    this.container.style.transform = ''
    this.container.style.removeProperty('--arts-header-release-top')
    this.toggleStateClass('revealScrub', false)
    this.toggleStateClass('released', false)
    this.released = false

    this.stuck = false
    this.pendingStickPublish = false
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
    // stickyTop = the pin line (viewport Y where the header locks): the admin-bar offset, which WP
    // applies as <html> margin-top. Read that resolved px value rather than the container's computed
    // `top` — a bottom-docked wrapper (hero-bottom at rest) reports its docked offset, not the pin line.
    const adminOffset = parseFloat(getComputedStyle(document.documentElement).marginTop)
    this.stickyTop = Number.isFinite(adminOffset) ? Math.max(0, adminOffset) : 0
  }

  // --- Sticky detection (sentinel + IntersectionObserver) ------------------

  /** Resolve `sticky.trigger` (selector or element) — a custom stick anchor replacing the sentinel. */
  private resolveTrigger(): HTMLElement | null {
    const trigger = this.options.sticky.trigger
    if (!trigger) {
      return null
    }
    return typeof trigger === 'string' ? document.querySelector<HTMLElement>(trigger) : trigger
  }

  /** The element whose top edge crossing the sticky line flips the stuck state. */
  private getStickyObserveTarget(): HTMLElement | null {
    return this.triggerEl ?? this.sentinel
  }

  private setupSentinel(): void {
    // A custom trigger replaces the auto-sentinel entirely — don't inject one.
    if (this.sentinel || this.triggerEl) {
      return
    }
    const parent = this.container.parentNode
    if (!parent) {
      return
    }
    const sentinel = document.createElement('div')
    sentinel.className = 'arts-header__sentinel'
    sentinel.setAttribute('aria-hidden', 'true')
    // Styled in CSS (`.arts-header__sentinel`) as a zero-flow-footprint 1px marker at the header's
    // natural top edge. Placed as a sibling *before* the wrapper (not inside it) so it isn't carried
    // along when the wrapper pins.
    parent.insertBefore(sentinel, this.container)
    this.sentinel = sentinel
  }

  private setupSticky(): void {
    this.stickyObserver?.disconnect()
    const target = this.getStickyObserveTarget()
    if (!target) {
      return
    }
    // Shrink the root's top edge to the sticky line so the target "leaves" exactly when the header
    // pins. Anchors to the header's natural position (or the custom trigger), not scrollY=0.
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
        // How far past the pin line the crossing was when this callback delivered — anchors the
        // natural-departure math to the stick line itself (works for mid-page triggers too).
        const overshoot = stuck ? Math.max(0, this.stickyTop - entry.boundingClientRect.top) : 0
        this.setStuck(stuck, overshoot)
      },
      { rootMargin: `${-margin}px 0px 0px 0px`, threshold: [0] }
    )
    this.stickyObserver.observe(target)
  }

  private setStuck(value: boolean, overshoot = 0): void {
    if (value === this.stuck) {
      return
    }
    this.stuck = value
    if (value) {
      // Scrub natural departure: while the pinned+translated bar tracks the exact trajectory of
      // in-flow scrolling (first barHeight of travel past the pin line), it is visually plain page
      // content — defer the published sticky state (class, events, getter, logo/spacing swap) until
      // the bar fully departs or visibly pins (resolvePendingStick decides per frame). A crossing
      // detected deeper than a bar height (scroll-restored load, programmatic jump) publishes
      // immediately.
      if (this.isRevealEnabled() && this.isScrubMode() && overshoot <= this.barHeight) {
        this.pendingStickPublish = true
        this.departureAnchorY = this.clampScroll(window.scrollY)
        return
      }
      this.setSticking(true)
    } else {
      if (this.pendingStickPublish) {
        // Unstick during a deferral that never published: clear the departure leftovers the
        // published unstick branch would normally reset.
        this.pendingStickPublish = false
        this.scrubOffset = 0
        this.applyScrubTransform()
        this.setScrollingDown(false)
        this.setRevealing(false)
        if (this.displacedState) {
          this.setDisplaced(false)
        }
      }
      this.setSticking(false)
    }
  }

  /** Publish once the deferred bar either fully departed (swap happens off-screen) or visibly pins. */
  private resolvePendingStick(y: number): void {
    if (!this.pendingStickPublish) {
      return
    }
    // The scrub accumulates deltas from the moment the stick delivered, so on a natural departure
    // the offset tracks the scroll travelled since then; lagging behind it means the bar is being
    // held in place (revealOffset gating, zone freeze) — visibly sticky.
    const since = y - this.departureAnchorY
    if (this.scrubOffset >= this.barHeight || this.scrubOffset < since - 4) {
      this.pendingStickPublish = false
      this.setSticking(true)
    }
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
          this.scrubOffset = 0
          this.applyScrubTransform()
        }
        if (this.displacedState) {
          this.setDisplaced(false)
        }
      }
    }
  }

  // --- Sticky-until (release / scroll-away) --------------------------------

  /** Resolve `sticky.until` (selector or element) — the boundary past which the header releases. */
  private resolveUntil(): HTMLElement | null {
    const until = this.options.sticky.until
    if (!until) {
      return null
    }
    return typeof until === 'string' ? document.querySelector<HTMLElement>(until) : until
  }

  private setupUntil(): void {
    this.untilObserver?.disconnect()
    const boundary = this.resolveUntil()
    if (!boundary?.parentNode) {
      return
    }
    // Observe a zero-footprint sentinel at the boundary's *top* edge, not the (often tall) boundary
    // itself: a 1px marker with a one-sided top rootMargin gives a clean, jump-proof top-edge
    // crossing (same trick as the stick sentinel), where observing the tall element directly would
    // stay "intersecting" until it fully cleared the line.
    if (!this.untilSentinel) {
      const sentinel = document.createElement('div')
      sentinel.className = 'arts-header__sentinel'
      sentinel.setAttribute('aria-hidden', 'true')
      boundary.parentNode.insertBefore(sentinel, boundary)
      this.untilSentinel = sentinel
    }
    // The release line is the header's bottom edge (pin line + bar height): the header hands off to
    // the boundary exactly when their edges meet, so there's no gap.
    const line = this.stickyTop + this.barHeight
    const margin = Math.max(0, Math.round(line))
    this.untilObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        this.setReleased(!entry.isIntersecting && entry.boundingClientRect.top <= line)
      },
      { rootMargin: `${-margin}px 0px 0px 0px`, threshold: [0] }
    )
    this.untilObserver.observe(this.untilSentinel)
  }

  private setReleased(value: boolean): void {
    if (this.released === value) {
      return
    }
    this.released = value
    if (value) {
      // Anchor at the document Y the header holds right now so it scrolls away with no jump — the
      // fixed→absolute swap (CSS `_released`) is continuous. Reveal is frozen by the updateDirection
      // gate, so whatever state it's in (shown / hidden / mid-scrub) simply detaches and scrolls off,
      // rather than animating back to shown at the hand-off.
      const anchor = Math.round(window.scrollY + this.stickyTop)
      this.container.style.setProperty('--arts-header-release-top', `${anchor}px`)
    } else {
      this.container.style.removeProperty('--arts-header-release-top')
    }
    this.toggleStateClass('released', value)
  }

  // --- Direction / auto-hide reveal ---------------------------------------

  private updateDirection(): void {
    // Always keep `lastScrollY` current — even before the header sticks — so the first real delta
    // after sticking reflects true direction rather than a stale baseline.
    const y = this.clampScroll(window.scrollY)
    const delta = y - this.lastScrollY
    this.lastScrollY = y

    // Gate the direction *actions* (not the tracking): a lock freezes state, and there's nothing
    // to reveal/hide before sticking. A release (sticky-until) hands the bar over to normal scroll,
    // so no reveal transform runs while released. Sub-pixel jitter / overscroll bounce is ignored.
    // Hidden is deliberately NOT gated — `_hidden` wins visually, but the underlying state must stay
    // live so exiting a hide-over zone reveals correctly.
    if (this.locked || !this.stuck || this.released || Math.abs(delta) < 1) {
      return
    }

    if (this.isScrubMode()) {
      this.updateScrub(delta, y)
    } else {
      this.updateAutoHide(delta, y)
    }
  }

  private updateAutoHide(delta: number, y: number): void {
    if (delta > 0 && y > this.stickyTop + this.options.sticky.revealOffset) {
      // Scrolling down, past the configured offset (default 0 = immediate) → hide.
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
    this.resolvePendingStick(y)
    if (this.hidden) {
      // A hide-over zone forces fully hidden; frozen until it clears.
      return
    }
    // Gate the hide by the configured offset (default 0 = immediate); reveal (delta < 0) always runs.
    if (delta > 0 && y <= this.stickyTop + this.options.sticky.revealOffset) {
      return
    }
    const next = Math.min(this.barHeight, Math.max(0, this.scrubOffset + delta))
    if (next === this.scrubOffset) {
      return
    }
    this.scrubOffset = next
    this.applyScrubTransform()
    this.resolvePendingStick(y)
    // Keep the direction classes live for consumer styling (transform is JS-owned in scrub).
    this.setScrollingDown(delta > 0)
    this.setRevealing(delta < 0)
    if (this.scrubOffset >= this.barHeight && !this.displacedState) {
      this.setDisplaced(true)
    } else if (this.scrubOffset <= 0 && this.displacedState) {
      this.setDisplaced(false)
    }
  }

  private applyScrubTransform(): void {
    this.container.style.transform = `translateY(-${this.scrubOffset}px)`
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
    return raw === 'overlap' || raw === 'in-view' ? raw : 'at-top'
  }

  private observeZone(element: HTMLElement, kind: IZone['kind'], mode: TZoneMode): void {
    // `at-top`: fires while the zone straddles the viewport top, where the header docks. The
    // edge-line rootMargin makes IO usable on elements taller than the viewport, where thresholds
    // never approach 1. `overlap`: intersects the header strip itself. `in-view`: any viewport
    // intersection. Margins are computed at observe time; `refresh()` re-arms them.
    let rootMargin = '0px'
    if (mode === 'at-top') {
      rootMargin = '0px 0px -100% 0px'
    } else if (mode === 'overlap') {
      // Shrink the root to the header strip [stickyTop, stickyTop + barHeight].
      const line = this.stickyTop + this.barHeight
      const below = Math.max(0, Math.round(window.innerHeight - line))
      rootMargin = `${-Math.round(this.stickyTop)}px 0px ${-below}px 0px`
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
