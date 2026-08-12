# header-for-elementor

Zero-runtime-dependency sticky/reveal header **engine** for Elementor, in TypeScript + SCSS, shipped
as a standalone WordPress plugin. The engine watches scroll and layout and toggles state **classes**
and CSS **custom properties** on a header wrapper; the visible show/hide/shrink animation is done in
CSS, not per-frame JS. The PHP layer decorates an Elementor **Container** into that header.

Package: `@arts/header` (private, ESM). Consumer entry: `src/ts/index.ts`, also the `@engine` alias.
Composer: `arts/header-for-elementor`, PSR-4 `Arts\HeaderForElementor\` → `src/php/` — deliberately
NOT `Arts\Header`: the predecessor framework package still loads under that namespace via
velum-core, and both may coexist in one process. Zero runtime composer deps; `composer.json` is the
single version source (the build stamps the plugin header, readme.txt, and package.json from it).

## Status / scope

Feature-complete against the predecessor package: frontend engine, PHP layer (bootstrap,
`Elementor/{Assets,Markup,Controls,Backend,DualLogoWidget,MediaPreviewOnlyControl}`), build
runner, and Velum integration (TGM optional entry, `@arts/header` links repointed, `IHeaderApp`
type, `arts/header` removed from velum-core's composer — all landed in the Velum monorepo).
Still outstanding: CI workflows (`test.yml`/`release.yml` per the siblings' pattern) and the
WP.org submission story — the plugin is headed for the WordPress.org directory, which is also why
Velum's TGM entry is slug-only. The only intended consumer is the WIP Velum theme; there are no
BC constraints. Explicitly deferred: a reveal-mode panel select (off/auto-hide/scrub) — no Velum
demand; hand-authored `data-arts-header-options` covers exotic cases.

## Commands

- `pnpm dev` — Vite dev server for `playground/`, the visual harness (single configurable page).
- `pnpm dev:plugin` — build runner watch mode: esbuild `boot.ts` (IIFE) + sass into
  `src/php/libraries/header-for-elementor/` and, when a gitignored `.env` sets `DEV_TARGET`,
  mirror the plugin file-by-file into a Local WP site's plugins dir. **Gotcha: git
  checkout/merge can race the mirror** — git's transient unlink of a file can be mirrored as a
  deletion while the re-add is missed, silently breaking the target plugin (the main .php file
  vanishing deactivates it functionally). Restart `dev:plugin` after branch switches/merges; the
  initial mirror restores everything.
- `pnpm build` — staged release + `dist/header-for-elementor.zip` (assertRelease hard-fails on
  leaked sourcemaps/composer.lock, missing files, or version drift).
- `composer phpstan` — PHPStan level max over `src/php` (WordPress + Elementor stubs;
  `phpstan-bootstrap.php` defines the plugin constants for analysis).
- `pnpm test` / `test:watch` / `test:coverage` — Vitest over `tests/**/*.test.ts` (istanbul
  coverage — fallow reads istanbul-format `coverage-final.json` only).
- `pnpm typecheck` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`).
- `pnpm lint` — `biome check .`; `pnpm format` — `biome format --write .`.
- `pnpm knip` / `pnpm fallow` — paired static analyzers (unused files/exports/deps; fallow adds
  circular-dependency + health passes). `pnpm fallow:health` regenerates coverage first so CRAP
  scores are real rather than `static_estimated`.

Biome is linter + formatter: single quotes, no semicolons, 2-space indent, width 100; `noExplicitAny`
is off under `src/ts/**`. SCSS is not linted by anything.

## Architecture

Factory/closure style throughout — no classes except where Elementor forces one pattern (see
elementor/). `core/createHeader.ts` is the **composition root**; every module is a `createX(args)`
factory returning a small interface, communicating via callback arguments and one internal typed
emitter. Pure decision functions are exported at module scope as the **unit-test surface** — a
module export is internal by convention; the public API is whatever `src/ts/index.ts` re-exports.

Two entry points, one core:

