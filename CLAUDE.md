# header-for-elementor

Zero-runtime-dependency sticky/reveal header **engine** for Elementor, in TypeScript + Sass. The
engine watches scroll and layout and toggles state **classes** and CSS **custom properties** on a
header wrapper; the visible show/hide/shrink animation is done in CSS, not per-frame JS. It is meant
to ship as an Elementor plugin bundle, but **only the frontend exists so far** (see Status).

Package: `@arts/header` (private, ESM). Consumer entry: `src/ts/index.ts`, also the `@engine` alias.

## Status / scope

Frontend-only at this stage. `project.config.js` points the plugin build at `src/php`,
`src/wordpress-plugin`, `dist/`, and a `build/index.js` runner — **none of those exist yet**, so
`pnpm build` and `pnpm dev:plugin` do not run. There is no PHP, WordPress plugin header, or Elementor
widget/control code in the repo; don't document it as if present.

## Commands

- `pnpm dev` — Vite dev server for `playground/`, the only way to exercise the engine.
- `pnpm typecheck` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`).
- `pnpm lint` — `biome check .`; `pnpm format` — `biome format --write .`.

Biome is linter + formatter: single quotes, no semicolons, 2-space indent, width 100; `noExplicitAny`
is off under `src/ts/**`.

## Architecture

Two entry points, one core.

- `src/ts/boot.ts` — the **WordPress/Elementor bundle** entry (esbuild). Self-executes `init()`, which
  creates one global `HeaderApp` and stores it on `window.artsHeaderForElementor`.
- `src/ts/index.ts` — the **library** surface: pure re-exports, no side effects. Importing it never
  boots anything. Playground and monorepo consumers use this (via `@engine`).

Runtime layering:

- `HeaderApp` (`elementor/`) — lifecycle + state machine (`idle|initializing|running|destroying`),
  before/after callbacks, and (editor only) attaching the container handler.
- `Header` (`header/`) — reads options, wires the plugins, exposes the instance API: `init`,
  `destroy(revert)`, `refresh`, `toggleHidden`, `lockSticky`, `refreshZones`, and `isSticking` /
  `isHidden` / `isLocked` getters.
- `Sticky` + `HeightObserver` (`header/`) — the two `Plugin` subclasses that do the work.
  - `Sticky` is the core: an injected 1px **sentinel** + `IntersectionObserver` anchored at the
    header's natural position detects the stick transition (works at page top, under a topbar, or at a
    hero's bottom edge). One passive `scroll` listener + rAF drives direction. Owns reveal (auto-hide
    or scrub), sticky-`until` release, and hide-over / lock-over **zones** (declared via data attrs).
  - `HeightObserver` publishes live and rest bar heights as CSS vars via a border-box `ResizeObserver`.

Editor path: `ContainerHandler` (`elementor/`) extends `elementorModules.frontend.handlers.Base`, wraps
the Elementor Container in the `.arts-header` div, and mirrors panel settings into `data-arts-header-*`
attributes on every change, re-initialising the live header.

`utils.ts` is a **vendored minimal subset of `@arts/utilities`** (JSONParse, deepmerge, debounce,
logger, isHTMLElement, Resize, elementorEditorLoaded), inlined to keep the engine zero-runtime-dep.

## Layout

```
src/ts/
  boot.ts       WP bundle entry (side-effectful)
  index.ts      public library surface (@engine)
  elementor/    HeaderApp, ContainerHandler (editor), init
  header/       Header, Plugin (base), Sticky, HeightObserver, config/options/events resolvers
  constants/    defaultConfig, defaultHeaderOptions, EVENTS
  interfaces/   I*-prefixed, one per file      types/  T*-prefixed, one per file
  utils.ts      vendored @arts/utilities subset
src/styles/     Sass: index + _sticky, _interaction, _logo-interaction
playground/     Vite harness: single configurable page + shared fixtures/lenis
```

## Two-layer configuration (deepmerge over defaults)

- **Options** (`IHeaderOptions` → `IResolvedHeaderOptions`, via `resolveHeaderOptions`) = *behaviour*:
  `mode`, `sticky.{enabled,trigger,toggleReveal,revealMode,revealOffset,until,toggleAttributes}`,
  `heightObserver.{enabled,observe,cleanupOnDestroy}`. Defaults: `defaultHeaderOptions`.
- **Config** (`IConfig` → `IResolvedConfig`, via `resolveConfig`) = *wiring*: the `classes`, `vars`,
  `selectors` strings the engine reads/writes. Defaults: `defaultConfig`. An **empty class string
  disables that state class**.

Inline `data-arts-header-options` JSON on the container **overrides** constructor options.

## Events (CustomEvents on `document`)

`EVENTS` (`constants/events.ts`); payload `IHeaderEventDetail { value: boolean; header: HTMLElement }`.
Subscribe via `onHeaderEvent` / `offHeaderEvent` or plain `document.addEventListener`.

- `arts/header/sticky` — stuck state changed
- `arts/header/hidden` — full-hide toggled (zone or `toggleHidden`)
- `arts/header/locked` — reveal frozen (zone or `lockSticky`)
- `arts/header/displaced` — whether the bar currently vacates its space

## Frozen identifiers

- **State classes** (defaults, on `.arts-header`): `arts-header_sticky`, `_revealing`,
  `_scrolling-down`, `_hidden`, `_locked`, `_released`, `_reveal-scrub`; plus `has-header-height` on
  `<html>`.
- **CSS vars written by the engine**: `--arts-header-height`, `--arts-header-height-non-sticky`,
  `--arts-header-release-top`. Styling-side vars (`--arts-header-top`, `--arts-header-*-spacing-*`) live
  in Sass.
- **Selectors**: container `.js-arts-header`, bar `.js-arts-header__bar`.
- **Data attributes**: `data-arts-header-options` (JSON); `data-arts-header-hide-over` /
  `-lock-over` (zones, value `at-top|overlap|in-view`); `data-arts-header-logo` / `-non-sticky-logo` /
  `-sticky-logo`.
- **Editor panel setting keys** read by `ContainerHandler`: `arts_header_enabled`,
  `arts_header_sticky_enabled`, `arts_header_sticky_toggle_reveal_enabled`,
  `arts_header_state_{non_sticky,sticky}_logo_version`.
- **Globals**: `window.artsHeaderForElementor` (the `HeaderApp`), `window.artsHeaderOptions.isElementorEditor`.

## Gotchas / invariants

- **Config strings are hand-synced with Sass.** `defaultConfig.ts` class/var names are duplicated as
  literals in `src/styles/*.sass` — no shared source of truth. Rename in both places or the CSS
  silently stops matching (the file says so at the top).
- **The wrapper positions in every mode; the bar's modifier class only *signals* the mode**
  (`__bar_sticky`→flow/native sticky, `__bar_fixed`/`__bar_absolute`→overlay, plus a `_hero-bottom`
  variant). The reveal transform always rides the wrapper, so the engine stays mode-agnostic.
- **Auto-hide reveal is CSS-owned; scrub reveal is JS-owned — but scrub hands the transform back to
  CSS while locked or hidden** (`syncScrubOwnership`): the frame writes are gated in those states, so
  `arts-header_reveal-scrub` drops (re-enabling the CSS transition, same slide as auto-hide) and the
  inline `translateY` clears; JS reclaims on release. Otherwise scrub writes the transform each frame
  and the `_reveal-scrub` class keeps CSS transitions off so they don't fight the writes.
- **Scrub defers the published sticky state through the natural departure.** The sentinel crossing
  sets internal `stuck` only; `arts-header_sticky`, the STICKY event, and `isSticking` publish once
  the bar fully departs (a bar height of scroll) or visibly pins (revealOffset gating, deep-scroll
  boot), and unpublish at the sentinel re-entry — so the initial scroll-away looks like plain
  in-flow scrolling, v1-style. Auto-hide publishes at the crossing as before.
- **Missing container/bar never throws** — it is logged and `init()` no-ops, so a half-rendered page
  (editor mid-edit) degrades silently.
- **`destroy(revert=false)` keeps the current visual state** (for AJAX page transitions swapping the
  page under a persistent header); `revert=true` restores mutated DOM and fires the state events.
- **HTMLElement checks are realm-safe** (`isHTMLElement` tests `nodeType===1`, not `instanceof`)
  because the Elementor editor preview is a separate-realm iframe.
- **Non-sticky height is seeded from a pre-paint inline CSS var** and never overwritten with 0, so a
  scroll-restored load that boots already-sticky keeps the correct rest height.

## Dependencies

Runtime: **none** — the engine is self-contained. Dev only (see `package.json`): `vite`, `esbuild`,
`sass`, `typescript`, `@biomejs/biome`, `@artemsemkin/elementor-types`, `@types/node`, `archiver`,
`chokidar`, `lenis` (`lenis` powers the playground only).
