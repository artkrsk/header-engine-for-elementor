/**
 * Builds the `.js-arts-header` wrapper + bar in the shape the PHP markup produces. The bar's
 * modifier class picks the docking mode (the wrapper positions off it via CSS): `flow` →
 * `_sticky`, `overlay` → `_fixed`, `bottom` → `_bottom`, `hero-bottom` → no bar modifier (the
 * `_hero-bottom` wrapper class positions). Hero-bottom is the one mode the panel cannot produce;
 * the rest mirror the editor's Position select.
 * The dual-logo markup + static logo attributes exercise the `_logo.scss` crossfade.
 */
export function buildHeader(
  fixture: { mode?: 'flow' | 'overlay' | 'hero-bottom' | 'bottom' } = {}
): {
  container: HTMLElement
  bar: HTMLElement
} {
  const container = document.createElement('header')
  container.className = 'arts-header js-arts-header'
  if (fixture.mode === 'hero-bottom') {
    container.classList.add('arts-header_hero-bottom')
  }
  container.setAttribute('data-arts-header-non-sticky-logo', 'primary')
  container.setAttribute('data-arts-header-sticky-logo', 'secondary')
  const bar = document.createElement('div')
  const modifiers = {
    overlay: ' arts-header__bar_fixed',
    bottom: ' arts-header__bar_bottom',
    'hero-bottom': '',
    flow: ' arts-header__bar_sticky'
  } as const
  const modifier = modifiers[fixture.mode ?? 'flow']
  bar.className = `arts-header__bar${modifier} js-arts-header__bar`
  bar.innerHTML =
    '<span class="pg-logo arts-header-logo">' +
    '<span class="arts-header-logo__img-primary">non-sticky logo</span>' +
    '<span class="arts-header-logo__img-secondary">sticky logo</span>' +
    '</span>'
  container.appendChild(bar)
  return { container, bar }
}

/** A full-viewport tinted "hero" section (a gradient stands in for a hero photo, CSP-safe). */
export function heroSection(label: string): HTMLElement {
  const s = document.createElement('section')
  s.className = 'pg-hero'
  s.textContent = label
  return s
}

export function makeSection(label: string, minHeight = '80vh'): HTMLElement {
  const s = document.createElement('section')
  s.className = 'pg-section'
  s.style.minHeight = minHeight
  s.textContent = label
  return s
}

/** A section stamped with a hide-over / lock-over zone attribute. */
export function zoneSection(
  kind: 'hide' | 'lock',
  mode: 'at-top' | 'overlap' | 'in-view',
  label: string,
  minHeight = '160vh'
): HTMLElement {
  const s = document.createElement('section')
  s.className = kind === 'lock' ? 'pg-section pg-zone pg-zone_lock' : 'pg-section pg-zone'
  s.style.minHeight = minHeight
  s.setAttribute(
    kind === 'hide' ? 'data-arts-header-hide-over' : 'data-arts-header-lock-over',
    mode
  )
  s.textContent = label
  return s
}
