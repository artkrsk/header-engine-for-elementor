import type { IHeaderOptions } from '@engine'

/**
 * Builds the `.js-arts-header` wrapper + bar exactly as the PHP markup would. The bar's modifier
 * class picks the docking mode (the wrapper positions off it via CSS): `flow` → `_sticky`,
 * `overlay` → `_fixed`.
 */
export function buildHeader(
  options?: IHeaderOptions,
  fixture: { mode?: 'flow' | 'overlay' } = {}
): {
  container: HTMLElement
  bar: HTMLElement
} {
  const container = document.createElement('header')
  container.className = 'arts-header js-arts-header'
  if (options) {
    container.setAttribute('data-arts-header-options', JSON.stringify(options))
  }
  const bar = document.createElement('div')
  const modifier = fixture.mode === 'overlay' ? 'arts-header__bar_fixed' : 'arts-header__bar_sticky'
  bar.className = `arts-header__bar ${modifier} js-arts-header__bar`
  bar.innerHTML = '<span class="pg-logo">HEADER</span>'
  container.appendChild(bar)
  return { container, bar }
}

/** Injects a scenario-specific stylesheet (state-styling demos parameterize the bar look). */
export function injectStyle(css: string): void {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

/** A full-viewport tinted "hero" section (a gradient stands in for a hero photo, CSP-safe). */
export function heroSection(label: string): HTMLElement {
  const s = document.createElement('section')
  s.className = 'pg-hero'
  s.textContent = label
  return s
}

/** A tall scrollable page so the sticky/reveal behavior has room to run. */
export function buildPage(sections = 6, minHeight = '80vh'): HTMLElement {
  const main = document.createElement('main')
  for (let i = 1; i <= sections; i++) {
    main.appendChild(makeSection(`section ${i}`, minHeight))
  }
  return main
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
  mode: 'cover' | 'band' | 'enter',
  label: string,
  minHeight = '160vh'
): HTMLElement {
  const s = document.createElement('section')
  s.className = 'pg-section pg-zone'
  s.style.minHeight = minHeight
  s.setAttribute(
    kind === 'hide' ? 'data-arts-header-hide-over' : 'data-arts-header-lock-over',
    mode
  )
  s.textContent = label
  return s
}