- `src/ts/boot.ts` — the **WordPress/Elementor bundle** entry (side-effectful): boots one global
  app via `createHeaderApp` onto `window.artsHeaderForElementor`.
- `src/ts/index.ts` — the **library** surface: pure re-exports, no side effects. Playground and
  monorepo consumers use this (via `@engine`).

Runtime wiring (`createHeader.init()`):

- `sticky/createSticky.ts` — the orchestrator. Owns the closure state (stuck vs published sticking,
  deferral bookkeeping, scrub accumulator) and one `createStateFlag` per published boolean
  (memoized class toggle; `''` in config opts a class out). Sub-modules report one-way into it:
  - `stickDetection` — injected 1px sentinel (or custom `trigger`) + IntersectionObserver at the
    sticky line; dedups edges internally.
  - `scrollTracker` — the single passive scroll listener + rAF coalescer; clamps against **cached**
    document bounds (refreshed on update + settled resize — never a layout read on the tick path).
  - `revealAutoHide` / `revealScrub` / `deferredPublish` — pure deciders for the two reveal modes
    and the scrub-mode deferred sticky publishing.
  - `untilRelease` — second sentinel at the `until` boundary; owns the release-anchor CSS var.
  - `zones` — per-zone IntersectionObservers from the hide-over/lock-over data attrs + a body-wide
    MutationObserver whose rescans are rAF-coalesced.
- `heightObserver/createHeightObserver.ts` — publishes live + settled rest bar heights as CSS vars
  (border-box ResizeObserver). Told about sticky state via a live `isSticking` predicate and the
  sticky `change` emitter signal — it never reads state back from the DOM.
