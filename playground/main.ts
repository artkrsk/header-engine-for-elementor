import { createHeader, type IHeader, type IStickyOptions, type TZoneMode } from '@engine'
import '@styles/index.scss'
import { buildHeader, heroSection, makeSection, zoneSection } from './shared/fixtures'
import { mountLenisToggle } from './shared/lenis'
import './shared/playground.scss'

// Single playground page: every option is a live control. Options are constructor-only, so the
// controls marked "(rebuild)" tear the header down and re-init it; the rest act on the live instance.

type Mode = 'flow' | 'overlay' | 'hero-bottom'
type Reveal = 'off' | 'auto-hide' | 'scrub'

const state = {
  stickyEnabled: true,
  mode: 'flow' as Mode,
  reveal: 'auto-hide' as Reveal,
  revealOffset: 0,
  zoneMode: 'at-top' as TZoneMode,
  until: false,
  lock: false,
  tallBar: false
}

let header: IHeader | null = null
let container: HTMLElement | null = null
let bar: HTMLElement | null = null
let main: HTMLElement | null = null

// --- fixture -------------------------------------------------------------

function appendZonesAndContent(m: HTMLElement): void {
  m.appendChild(makeSection('content 1 — scroll down/up to see reveal'))
  m.appendChild(makeSection('content 2'))
  m.appendChild(
    zoneSection(
      'hide',
      state.zoneMode,
      `HIDE ZONE (${state.zoneMode}) — header hides over this section`
    )
  )
  m.appendChild(makeSection('content 3'))
  m.appendChild(
    zoneSection(
      'lock',
      state.zoneMode,
      `LOCK ZONE (${state.zoneMode}) — header reveals + freezes over this section`
    )
  )
  m.appendChild(makeSection('content 4'))
  if (state.until) {
    const boundary = document.createElement('section')
    boundary.className = 'pg-section pg-until'
    boundary.style.minHeight = '120vh'
    boundary.textContent =
      'RELEASE BOUNDARY (sticky.until) — header un-pins and scrolls away below here'
    m.appendChild(boundary)
  }
  m.appendChild(makeSection('content 5'))
}

// --- lifecycle -----------------------------------------------------------

function rebuild(): void {
  if (header) {
    header.destroy(true)
    header = null
  }
  container?.remove()
  main?.remove()

  const built = buildHeader({ mode: state.mode })
  container = built.container
  bar = built.bar
  main = document.createElement('main')

  // Docking mode is a pure markup/CSS concern (the bar's modifier class decides); options only
  // carry behavior. hero-bottom rides the overlay CSS; its `_hero-bottom` wrapper class + trigger
  // do the rest.
  const sticky: IStickyOptions | false = state.stickyEnabled
    ? {
        reveal:
          state.reveal === 'off'
            ? false
            : {
                mode: state.reveal === 'scrub' ? 'scrub' : 'auto-hide',
                offset: state.revealOffset
              }
      }
    : false

  if (state.mode === 'hero-bottom') {
    // Header docked inside a relative hero (over its bottom, transparent); a trigger marker at the
    // header's top drives the pin.
    const hero = heroSection('FULLSCREEN HERO')
    const trigger = document.createElement('span')
    trigger.className = 'stick-trigger'
    hero.appendChild(trigger)
    hero.appendChild(container)
    main.appendChild(hero)
    appendZonesAndContent(main)
    document.body.appendChild(main)
    if (sticky !== false) {
      // A trigger marker at the header's top drives the pin.
      sticky.trigger = '.stick-trigger'
    }
  } else {
    // flow / overlay: header is a body child before the content (sentinel lands at the page top).
    document.body.appendChild(container)
    if (state.mode === 'overlay') {
      main.appendChild(heroSection('FULLSCREEN HERO'))
    }
    appendZonesAndContent(main)
    document.body.appendChild(main)
  }

  if (state.until && sticky !== false) {
    sticky.until = '.pg-until'
  }

  header = createHeader(container, built.bar, { options: { sticky } })
  header.init()
  if (state.lock) {
    header.lockSticky(true)
  }
  if (state.tallBar) {
    bar.style.height = '140px'
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

function actionButton(label: string, onClick: () => void): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pg-ctl'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'pg-ctl__btn'
  button.textContent = label
  button.addEventListener('click', onClick)
  wrap.appendChild(button)
  return wrap
}

function mountPanel(): void {
  const panel = document.createElement('div')
  panel.className = 'pg-panel'
  panel.innerHTML = '<div class="pg-panel__title">playground</div>'

  panel.appendChild(
    checkbox('sticky enabled (rebuild)', state.stickyEnabled, (v) => {
      state.stickyEnabled = v
      rebuild()
    })
  )
  panel.appendChild(
    radioGroup('mode (rebuild)', ['flow', 'overlay', 'hero-bottom'] as const, state.mode, (v) => {
      state.mode = v
      rebuild()
    })
  )
  panel.appendChild(
    radioGroup('reveal (rebuild)', ['off', 'auto-hide', 'scrub'] as const, state.reveal, (v) => {
      state.reveal = v
      rebuild()
    })
  )
  panel.appendChild(
    slider('revealOffset (rebuild)', 0, 300, state.revealOffset, (v) => {
      state.revealOffset = v
      rebuild()
    })
  )
  panel.appendChild(
    radioGroup('zone geometry', ['at-top', 'overlap', 'in-view'] as const, state.zoneMode, (v) => {
      state.zoneMode = v
      // Update the zone attributes in place, then re-scan — no full rebuild needed.
      for (const el of document.querySelectorAll<HTMLElement>('[data-arts-header-hide-over]')) {
        el.setAttribute('data-arts-header-hide-over', v)
        el.textContent = `HIDE ZONE (${v}) — header hides over this section`
      }
      for (const el of document.querySelectorAll<HTMLElement>('[data-arts-header-lock-over]')) {
        el.setAttribute('data-arts-header-lock-over', v)
        el.textContent = `LOCK ZONE (${v}) — header reveals + freezes over this section`
      }
      header?.refreshZones()
    })
  )
  panel.appendChild(
    checkbox('until (release / scroll away) (rebuild)', state.until, (v) => {
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
  panel.appendChild(
    actionButton('Toggle bar height', () => {
      state.tallBar = !state.tallBar
      if (bar) {
        bar.style.height = state.tallBar ? '140px' : ''
      }
    })
  )
  panel.appendChild(
    actionButton('Toggle hidden', () => {
      if (header) {
        header.toggleHidden(!header.isHidden)
      }
    })
  )
  document.body.appendChild(panel)
}

// --- boot ----------------------------------------------------------------

mountPanel()
mountLenisToggle()
rebuild()

Object.assign(window, {
  getHeader: () => header,
  getContainer: () => container,
  getBar: () => bar
})
