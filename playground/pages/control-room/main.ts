import { Header, type IHeaderOptions } from '@engine'
import { injectStyle } from '../../shared/fixtures'
import { scenario } from '../../shared/scenario'

// One-page control room: every option is a live control that re-inits the header, with a unified HUD
// (state classes + height vars + scrollY + CLS). The harness for exercising all behaviors together.

scenario('control-room', { nav: false })

// Hero-bottom styling: transparent header docked over the hero bottom, opaque once pinned; the
// trigger marker sits at the header's top (bar is 72px, docked at bottom:0 → top at bottom:72px).
injectStyle(`
  .stick-trigger { position: absolute; left: 0; bottom: 72px; width: 1px; height: 1px; pointer-events: none; }
  .arts-header_hero-bottom .arts-header__bar { background: transparent; color: #fff; }
  .arts-header_hero-bottom.arts-header_sticky .arts-header__bar { background: #0b1220; box-shadow: 0 6px 24px rgba(0,0,0,.28); }
`)

type Mode = 'flow' | 'overlay' | 'hero-bottom'
type Reveal = 'off' | 'auto-hide' | 'scrub'
type ZoneMode = 'cover' | 'band' | 'enter'

const state = {
  mode: 'flow' as Mode,
  reveal: 'auto-hide' as Reveal,
  revealOffset: 0,
  zoneMode: 'cover' as ZoneMode,
  until: false,
  lock: false
}

let header: Header | null = null
let container: HTMLElement | null = null
let main: HTMLElement | null = null

// --- fixture -------------------------------------------------------------

function makeBar(): { container: HTMLElement; bar: HTMLElement } {
  const c = document.createElement('header')
  c.className = 'arts-header js-arts-header'
  if (state.mode === 'hero-bottom') {
    c.classList.add('arts-header_hero-bottom')
  }
  const bar = document.createElement('div')
  // flow → _sticky · overlay → _fixed · hero-bottom → no bar modifier (the wrapper class positions)
  const modifier =
    state.mode === 'flow'
      ? ' arts-header__bar_sticky'
      : state.mode === 'overlay'
        ? ' arts-header__bar_fixed'
        : ''
  bar.className = `arts-header__bar${modifier} js-arts-header__bar`
  bar.innerHTML = '<span class="pg-logo">HEADER</span>'
  c.appendChild(bar)
  return { container: c, bar }
}

function section(
  label: string,
  cls = '',
  attrs: Record<string, string> = {},
  minH = '80vh'
): HTMLElement {
  const s = document.createElement('section')
  s.className = `pg-section ${cls}`.trim()
  s.style.minHeight = minH
  s.textContent = label
  for (const [k, v] of Object.entries(attrs)) {
    s.setAttribute(k, v)
  }
  return s
}

function appendZonesAndContent(m: HTMLElement): void {
  m.appendChild(section('content 1 — scroll down/up to see reveal'))
  m.appendChild(section('content 2'))
  m.appendChild(
    section(
      `HIDE-OVER ZONE (${state.zoneMode})`,
      'pg-zone',
      { 'data-arts-header-hide-over': state.zoneMode },
      '160vh'
    )
  )
  m.appendChild(section('content 3'))
  m.appendChild(
    section(
      `LOCK-OVER ZONE (${state.zoneMode})`,
      'pg-zone pg-zone_lock',
      { 'data-arts-header-lock-over': state.zoneMode },
      '160vh'
    )
  )
  m.appendChild(section('content 4'))
  if (state.until) {
    m.appendChild(
      section(
        'RELEASE BOUNDARY (sticky.until) — header un-pins and scrolls away below here',
        'pg-until',
        {},
        '120vh'
      )
    )
  }
  m.appendChild(section('content 5'))
}

// --- lifecycle -----------------------------------------------------------

async function rebuild(): Promise<void> {
  if (header) {
    await header.destroy(true)
    header = null
  }
  container?.remove()
  main?.remove()

  const built = makeBar()
  container = built.container
  main = document.createElement('main')

  const options: IHeaderOptions = {
    // hero-bottom rides the overlay/out-of-flow CSS; its `_hero-bottom` wrapper class + trigger do the rest.
    mode: state.mode === 'hero-bottom' ? 'overlay' : state.mode,
    sticky: {
      toggleReveal: state.reveal !== 'off',
      revealMode: state.reveal === 'scrub' ? 'scrub' : 'auto-hide',
      revealOffset: state.revealOffset
    }
  }

  if (state.mode === 'hero-bottom') {
    // Header docked inside a relative hero (over its bottom, transparent); a trigger marker at the
    // header's top drives the pin.
    const hero = document.createElement('section')
    hero.className = 'pg-hero'
    hero.textContent = 'FULLSCREEN HERO'
    const trigger = document.createElement('span')
    trigger.className = 'stick-trigger'
    hero.appendChild(trigger)
    hero.appendChild(container)
    main.appendChild(hero)
    appendZonesAndContent(main)
    document.body.appendChild(main)
    options.sticky = { ...options.sticky, trigger: '.stick-trigger' }
  } else {
    // flow / overlay: header is a body child before the content (sentinel lands at the page top).
    document.body.appendChild(container)
    if (state.mode === 'overlay') {
      const hero = document.createElement('section')
      hero.className = 'pg-hero'
      hero.textContent = 'FULLSCREEN HERO'
      main.appendChild(hero)
    }
    appendZonesAndContent(main)
    document.body.appendChild(main)
  }

  if (state.until) {
    options.sticky = { ...options.sticky, until: '.pg-until' }
  }

  header = new Header(container, built.bar, { options })
  await header.init()
  if (state.lock) {
    header.lockSticky(true)
  }
}