- `elementor/` — `createHeaderApp` (app lifecycle; concurrent `init()`/`destroy()` calls await the
  same in-flight promise), `mapPanelSettings` (pure panel→options mapping), `containerHandler`
  (editor-only; **must** stay an `elementorModules.frontend.handlers.Base.extend({...})` object
  literal — Elementor's one forced non-factory pattern), `init` (editor/frontend boot split).
- `events/headerEvents.ts` — the public document CustomEvent helpers; `core/emitter.ts` is the
  separate internal wiring channel.

## Layout

```
src/ts/
  boot.ts         WP bundle entry (side-effectful)   index.ts   public library surface (@engine)
  core/           createHeader (composition root), emitter
  events/         headerEvents (public document CustomEvents)
  options/        headerOptions (per-section resolvers), config, sanitize, inlineOptions
  sticky/         createSticky + measure, scrollBounds, scrollTracker, sentinel, resolveElement,
                  stickDetection, deferredPublish, revealAutoHide, revealScrub, untilRelease,
                  zones, toggleAttributes, publish
  heightObserver/ createHeightObserver
  elementor/      createHeaderApp, mapPanelSettings, containerHandler, init
  constants/      defaultConfig, defaultHeaderOptions, dataAttrs, dom, tuning, events
  interfaces/     I*-prefixed, one per file   types/  T*-prefixed, one per file
  utils/          vendored @arts/utilities subset, one function per file + readTransitionDuration
src/styles/       SCSS in the `arts-header` cascade layer: index + _tokens (contract file),
                  _modes, _reveal, _logo, _interaction
src/php/          Plugin (singleton bootstrap, did_action('elementor/loaded') race guard) +
                  Elementor/{Assets (enqueue + editor-flag inline JSON), Markup (wrapper, bar
                  attrs, logo attrs, options JSON, pre-paint height script), Controls (panel
                  section + state tabs + sticky style sections + fluid presets + padding
                  transition), Backend (secondary-logo Customizer control + bidirectional
                  theme_mod⇄kit sync), DualLogoWidget, MediaPreviewOnlyControl};
                  libraries/ holds the built bundles (gitignored)
src/wordpress-plugin/  the shipped main file + readme.txt (headers stamped from composer.json)
build/            runner (node build/index.js dev|build), ported from cursor-follower —
                  config/js/sass/sync/meta/package modules, assertRelease gate
playground/       Vite harness: single configurable page + shared fixtures/lenis
tests/            mirrors src/ts; support.ts fixture factories; aliasBoundary + styleSync +
                  phpSync guards
```

Interfaces/types/constants: one declaration per file with `index.ts` barrels; consumer modules
import through the barrels, but **declaration files import each other directly** (routing through a
barrel would close a types↔interfaces cycle).

## Two-layer configuration

- **Options** (`IHeaderOptions` → `IResolvedHeaderOptions`, via `resolveHeaderOptions`) =
  *behavior*. `X | false` idiom: `sticky: IStickyOptions | false` with
  `{ trigger, reveal: IRevealOptions | false, until, toggleAttributes: TToggleAttributes | false }`,
  `heightObserver: IHeightObserverOptions | false`. One pure resolver per section
  (`options/headerOptions.ts`) states each default exactly once and always builds fresh objects —
  resolved options are never aliased to the defaults (`constants/defaultHeaderOptions.ts`).
  `toggleAttributes` replaces **wholesale**, never key-merges.
- **Config** (`IConfig` → `IResolvedConfig`, via `resolveConfig`) = *wiring*: the `classes`, `vars`,
  `selectors` strings the engine reads/writes, deepmerged over `defaultConfig`. An **empty class
  string disables that state class**; same opt-out for vars.

Inline `data-arts-header-options` JSON on the container **replaces** constructor options when
present. It is sanitized field-by-field (`options/sanitize.ts` — wrong-typed fields drop so
resolver defaults win); an attribute that is present but unparseable **warns and is ignored**
(constructor options survive), unlike absence, which is silent.

## Events (CustomEvents on `document`)

`EVENTS` (`constants/events.ts`); payload `IHeaderEventDetail { value: boolean; header: HTMLElement }`.
Subscribe via `onHeaderEvent` / `offHeaderEvent` or plain `document.addEventListener`.

- `arts/header/sticky` — published sticky state changed
- `arts/header/hidden` — full-hide toggled (zone or `toggleHidden`)
- `arts/header/locked` — reveal frozen (zone or `lockSticky`)
- `arts/header/released` — sticky-until release toggled
- `arts/header/displaced` — whether the bar currently vacates its space

The five real states also have getters (`isSticking/isHidden/isLocked/isReleased/isDisplaced`);
`revealing`/`scrollingDown` are deliberately class-only styling signals (per-tick frequency).

## Identifier contract

Hand-synced between TS, SCSS, **and PHP** — no shared source of truth across the languages.
**`tests/styleSync.test.ts`** guards TS↔SCSS: every engine-styled class/var in `defaultConfig`
must appear in the styles source and every `arts-header_*` state class in the styles must be
config-backed (allowlist: `arts-header_hero-bottom`, authored by markup, and the consumer-only
`revealing`/`has-header-height`). **`tests/phpSync.test.ts`** guards TS↔PHP: the wrapper/bar
classes, options attribute, height vars, and panel keys printed by `src/php/Elementor/*` must
match the TS constants. `Markup::map_panel_settings()` is the PHP mirror of `mapPanelSettings.ts`
— the editor writes the TS version of the options JSON, the frontend writes the PHP one, and both
must serialize identically (`reveal => (object) array()` keeps `{}` from collapsing to `[]`).

- **State classes** (defaults, on `.arts-header`): `arts-header_sticky`, `_revealing`,
  `_scrolling-down`, `_hidden`, `_locked`, `_released`, `_reveal-scrub`; plus `has-header-height`
  on `<html>`.
- **CSS vars written by the engine** (all in `defaultConfig.vars`): `--arts-header-height`,
  `--arts-header-height-non-sticky`, `--arts-header-release-top`. Styling-side vars
  (`--arts-header-top`, `--arts-header-*-spacing-*`, `--spacing-transition`) live in SCSS only.
- **Selectors**: container `.js-arts-header`, bar `.js-arts-header__bar` (JS hooks, invisible to
  CSS by design — the styled twins are `.arts-header`/`.arts-header__bar`).
- **Data attributes** (`constants/dataAttrs.ts`): `data-arts-header-options` (JSON);
  `data-arts-header-hide-over` / `-lock-over` (zones, value `at-top|overlap|in-view`);
  `data-arts-header-non-sticky-logo` / `-sticky-logo` (editor-written, CSS-read logo versions).
- **Structural classes** (`constants/dom.ts`): sentinel + wrapper/bar classes + the editor's
  `arts-header_elementor-element-<id>` prefix.
- **Editor panel setting keys** read by `containerHandler`: `arts_header_enabled`,
  `arts_header_sticky_enabled`, `arts_header_sticky_toggle_reveal_enabled`,
  `arts_header_state_{non_sticky,sticky}_logo_version`. PHP-only keys (Elementor-CSS-read, not
  editor-JS-read): `arts_header_state_{non_sticky,sticky}_spacing_{horizontal,vertical}` sliders
  writing the state-infixed spacing vars, plus the sticky style sections
  (`background_sticky*`, `background_overlay_sticky*`, `border_sticky*`, `box_shadow_sticky`)
  scoped via `Controls::HEADER_STICKY_BAR_SELECTOR` (sticky AND not scrolling-down).
- **Globals**: `window.artsHeaderForElementor` (the `IHeaderApp`),
  `window.artsHeaderOptions.isElementorEditor`.
- **Widget**: `arts-header-dual-site-logo` (name frozen — old Velum layouts reference it);
  secondary logo lives in the `arts_header_custom_logo_secondary` theme mod, two-way synced with
  the kit's `site_secondary_logo` (`Elementor/Backend.php`).

## Gotchas / invariants

- **Library-surface modules must not lean on `global.d.ts`** — Velum's monorepo tsc compiles this
  source through the `@arts/header` link, and ambient Window augmentations don't travel with the
  module graph. Any module reachable from `src/ts/index.ts` types its `window` reaches with a
  local structural interface (`elementorEditorLoaded.ts`, `containerHandler.ts` are the pattern);
  bundle-only modules (`boot.ts`, `elementor/init.ts`) may keep using the ambient types.

- **The wrapper positions in every mode; the bar's modifier class only *signals* the mode**
  (`__bar_sticky`→flow/native sticky, `__bar_fixed`/`__bar_absolute`→overlay, plus the
  `_hero-bottom` variant). The reveal transform always rides the wrapper, so the engine stays
  mode-agnostic — there is no `mode` option (dropped: it was never read).
- **All engine styles live in the `arts-header` cascade layer** — any unlayered theme CSS wins by
  default. `playground/shared/playground.scss` stays unlayered on purpose: it simulates a real
  theme and proves the override contract.
- **Auto-hide reveal is CSS-owned; scrub reveal is JS-owned — but scrub hands the transform back to
  CSS while locked or hidden** (`syncScrubOwnership` in `createSticky`): the frame writes are gated
  in those states, so `_reveal-scrub` drops (re-enabling the CSS transition) and the inline
  `translateY` clears; JS reclaims at the parked offset on release, visually seamless.
- **Scrub defers the published sticky state through the natural departure.** The sentinel crossing
  sets internal `stuck` only; the class/event/getter publish once the bar fully departs (a bar
  height of scrub travel) or visibly pins (`shouldPublishDeferredStick`: accumulator lagging the
  scroll since the crossing by > `PENDING_STICK_TOLERANCE_PX`), and unpublish at the sentinel
  re-entry. Auto-hide publishes at the crossing.
- **Publish order is class → side effects (attribute swap, internal `change` emit) → document
  event** — consumers reading the DOM inside an event listener see the settled state. State flags
  memoize; events only fire on genuine transitions.
- **`destroy(revert=false)` keeps the current visual state** (AJAX page transitions swapping the
  page under a persistent header) — flags `reset()` their values without touching classes;
  `revert=true` restores mutated DOM and fires the state events. Both paths clear the scrub inline
  transform, the scrub class, and the release anchor — cleared AFTER the revert resets so a
  re-synced scrub ownership can't leave the class behind.
- **Missing container/bar never throws** — logged, `init()` no-ops, half-rendered pages degrade
  silently. Same for a configured `trigger`/`until` selector that matches nothing (warned).
- **IntersectionObserver callbacks read `entries.at(-1)`** — batched deliveries are chronological
  and only the last entry reflects current state.
- **HTMLElement checks are realm-safe** (`isHTMLElement` tests `nodeType===1`, not `instanceof`)
  because the Elementor editor preview is a separate-realm iframe. Tests exploit this: plain object
  literals are legitimate elements/entries everywhere.
- **Non-sticky height is seeded from a pre-paint inline CSS var** and never overwritten with 0, so
  a scroll-restored load that boots already-sticky keeps the correct rest height.

## Testing conventions

Root `tests/` mirrors `src/ts` (not colocated). Tests import the engine through the TEST-ONLY
`@ts/*` alias — `tests/aliasBoundary.test.ts` fails the suite if it ever leaks into `src/ts`
(consumers compile the source with their own configs). Two tiers, environment per FILE: `x.test.ts`
holds pure deciders under the `node` default (an accidental `document` reach fails loudly);
`x.dom.test.ts` opts into happy-dom via a `// @vitest-environment happy-dom` docblock (jsdom is not
an option: no matchMedia/RO/IO). Explicit `import { … } from 'vitest'` — no globals. No mocking
library: plain-object fakes plus the `tests/support.ts` factories (observer-constructor stubs with
`instances[i].callback(...)` driving, `fakeRaf().step()`, `makeHeaderFixture`, `setScroll`,
`setScrollBounds`). `unstubGlobals: true` reverts stubs between tests. Instances that register
window listeners (createSticky/createHeader rigs) must be destroyed in `afterEach` or the previous
test keeps ticking. No coverage thresholds — the visible behavior lives in the CSS state machine
and real layout the playground exercises.

## Decided — don't reintroduce or "fix"

- **No live option patching** (`applyOptionPatch`-style): the editor destroys and recreates the
  instance per panel change; no live-patch call path exists. Options are constructor-only.
- **No shared state-snapshot object / derive-everything pass**: deferred stick publishing depends
  on scroll travelled *since* the crossing — inherently edge-triggered, not derivable from a
  snapshot. Closure state in `createSticky` + pure deciders is the design.
- **`options.mode` dropped**: it was typed, defaulted, documented — and never read. Docking mode is
  a markup/CSS concern (bar modifier class + `:has()`).
- **`data-arts-header-logo` + the default `toggleAttributes` wiring dropped**: the attribute had
  zero readers (CSS keys off the two static version attrs + `_sticky`), and the value semantics
  were incoherent. `toggleAttributes` defaults to `false`; the generic mechanism stays for
  consumers' own attributes.
- **`deepmerge` stays for config only**: flat optional strings fit it (handed a fresh copy of the
  defaults per call — it only spreads the top level, and aliasing the nested defaults was a real
  bug). The `X | false` options shape uses per-section resolvers instead.
- **fallow's "split `core/createHeader.ts`" recommendation: rejected.** It is the composition root;
  112 LOC of wiring in one place is the point. fallow will keep suggesting it on fan-in.
- **`archiver`/`chokidar`/`esbuild` look unused**: staged for the not-yet-created `build/` runner —
  in both analyzers' `ignoreDependencies`, don't delete.

## Dependencies

Runtime: **none** — the engine is self-contained (`utils/` is a vendored `@arts/utilities` subset;
`Resize` stays a class there on purpose, signature-matching the original). Dev only: `vite`,
`esbuild`, `sass`, `typescript`, `@biomejs/biome`, `vitest` + `@vitest/coverage-istanbul` +
`happy-dom`, `knip`, `fallow`, `@artemsemkin/elementor-types`, `@types/node`, `archiver`,
`chokidar`, `lenis` (`lenis` powers the playground only).