// --- control panel -------------------------------------------------------

function radioGroup<T extends string>(
  label: string,
  values: readonly T[],
  current: T,
  onChange: (v: T) => void
): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pg-ctl'
  wrap.innerHTML = `<span class="pg-ctl__label">${label}</span>`
  const row = document.createElement('div')
  row.className = 'pg-ctl__row'
  const name = `ctl-${label.replace(/\W+/g, '')}`
  for (const v of values) {
    const id = `${name}-${v}`
    const l = document.createElement('label')
    l.className = 'pg-ctl__opt'
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = name
    input.id = id
    input.checked = v === current
    input.addEventListener('change', () => {
      if (input.checked) {
        onChange(v)
      }
    })
    l.appendChild(input)
    l.appendChild(document.createTextNode(v))
    row.appendChild(l)
  }
  wrap.appendChild(row)
  return wrap
}

function slider(
  label: string,
  min: number,
  max: number,
  value: number,
  onCommit: (v: number) => void
): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pg-ctl'
  const out = document.createElement('span')
  out.textContent = String(value)
  const labelEl = document.createElement('span')
  labelEl.className = 'pg-ctl__label'
  labelEl.append(`${label}: `, out)
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.value = String(value)
  input.addEventListener('input', () => {
    out.textContent = input.value
  })
  input.addEventListener('change', () => {
    onCommit(Number(input.value))
  })
  wrap.appendChild(labelEl)
  wrap.appendChild(input)
  return wrap
}

function checkbox(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement('label')
  wrap.className = 'pg-ctl pg-ctl_inline'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = value
  input.addEventListener('change', () => onChange(input.checked))
  wrap.appendChild(input)
  wrap.append(` ${label}`)
  return wrap
}

function mountPanel(): void {
  const panel = document.createElement('div')
  panel.className = 'pg-panel'
  panel.innerHTML = '<div class="pg-panel__title">control room</div>'

  panel.appendChild(
    radioGroup('mode', ['flow', 'overlay', 'hero-bottom'] as const, state.mode, (v) => {
      state.mode = v
      rebuild()
    })
  )
  panel.appendChild(
    radioGroup('reveal', ['off', 'auto-hide', 'scrub'] as const, state.reveal, (v) => {
      state.reveal = v
      rebuild()
    })
  )
  panel.appendChild(
    slider('revealOffset', 0, 300, state.revealOffset, (v) => {
      state.revealOffset = v
      rebuild()
    })
  )
  panel.appendChild(
    radioGroup('zone geometry', ['cover', 'band', 'enter'] as const, state.zoneMode, (v) => {
      state.zoneMode = v
      // Update the zone attributes in place, then re-scan — no full rebuild needed.
      for (const el of document.querySelectorAll<HTMLElement>('[data-arts-header-hide-over]')) {
        el.setAttribute('data-arts-header-hide-over', v)
        el.textContent = `HIDE-OVER ZONE (${v})`
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-arts-header-lock-over]')) {
        el.setAttribute('data-arts-header-lock-over', v)
        el.textContent = `LOCK-OVER ZONE (${v})`
      }
      header?.refreshZones()
    })
  )
  panel.appendChild(
    checkbox('until (release / scroll away)', state.until, (v) => {
      state.until = v
      rebuild()
    })
  )
  panel.appendChild(
    checkbox('lock (freeze)', state.lock, (v) => {
      state.lock = v
      header?.lockSticky(v)
    })
  )
  document.body.appendChild(panel)
}

// --- unified HUD (persistent, reads the current container live) -----------

const STATE_CLASSES = ['sticky', 'revealing', 'scrolling-down', 'hidden', 'locked', 'released']

function mountHud(): void {
  const el = document.createElement('div')
  el.className = 'pg-hud'
  document.body.appendChild(el)

  let cls = 0
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
        if (!shift.hadRecentInput) {
          cls += shift.value
        }
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    // layout-shift unsupported
  }

  const paint = (): void => {
    const cs = getComputedStyle(document.documentElement)
    const active = container
      ? STATE_CLASSES.filter((c) => container?.classList.contains(`arts-header_${c}`))
      : []
    el.innerHTML = [
      `mode: ${state.mode} · reveal: ${state.reveal}${state.reveal !== 'off' ? ` (+${state.revealOffset})` : ''}`,
      `state: ${active.join(' ') || '—'}`,
      `--height: ${cs.getPropertyValue('--arts-header-height').trim() || '—'}`,
      `--non-sticky: ${cs.getPropertyValue('--arts-header-height-non-sticky').trim() || '—'}`,
      `scrollY: ${Math.round(window.scrollY)} · CLS: ${cls.toFixed(4)}`
    ].join('<br>')
    requestAnimationFrame(paint)
  }
  paint()
}

// --- boot ----------------------------------------------------------------

mountPanel()
mountHud()
rebuild()

Object.assign(window, { getHeader: () => header, getContainer: () => container })
