# header-engine-for-elementor

Zero-runtime-dependency sticky/reveal header **engine** for Elementor, in TypeScript + SCSS, shipped
as a standalone WordPress plugin. The engine watches scroll and layout and toggles state **classes**
and CSS **custom properties** on a header wrapper; the visible show/hide/shrink animation is done in
CSS, not per-frame JS. The PHP layer decorates an Elementor **Container** into that header.

Package: `@arts/header` (private, ESM). Consumer entry: `src/ts/index.ts`, also the `@engine` alias.
Composer: `arts/header-engine-for-elementor`, PSR-4 `Arts\HeaderForElementor\` → `src/php/` — deliberately
NOT `Arts\Header`, which belongs to the separate `arts/header` framework package; the two must stay
distinct in case both ever load in one process. Zero runtime composer deps; `composer.json` is the
single version source (the build stamps the plugin header, readme.txt, and package.json from it).

## Status / scope

Build and CI run on the shared tooling; `release.yml` deploys to the wp.org SVN repo on release.
The Live Preview blueprint ships: `dev/seed/demo-page.php` → `arts-wp blueprint build` → committed
`.wordpress-org/blueprints/blueprint.json`, gated by CI `blueprint_check`.

Published on wp.org since 1.0.0, so everything a saved Elementor layout references is now a
compatibility boundary: panel control ids, the widget name, the wrapper/bar classes, and the
options JSON `Markup.php` emits. The TS **library** surface is not — its only consumer is one
unreleased in-house theme, so don't add shims for old option or config shapes there.

**Names.** The display name is `Artem Semkin Header Engine for Elementor`, the slug
`artem-semkin-header-engine-for-elementor` — the slug is frozen, the display name is not. The
GitHub repo and this directory stay `header-engine-for-elementor` (the repo-scoped CI runner and
the live `Plugin URI` landing page key off it), so the repo dir deliberately differs from the slug.
`DEV_TARGET`'s leaf does NOT: the mirrored folder must BE the slug, because TGM matches an
installed plugin by FOLDER NAME against its config slug — an old-named folder reads as "not
installed" and TGM offers a duplicate from wp.org instead.

Panel-less by choice: `sticky.trigger`/`until`, the hero-bottom mode, and `toggleAttributes` — and note
hand-authored `data-arts-header-options` is NOT reachable on Elementor pages (Markup.php owns the
attribute; Elementor custom attributes land on the bar, which the engine doesn't read options
from).

## Commands

Build/release is the shared `arts-wp` CLI (`@arts/wp-plugin-tooling`); `project.config.js` is this
repo's entire build config. There is no local `build/` directory.

- `pnpm dev` — Vite dev server for `playground/`, the visual harness.
- `pnpm dev:plugin` — watch mode: esbuild `boot.ts` (IIFE) + sass into
  `src/php/libraries/artem-semkin-header-engine-for-elementor/`, then mirror the plugin file-by-file into the Local WP
  site named by `DEV_TARGET` in a gitignored `.env`. **Gotcha: git checkout/merge races the
  mirror** — a transient unlink can mirror as a deletion with the re-add missed, silently breaking
  the target (a vanished main .php file deactivates it). Restart after branch switches.
- `pnpm build` — staged release + `dist/*.zip` (assertRelease hard-fails on leaked
  sourcemaps/composer.lock, missing files, version drift, or a zip over `zip.budgetMb`).
- `pnpm build:library` — ESM/CSS + declarations in `dist/esm` and `dist/types`, without WordPress mirror writes. Default package imports use this output; editable source selects `arts-source` in the bundler and TypeScript. `/styles.scss` and `/styles.css` are explicit to avoid Sass package-import ambiguity.
- `pnpm release <patch|minor|major|x.y.z>` — bump, stamp, validate changelog, commit, tag.
- `pnpm test` / `test:coverage` — Vitest over `tests/**/*.test.ts`; coverage lands as
  istanbul-format `coverage-final.json`, which `fallow --coverage` reads.
- `composer phpstan` — level max over `src/php` (`phpstan-bootstrap.php` defines the plugin
  constants for analysis); `vendor/bin/phpcs` / `phpcbf` — the `ArtsFramework` ruleset.
- `pnpm exec arts-wp blueprint build` / `check` — regenerate / verify the committed Live Preview
  blueprint after ANY `dev/seed/demo-page.php` change (the seed is inlined verbatim; `check` is
  the CI staleness gate). Local preview: `npx @wp-playground/cli server --blueprint=<copy with an
  activatePlugin step> --mount=./dist/artem-semkin-header-engine-for-elementor:/wordpress/wp-content/plugins/…`
  (the committed blueprint provisions Elementor + a theme but never installs THIS plugin — wp.org
  injects it).
- `pnpm exec` for the rest: `tsc --noEmit` (strict, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), `biome check`, `stylelint 'src/styles/**/*.scss'`, `knip`,
  `fallow` (run `test:coverage` first so CRAP scores are real, not `static_estimated`).

`lefthook.yml`: **pre-commit** rewrites staged files (biome → stylelint → phpcbf, sequential — each
reads the previous one's output) then typechecks; **pre-push** runs vitest + phpstan + phpcs.
Advisory — `LEFTHOOK=0` skips them; CI is authoritative.

Biome is linter + formatter: single quotes, no semicolons, 2-space indent, width 100; `noExplicitAny`
off under `src/ts/**`. SCSS is linted by stylelint (`@arts/wp-plugin-tooling/stylelint`).

## Architecture

Factory/closure style throughout — `utils/Resize` is the only class (vendored, kept in the
original's shape), and Elementor forces exactly one non-factory pattern: the `Base.extend({...})`
object literal in `elementor/`. ONE deliberate module-scope singleton:
`sticky/subscribeScroll.ts`, the refcounted page-level scroll bus (per realm — the editor preview
iframe gets its own).
`core/createHeader.ts` is the **composition root**; every module is a `createX(args)` factory
returning a small interface, wired by plain callbacks. Pure decision functions are exported at
module scope as the **unit-test surface** — a module export is internal by convention; the public
API is whatever `src/ts/index.ts` re-exports. `boot.ts` is the side-effectful bundle entry (boots
one global app onto `window.artsHeaderForElementor`); `index.ts` is the pure library surface, used
via `@engine`.

**Detection is observer-free**: the engine owns ZERO IntersectionObservers and injects no DOM.
Everything derives from cached geometry evaluated by pure deciders on the scroll tick — measure
passes (layout-forcing, `sticky/measure.ts`) cache the bar height, rest height, pin line, natural
position, reveal offset, viewport height, release boundary, and zone rects; the tick only does
arithmetic.
Measure passes re-run on settled bar resizes (RO), window resizes, and settled height-var changes
— the heightObserver (the vars' one writer) signals `onHeightVarsSettled`, which `createHeader`
routes into its own sticky pass and `createHeaderApp` fans out to the OTHER instances, so a
Header-Height-chained offset re-resolves when the primary's correction lands with no instance
observing `<html>`. Settled document growth (RO on `<html>`) refreshes the cached scroll bounds
only, not the full measure pass.

Runtime wiring (`createHeader.init()`) — `sticky/createSticky.ts` orchestrates, owning
`stuck`/`displaced`/`destroyed`, the cached measurements, and one `createStateFlag` per published
boolean (memoized class toggle; `''` in config opts a class out). `evaluate(y)` runs at boot
(synchronous — a scroll-restored load publishes at construction), on every tick, and at the end of
each measure pass. Tick deciders and sub-modules:

- `pinned` — `resolvePinned(pin, naturalTop, pinnedHeight, y, viewportH)`: top edge pins once the
  natural position scrolls past the pin line (1px slack); bottom edge while the natural position
  sits below the viewport slot. Degenerate pin lines (beyond the viewport — a var-chained offset
  against the uncorrected pre-paint seed) resolve un-pinned. `measureNaturalTop` returns null when
  the wrapper's own rect is ambiguous (pinned sticky, out-of-flow modes) — the caller keeps the
  previous value, seeded by `estimateNaturalTop` (prev-sibling bottom / parent top).
- `subscribeScroll` — the SHARED page-level scroll bus (the one module-scope singleton): one
  passive scroll listener captures raw y; the `coalesceToFrame` rAF tick clamps that event sample
  against current cached bounds and fans the identical `(y, delta)` to every instance, without
  viewport reads. A smooth-scroll producer writing later in the frame is observed at its next
  scroll event (up to one frame later); the standalone header does not join its ticker. Boot and
  settled measurements keep the fresh `readY()` API. There is one settled
  window-resize signal (fans out `onSettledResize` → each instance's full measure pass), one
  document-growth RO (bounds refresh ONLY). Refcounted: last unsubscribe detaches everything;
  every subscribe refreshes bounds so a late-booted secondary never clamps stale.
- `revealAutoHide` — the pure decider for the hide/reveal direction classes.
- `release` — cached `until`-boundary doc position; released ⇔ `y + pin + barHeight ≥ boundaryTop`.
  Owns the release-anchor CSS var, derived from the same evaluated y and written BEFORE the
  callback so consumers can resolve it without another viewport read.
- `zones` — doc-space zone rects cached at scan/refresh, per-tick pure geometry
  (`resolveZoneActive`: at-top / overlap / in-view; `at-top` is the header's pin line, not the
  viewport top — the admin-bar or Pin Top Offset a bar sticks under would otherwise activate the zone
  late and flash the sticky look in between; a bottom pin uses 0); a body-wide MutationObserver rAF-coalesces
  attribute-driven rescans; panel zones resolve kind/geometry from computed CSS vars at scan, so a
  breakpoint change takes effect on the settled resize's measure pass. Zones and header wrappers
  inside an `IGNORE_ATTR` subtree (`data-arts-header-ignore`, in `/contract`) are skipped by both
  scans: an AJAX integrator stamps the page it is replacing instead of naming the engine's markers.
  Trade-off (accepted): zone liveness is settle-based — a rect that
  changes mid-scroll lags until the next settled measure.
  The `hold` kind (panel zones only, no data attribute) is a lock zone that also publishes
  `arts-header_held`: `createSticky` ORs it into the zone lock (`anyLock || anyHold`), and the held
  class turns the sticky LOOK off while `_sticky` stays on, because `_sticky` also positions the
  bar in the fixed, hero-bottom and released modes. Every in-box sticky rule excludes it with a
  zero-specificity `:where(:not(.arts-header_held))` (the `HEADER_STICKY_*` selector constants in
  `Controls.php`, `_values.scss` padding, the sticky-logo block in `_logo.scss`), so the sticky
  rules keep their weight and the alt rules, registered later, still win; the non-sticky logo block
  matches `:is(:not(_sticky), _held)`. A held flip animates the bar like a stick flip, so
  `setHeld` re-fires `onStickingChange` while sticking and the height observer publishes the
  endpoint once. Its use case is a Horizontal Scroll pin: the HS runway advances the real document
  scroll, so without it the header would shrink and auto-hide mid-pin; the zone sits on the
  Container around the HS widget (a zone on the wrapper itself gets no HS range), Hold on desktop
  and None where HS is off.
  The `alt` kind (alternate look, published as `arts-header_alt`) is evaluated with the `center`
  mode (`resolveCenterActive`): active while the bar's center line — `getDecider()` from
  `createSticky`, `pin.offset + barHeight / 2` for a top pin, `viewportH − pin.offset − barHeight / 2`
  for a bottom pin, from cached measurements — lies inside the zone rect (`rect.top ≤ y + decider <
  rect.bottom`). It has no geometry select; a container can be a hide/lock zone and an alt zone at
  once (two tracked zones). Only the panel look var/marker and the presence-only
  `data-arts-header-alt-over` make alt zones: `readZoneMode` does not accept `center`. The decider
  never reads the DOM per tick; like `overlap`, it uses the pinned line even for an un-stuck flow
  bar.
  `sticky/horizontalScroll.ts` is the feature-detected adapter for the Horizontal Scroll plugin
  (`window.artsHorizontalScroll`, read through a local structural interface at call time — no
  import, no `global.d.ts`). At zone scan, any zone inside a `.js-arts-hs` section asks
  `getScrollRange(el, { point })` (`point` = the header wrapper's center x as a fraction of the
  section width, clamped to [0, 1]; one wrapper rect read per scan) and the returned scroll window
  becomes a synthetic doc-space rect (`top = onStageAtEngage ? sectionTop : start + decider`,
  `bottom = onStageAtRelease ? sectionBottom : end + decider`), so the tick stays arithmetic. Every
  zone inside a horizontal section is forced to `center` mode, hide and lock included. Scan-time
  band gate: if the decider line is outside the track's pinned band (`stageTop`/`stageHeight` — the
  Horizontal Scroll Pin Top Offset case) the panel zone is dropped; the runway's parent Container is
  what sits behind the header there, and marking that uses the ordinary rect path. A missing global,
  `contract < 1`, or a null range (stacked/unmeasured/not a panel) takes the ordinary rect path; the
  bubbling `arts-hs:layout` event on `document` schedules the existing rAF-coalesced rescan
  (removed in `destroy()`).

`heightObserver/` publishes the settled STICKY bar height, the settled rest height and the rest
clearance as CSS vars on `<html>` (border-box RO), told about
sticky state by an `isSticking` predicate + the `onStickingChange` callback `createHeader` wires —
it never reads back from the DOM, and the composition root measures the bar ONCE before any boot
write and hands it over (`initialHeight`, `update(height)`), so `init()` and `refresh()` stay a
single layout flush (the publisher's own rect read would land after the sticky engine's writes), and it signals settled var changes outward (`onHeightVarsSettled`,
one signal per settle — the rest capture arms before the live write on purpose). Publishing is
endpoint-only across the bar's OWN state transition: a sticky flip suppresses the RO-driven
captures for the bar's measured transition duration and publishes once, settled; a consumer
hugging the shrink transitions its own consuming property instead. There is NO live height: an
inherited var on `<html>` re-resolves every `var()` user on the page (a whole-document style recalc
per change, 85–130 ms at 4x CPU on a 2,700-element Velum page), so the engine publishes only state
endpoints that change when the layout really did (`--arts-header-height-sticky` once the bar has
stuck, the rest pair otherwise) and a consumer picks one by the wrapper's state class. Every write
goes through `setInlineVar`, which skips an unchanged value, so the pre-paint seed's re-run at an
AJAX header swap and a re-init on an unchanged header cost nothing (the seed script dedupes the
same way: `tests/ts/phpParity.test.ts` executes it). Heights are
rounded to whole px everywhere (sub-pixel RO jitter must not become a var write). RO-driven
writes land on the NEXT frame, never inside the delivery: a consumer turning the var into page
height resizes `<html>`, which the scroll bus and Lenis observe, and the browser reports the RO
loop error (#4).

`elementor/` holds `createHeaderApp` — **multi-instance**: a registry keyed by container,
one engine per `.js-arts-header` wrapper; `init()`/`destroy()` are aggregates (concurrent calls
await the same in-flight promise — the single-header consumer contract an AJAX page-transition
cycle calls is unchanged; `destroy()` empties the registry, so `instances` only ever reports live
ones, and a `destroy()` ordered into a scan's `callbackBefore` await drops that scan rather than
booting engines the teardown could not have seen), the editor upserts per
container, `app.artsHeader` is the PRIMARY (first wrapper in DOM order), `app.instances` is all
of them, `app.getInstance(el)` is the one owning `el` (`closest('.js-arts-header')` against the
registry — `undefined` outside a wrapper or after destroy; a re-scan replaces instances, so
consumers resolve at use time, never across an AJAX visit). The primary owns the page globals: `Markup.php` classifies by first-rendered element id —
secondaries get `"heightObserver":false` + `"sticky":{"zones":false}` in their options JSON, no
pre-paint seed (the seed query is element-scoped), and multi-header consumers filter events by
`detail.header`. Also here: `mapPanelSettings` (pure panel→options, `isPrimary`-aware), `init`
(editor/frontend boot split), and `containerHandler` — editor-only, and it **must** stay an
`elementorModules.frontend.handlers.Base.extend({...})` object literal, Elementor's one forced
non-factory pattern. `events/headerEvents.ts` is the public document CustomEvent surface.

## Layout

```
src/ts/            boot.ts + index.ts; core/ events/ options/ sticky/ heightObserver/ elementor/
                   constants/ interfaces/ types/ utils/ (mostly a vendored @arts/utilities subset)
src/styles/        the `arts-header` cascade layer: index + _tokens (contract file), _modes,
                   _reveal, _logo, _interaction
src/php/           Plugin (singleton bootstrap, did_action('elementor/loaded') race guard) +
                   Elementor/{Assets, Markup, Controls, Backend, DualLogoWidget,
                   MediaPreviewOnlyControl}; libraries/ holds the built bundles (gitignored)
src/wordpress-plugin/  the shipped main file + readme.txt (headers stamped from composer.json)
project.config.js  the arts-wp build config (slug, entries, paths, zip budget, blueprint, DEV_TARGET)
playground/        Vite harness: one configurable page + shared fixtures/lenis
dev/seed/          demo-page.php — the Live Preview demo page seeder (source of blueprint.json)
.wordpress-org/    listing assets + blueprints/blueprint.json (GENERATED — never hand-edit)
tests/ts/          mirrors src/ts; support.ts factories; aliasBoundary/styleSync/phpSync guards
```

Interfaces and types: one declaration per file; constants are grouped by topic. All three carry
`index.ts` barrels and consumer modules import through them — `TPinLine` is the deliberate
holdout, internal to the sticky measure path and kept out of the barrel entirely. **Declaration
files import each other directly** (routing through a barrel would close a types↔interfaces
cycle).

## Two-layer configuration

- **Options** (`IHeaderOptions` → `IResolvedHeaderOptions`, via `resolveHeaderOptions`) =
  *behavior*, on the `X | false` idiom: `sticky: IStickyOptions | false`
  (`{ trigger, reveal: boolean, until, toggleAttributes: TToggleAttributes | false, zones: boolean }`)
  and `heightObserver: IHeightObserverOptions | false`. One pure resolver per section
  (`options/headerOptions.ts`) states each default exactly once and always builds fresh objects —
  never aliased to `constants/defaultHeaderOptions.ts`. `toggleAttributes` replaces **wholesale**.
- **Config** (`IConfig` → `IResolvedConfig`, via `resolveConfig`) = *wiring*: the `classes`, `vars`,
  `selectors` strings the engine reads/writes, deepmerged over `defaultConfig`. An **empty class
  string disables that state class**; same opt-out for vars.

Inline `data-arts-header-options` JSON on the container **replaces** constructor options, sanitized
field-by-field (`options/sanitize.ts` — wrong-typed fields drop so resolver defaults win). Present
but unparseable **warns and is ignored** (constructor options survive); absent is silent.

## Events (CustomEvents on `document`)

`EVENTS` (`constants/events.ts`); payload `IHeaderEventDetail { value: boolean; header: HTMLElement }`.
Subscribe via `onHeaderEvent` / `offHeaderEvent` or plain `document.addEventListener`:
`arts/header/sticky` (published sticky state), `arts/header/hidden` (full-hide, zone or
`toggleHidden`), `arts/header/held` (a hold zone is active: locked, with the rest look instead of the sticky one),
`arts/header/locked` (bar revealed and held shown, reveal frozen — lock also
clears the direction/displaced state; the `lockSticky` API lock and the lock-over zone lock are
held apart in `createSticky` and published as their OR, so a zone flip never drops a consumer's
lock and an API unlock never releases an active zone), `arts/header/alt` (the bar's center line is
over an alternate-look zone; primary header only — a secondary runs `zones: false` and never
publishes it), `arts/header/released`
(sticky-until release), `arts/header/displaced` (bar vacates its space). The same seven have getters
(`isSticking/isHidden/isLocked/isHeld/isAlt/isReleased/isDisplaced`); `revealing`/`scrollingDown` are
deliberately class-only styling signals (per-tick frequency).

## Identifier contract

Hand-synced across TS, SCSS, and PHP — no shared source of truth. Two mechanical guards:
**`tests/ts/styleSync.test.ts`** (TS↔SCSS — every engine-styled class/var in `defaultConfig` appears
in the styles, and every `arts-header_*` state class there is config-backed; allowlist:
`arts-header_hero-bottom` from markup, consumer-only `revealing`/`has-header-height`) and
**`tests/ts/phpSync.test.ts`** (TS↔PHP — wrapper/bar classes, options attribute, height vars, panel
keys). `Markup::map_panel_settings()` mirrors `mapPanelSettings.ts`: the editor writes the TS
options JSON, the frontend the PHP one, and both must serialize identically. Watch the PHP side:
an empty `array()` encodes as `[]`, not `{}` — a section that can go empty needs an object cast.

- **State classes** on `.arts-header`: `arts-header_sticky`, `_revealing`, `_scrolling-down`,
  `_hidden`, `_locked`, `_held`, `_alt`, `_released`; plus `has-header-height` on `<html>`.
- **Engine-READ vars** (the arrows pointing the other way): `--arts-header-reveal-offset` — the
  panel/theme writes it (responsive px, `100vh`, `var(--arts-header-height-non-sticky)`), the
  stylesheet registers it as an inheriting `<length>` (`@property` in `_tokens.scss`) and the
  engine reads the RESOLVED px value at measure passes (boot + `update()`), never on ticks. It
  lives in the head stylesheet because a registration invalidates every element's style: in the
  first style pass it's free, while a JS `CSS.registerProperty` from the deferred bundle cost a
  whole-document recalc after first paint (measured on Velum). A JS registration of the SAME name
  still succeeds on top of `@property` (separate registries) and pays that recalc again, so
  `createSticky` registers from JS only for a custom var name (a duplicate throws, swallowed).
  Unregistered fallback parses a trailing-px token only. The zone vars (`--arts-header-zone`,
  `--arts-header-zone-geometry`, `--arts-header-zone-look`) are engine-READ at zone scan, each
  `@property` non-inheriting with no initial value (see Data attributes). And `--arts-header-top-pinned` — SCSS-derived, not panel-authored and not
  registered (it always resolves to a plain px token), read at the same measure passes as the pin
  line's admin-bar term; see the admin-bar note under Gotchas.
- **Engine-written vars** (`defaultConfig.vars`): `--arts-header-height-sticky` (on `<html>`, the
  settled stuck height, absent until the bar has stuck, so the pin-offset preset and the Fluid
  Design System preset carry a non-sticky fallback; no live height exists),
  `--arts-header-height-non-sticky` (on `<html>`),
  `--arts-header-clearance-non-sticky` (on
  `<html>`, captured with the rest height and never while sticking, seeded pre-paint with it: the
  lowest edge the bar's content reaches from the bar's top — `measureClearance` — counting visible
  `[data-arts-header-extent]` descendants the bar's box does not contain, a dropdown hanging out of
  a height-locked row; equal to the rest height when nothing is marked; a `visibility`-hidden
  marked element adds nothing, so a collapsed list is skipped without the engine knowing why —
  which also means an integrator must not hide a header ROOT with `visibility` while its rest
  geometry can be measured (the pre-paint seed re-run by an AJAX region swap, the settled
  capture): `checkVisibility` is document-relative, so marked rows that declare no `visibility`
  of their own inherit the hide and drop out, and a page-transition hide belongs on `opacity`; the
  marked elements are observed beside the bar, and every delivery re-arms the settled capture),
  `--arts-header-release-top` and
  `--arts-header-natural-height` (both header-scoped; natural-height = the wrapper's rest height,
  frozen while stuck — the flow modes consume it as a constant slot).
  SCSS-only styling vars: `--arts-header-top` (the DOCUMENT-space admin-bar allowance;
  `--arts-header-top-pinned` above is the viewport-pinned reading derived from it),
  `--spacing-transition`,
  `--arts-header-hide-direction` (reveal transform sign; the bottom dock and bottom-pinned flow
  set `1`). Per-state padding is NOT a var contract: the native Padding control is the rest
  state and `padding_sticky` overrides Elementor's own `--padding-*` custom properties (see
  Panel keys below).
- **Selectors**: `.js-arts-header` / `.js-arts-header__bar` — JS hooks, invisible to CSS by design;
  the styled twins are `.arts-header` / `.arts-header__bar`.
- **Data attributes** (`constants/dataAttrs.ts`): `data-arts-header-options` (JSON);
  `data-arts-header-extent` (any element inside the bar: its bottom edge counts toward the rest
  clearance var while it is `visibility`-visible; the consumer's markup writes it);
  `data-arts-header-hide-over` / `data-arts-header-lock-over` (hand-authored zones,
  `at-top|overlap|in-view`); panel zones are the "Header Zone" section on any NON-header
  Container — RESPONSIVE `arts_header_zone` (desktop `''` None; smaller breakpoints get
  `''` Inherit + explicit `none`, since Elementor emits no CSS for empty) +
  `arts_header_zone_geometry`. They write `--arts-header-zone` / `--arts-header-zone-geometry`
  through selectors (engine-READ, `@property` non-inheriting in `_tokens.scss`, no initial value),
  and a marker `data-arts-header-zone="<desktop kind>:<desktop geometry>"` (PHP + editor handler,
  rendered when ANY breakpoint is hide/lock/hold) tells the tracker which elements to resolve at scan
  time. The marker value is the fallback for a var Elementor hasn't written yet (generated CSS
  predating the responsive controls), so existing sites need no CSS regeneration;
  `data-arts-header-alt-over` (hand-authored alt zone, PRESENCE-only: the value is never parsed, the
  `center` rule is the only geometry); the alternate-look twin of the panel zone, an independent
  RESPONSIVE `arts_header_zone_look` select (`''` Default / `alt`; smaller breakpoints `''` Inherit +
  explicit `default`) writing `--arts-header-zone-look` (`ZONE_LOOK_VAR`) with its own marker
  `data-arts-header-zone-look="<desktop value>"` (`ZONE_LOOK_ATTR`, rendered when ANY breakpoint is
  `alt`, value = fallback for an unwritten var); the kind and look markers are independent, so a
  container may carry either or both;
  `data-arts-header-non-sticky-logo` / `data-arts-header-sticky-logo` /
  `data-arts-header-alt-logo` (written by the editor handler in the preview and by `Markup.php` on
  the frontend; CSS-read, never JS-read). The new attribute constants stay out of `/contract`.
- **Structural classes** (`constants/dom.ts`): wrapper/bar classes, the editor's
  `arts-header_elementor-element-<id>` prefix.
- **Panel keys** read by `containerHandler`: `arts_header_enabled`, `arts_header_position`
  (`''` Top / `flow` "Default" / `bottom` — the "Default"-labeled option is deliberately NOT the
  select's default value: saved overlay-top headers must not reflow), `arts_header_on_scroll`
  (`''` None / `sticky` / `auto-hide`, default `auto-hide`), `arts_header_stick_to`
  (`''` Top / `bottom`, flow-only),
  `arts_header_state_{non_sticky,sticky,alt}_logo_version`. CSS-write only (Elementor selectors, not
  editor-JS-read): `arts_header_pin_offset_preset` + responsive `arts_header_pin_offset` →
  `--arts-header-pin-offset`; `arts_header_sticky_reveal_offset_preset` (Custom/Viewport/Header Height) +
  `arts_header_sticky_reveal_offset` (responsive px slider) — both write `--arts-header-reveal-offset`.
  PHP-only (Elementor-CSS-read, not editor-JS-read): the sticky style sections
  (`background_sticky*`, `background_overlay_sticky*`, `border_sticky*`) and `padding_sticky`
  (Advanced → Layout, next to native Padding), ALL scoped via `HEADER_STICKY_STATE_BAR_SELECTOR` —
  `_sticky` ALONE ("pseudo sticky": in-box styles hold through the hide/reveal slide instead of
  flashing back to rest; a hiding/locked bar keeps them). The ONE exception is `box_shadow_sticky`
  on `Controls::HEADER_STICKY_BAR_SELECTOR` (sticky AND not scrolling-down): shadow paints outside
  the box and would bleed into the viewport while the bar sits hidden — phpSync pins this split.
  `padding_sticky` overrides the
  native padding control's `--padding-*` CUSTOM PROPERTIES (never padding longhands — Elementor
  applies vertical padding on `.e-con-full`/boxed `.e-con > .e-con-inner`, and only the inherited
  custom properties reach both); Elementor's dimensions quirk applies to both padding controls:
  a rule with any blank side emits nothing. Also PHP-only: `arts_header_sticky_global_colors`
  (repeater, fields `global_id` + `sticky_color`) — the sticky recolor: each row re-declares
  `--e-global-color-{{global_id.VALUE}}` on `HEADER_STICKY_STATE_BAR_SELECTOR`, the exact idiom the
  kit's own Global Colors panel uses, so every widget in the bar consuming that global re-colors
  with zero per-widget wiring (hardcoded colors unaffected; the override value can't itself be a
  global — cycle guard). Kit colors for the SELECT come from
  `kits_manager->get_active_kit_for_frontend()` at registration (guarded; empty options when no
  kit). A deleted kit color degrades silently: the row emits a var nobody consumes.
  `arts_header_alt_global_colors` (fields `global_id` + `alt_color`) is the same recolor for the
  alternate look, scoped via `HEADER_ALT_STATE_BAR_SELECTOR` (`_alt` alone, like sticky) and
  registered AFTER the sticky repeater so it wins at equal specificity; the `_logo.scss` alt block
  sits after the sticky one for the same reason. Alt zones, like all zones, need On Scroll
  Sticky or Sticky & Auto-Hide.
- **Globals**: `window.artsHeaderForElementor` (`IHeaderApp`),
  `window.artsHeaderOptions.isElementorEditor`.
- **Widget**: `arts-header-dual-site-logo` (name frozen — saved layouts reference it); secondary
  logo lives in the `arts_header_custom_logo_secondary` theme mod, two-way synced with the kit's
  `site_secondary_logo` (`Elementor/Backend.php`). Its section id `site_identity_section` is
  frozen too: Velum adds its On-Scroll Animation section after it through Elementor's
  `elementor/element/arts-header-dual-site-logo/site_identity_section/after_section_end`, and
  prints its entrance attributes on the outer `.elementor-widget` through Elementor's
  `_wrapper` render hook. Nothing here knows about Velum.

## Gotchas / invariants

- **Safari viewport lengths (Velum #290):** Elementor headers are `.arts-header-values` (`display: contents`) → `.arts-header` → native Container/bar. The host owns typed reveal/pin offsets, normal/sticky padding and gaps; `_values.scss` aliases computed inherited lengths into Elementor's native variables through an unlayered, header-only compatibility rule. Native control IDs and original selectors stay; extra host selectors use the same responsive/FDS pipeline, including Kit defaults. Empty sticky padding follows the normal token. Percentages stay percentages through `<length-percentage>`; em uses the host's inherited font context (custom bar-only typography is outside this layout adapter). The wrapper remains the state, geometry and event owner. `estimateNaturalTop` skips only the known host. WebKit caches viewport lengths on a boxless host when viewport size changes, so `createValueHostInvalidation` coalesces resize events into one host-local style invalidation per frame, with no layout reads or root-variable writes; init/refresh invalidate before measuring and destroy releases the listener/queued frame. Regenerate Elementor CSS after deploying these selector changes. The `/contract` exports `VALUE_HOST_JS_CLASS` for snapshot integrations: Canvas header scenery must clone the host while measuring/hiding the boxed wrapper.

- **Library-surface modules must not lean on `global.d.ts`** — a consumer that `link:`s this
  package compiles the source with its own tsc, and ambient Window augmentations don't travel with
  the module graph. Any module reachable from `src/ts/index.ts` types its `window` reaches with a
  local structural interface (`elementorEditorLoaded.ts`, `containerHandler.ts` are the pattern);
  bundle-only modules (`boot.ts`, `elementor/init.ts`) may keep using the ambient types.
- **The wrapper positions in every mode; the bar's modifier class only *signals* the mode**
  (`__bar_sticky`/`__bar_sticky-bottom`→flow pinned top/bottom, `__bar_fixed`/`__bar_absolute`→
  overlay, `__bar_bottom`→bottom dock). Hero-bottom is the exception: no bar modifier, its own
  `_hero-bottom` wrapper rules. The reveal transform always rides the wrapper, so the engine stays
  mode-agnostic — there is no `mode` option (dropped: it was never read). `Markup.php` emits all
  five modifiers from the panel: `arts_header_position` picks the family, On Scroll None emits no
  modifier for flow (static in-page bar) and `_absolute` over `_fixed` for Top (Bottom always
  emits `_bottom` — inherently fixed, None just disables the machinery), `arts_header_stick_to`
  picks the flow pin edge. **The pin line is read back from COMPUTED CSS** (`measurePinLine`:
  `position: sticky` → resolved top, or bottom when `top: auto`; anything else → the admin-bar
  offset), so custom `--arts-header-pin-offset` values — including negatives, the compact-header
  trick — keep stick detection exact with no configuration. Hero-bottom is the one CSS-only mode
  the panel cannot produce. Flow caveat: `position: sticky` pins only within its parent's box — a
  theme-builder header location wrapper is header-height tall, so flow can't pin there; the mode
  is for containers INSIDE tall page content (mid-page filter/submenu bars).
  The bottom dock hides DOWNWARD via the `--arts-header-hide-direction` sign token in the reveal
  rules; caveats: zone `overlap` geometry, the alt `center` decider and `until` release anchoring
  are top-bar semantics (`resolvePinLine` reads a `fixed` dock as a top-edge pin, so its decider
  sits near the top, at the admin-bar offset plus half the bar height) — bottom mode supports `at-top`/`in-view` zones and no `until`. And a fixed dock's natural
  position is ESTIMATED from its previous sibling (`estimateNaturalTop`), so a dock rendered
  after tall page content estimates near document-end and never resolves stuck — its auto-hide
  machinery stays inert. Render bottom docks before the tall content (the demo seed places its
  dock right after the primary header).
- **The admin bar is only viewport-pinned above 600px.** WordPress drops `#wpadminbar` to
  `position: absolute` at `max-width: 600px` — it scrolls away with the document — while
  `--wp-admin--admin-bar--height` (and the `<html>` margin-top bump) stay at 46px, so the height
  alone can't tell the two regimes apart. Hence the split: `--arts-header-top` is the DOCUMENT-space
  allowance (`_absolute`, and the un-stuck `_fixed` wrapper on phones), `--arts-header-top-pinned`
  the VIEWPORT-pinned one (flow sticky, stuck `_fixed`, stuck hero-bottom), zeroed in the one
  `@media screen and (width <= 600px)` block in `_modes.scss` — the only media query in the styles
  (stylelint mandates the range notation).
  `measureStickyTop` reads that var off the container, NOT `<html>` margin-top, so the pin line
  agrees with the CSS; because `topLine()` feeds auto-hide, zones, and release too, correcting it
  once fixes all of them. On phones the un-stuck overlay bar goes `absolute` so it rides down with
  the admin bar and hands off to the pinned state where the bar clears (the hero-bottom crossover
  trick). Two accepted edges there, both ≤600px and admin-only: a POSITIONED ancestor becomes the
  containing block for those 46px, and the crossover is pixel-exact only while `naturalTop` is the
  admin-bar height — something above the header in the same parent delays the `_sticky` flip past
  the point the wrapper has already ridden off-screen.
- **Flow mode reserves a constant rest-height slot** (`--arts-header-natural-height`, written by
  `syncNaturalHeight` at measure passes ONLY while un-stuck — never on ticks): sticky styling that
  resizes the bar animates inside the slot, so the page never grows/shrinks on the flip. The
  bottom-pinned variant is a column flexbox anchoring the bar to the pinned edge. Accepted edges:
  the `_reveal.scss` `translateY(±100%)` hide over-travels by the shrink delta (wrapper is the
  slot); a boot-while-stuck (scroll-restored load, editor re-render with a scrolled preview) can't
  measure rest — the var waits for the first un-stuck pass, falling back to `auto`. The
  bottom-edge pin decider takes the SLOT height (`pinnedHeight`), not the live bar height; zones
  and release keep the live bar height (visible geometry).
- **All engine styles live in the `arts-header` cascade layer** — any unlayered theme CSS wins by
  default. `playground/shared/playground.scss` stays unlayered on purpose: it simulates a real
  theme and proves the override contract. The one deliberate escape: Elementor ships a generic
  unlayered `.elementor-element` transition shorthand that beats the layered bar-transition rule,
  so `arts_header_enabled`'s `selectors` re-emit the transition longhands (and `.e-con-inner`'s)
  into Elementor's generated per-element CSS, where specificity wins — hand-synced with
  `_modes.scss`'s list.
- **The reveal is entirely CSS-owned** — the engine never writes an inline transform on the
  wrapper. This is deliberate: a transformed ancestor (even an identity `translateY(0)`) becomes
  the containing block for `position: fixed` descendants, collapsing fullscreen overlays rendered
  inside the header.
- **Publish order is class → side effects (attribute swap, the sticking callback) → document
  event** — consumers reading the DOM inside an event listener see the settled state. State flags
  memoize; events only fire on genuine transitions. Publishes are tick-synchronous — no observer
  delivery latency exists anywhere.
- **`destroy(revert=false)` keeps the current visual state** (AJAX page transitions swapping the
  page under a persistent header) — flags `reset()` their values without touching classes. The one
  exception is `released`, which is actively cleared in both paths, because `release.destroy()`
  unconditionally drops the release-anchor var the released positioning depends on. `revert=true`
  restores mutated DOM and fires the state events.
- **Missing container/bar never throws** — logged, `init()` no-ops, half-rendered pages degrade
  silently. Same for a configured `trigger`/`until` selector that matches nothing (warned).
- **HTMLElement checks are realm-safe** (`isHTMLElement` tests `nodeType===1`, not `instanceof`)
  because the Elementor editor preview is a separate-realm iframe. Tests exploit this: plain object
  literals are legitimate elements/rects everywhere.
- **Non-sticky height is seeded from a pre-paint inline CSS var** and never overwritten with 0, so
  a scroll-restored load that boots already-sticky keeps the correct rest height.

## Testing conventions

`tests/ts/` mirrors `src/ts` (not colocated). Tests import through the TEST-ONLY `@ts/*` alias —
`tests/ts/aliasBoundary.test.ts` fails the suite if it ever leaks into `src/ts` (consumers compile
the source with their own configs). Environment is per FILE and selected by the
`// @vitest-environment happy-dom` docblock — without it a file runs under the `node` default, so
an accidental `document` reach fails loudly. The `.dom.test.ts` suffix marks the DOM suites; a few
`utils/` tests take the docblock without renaming (jsdom is not an option: no matchMedia/RO/IO).
Explicit `import { … } from 'vitest'` — no globals. No mocking library:
plain-object fakes plus the `tests/ts/support.ts` factories (observer-constructor stubs driven by
`instances[i].callback(...)`, `fakeRaf().step()`, `makeHeaderFixture`, `setScroll`,
`setScrollBounds`). `unstubGlobals: true` reverts stubs between tests. Rigs that register window
listeners (createSticky/createHeader) must be destroyed in `afterEach` or the previous test keeps
ticking. No coverage thresholds — the visible behavior lives in the CSS state machine and the real
layout the playground exercises.

## Decided — don't reintroduce or "fix"

- **No live option patching** (`applyOptionPatch`-style): the editor destroys and recreates the
  instance per panel change; no live-patch call path exists. Options are constructor-only.
- **The reveal offset transports as a CSS var, not options JSON**: the attribute renders once
  server-side, so responsive per-breakpoint values are impossible through JSON by construction;
  Elementor's selectors pipeline (and theme media queries) write the var instead. Don't move it
  back into `IStickyOptions`.
- **Scrub reveal removed** (was `reveal.mode: 'scrub'`): per-frame inline transform writes bought
  a JS↔CSS ownership swap, deferred stick publishing, and a fixed-descendant containing-block
  hazard for one visual variant. Auto-hide (class-driven, CSS-animated) is the
  only reveal. Don't reintroduce inline wrapper transforms.
- **No observer-based detection** (replaced the 1px sentinel + IOs): an in-flow sentinel costs a
  full gap slot in flex parents (every Elementor container), and its removal/re-insertion churned
  layout exactly while AJAX transitions snapshot the page; dying-observer records were a whole bug
  class of phantom publishes. Cached geometry + the tick covers
  everything, synchronously. Don't bring back IntersectionObservers or injected detection nodes.
- **Root `<html>` style MutationObserver dropped**: it existed only to catch the engine's own
  height-var writes for chained offsets, and any third-party per-frame `<html>` style writer
  (scroll-progress vars) churned its shared debounce and starved settled measure passes.
  The writer signals instead (`onHeightVarsSettled` → createHeader / app fan-out). Known trade:
  offsets chained to NON-engine vars on `<html>` inline style no longer trigger re-measures — the
  panel can't produce that, and no consumer does.
- **No shared state-snapshot object / derive-everything pass**: closure state in `createSticky` +
  pure deciders is the design.
- **`options.mode` dropped**: it was typed, defaulted, documented — and never read. Docking mode is
  a markup/CSS concern (bar modifier class + `:has()`).
- **`data-arts-header-logo` + the default `toggleAttributes` wiring dropped**: the attribute had
  zero readers (CSS keys off the two static version attrs + `_sticky`), and the value semantics
  were incoherent. `toggleAttributes` defaults to `false` and the editor never emits the key; the
  generic mechanism stays for consumers' own attributes.
- **`deepmerge` stays for config only**: flat optional strings fit it (handed a fresh copy of the
  defaults per call — it only spreads the top level, and aliasing the nested defaults was a real
  bug). The `X | false` options shape uses per-section resolvers instead.
- **Per-state spacing sliders + alias vars removed** (was `arts_header_state_*_spacing_*` →
  `--arts-header-{non-sticky,sticky}-spacing-*` with a `_modes.scss` swap): nothing consumed the
  vars without the FDS preset dropdown hand-feeding
  `var()` into Padding. Native Padding + `padding_sticky` replaced them; don't reintroduce
  engine-owned spacing vars.
- **Alternate wins over sticky by source order**: both state selectors have equal specificity, so
  the alt repeater is registered after the sticky one in `Controls.php` and the alt logo block
  follows the sticky block in `_logo.scss`. Don't reorder either, and don't fix it with
  specificity.
- **The look is a separate control, not a third Hide/Lock option**: look is orthogonal to behavior
  (a dark section can also lock the header), and released panel ids are frozen, so the select's
  shape could not be changed later. `arts_header_zone_look` stays independent of
  `arts_header_zone`.
- **No version-skew handling with Horizontal Scroll**: both plugins release together, so there is
  no detection, warning or feature marker. A build without the newer range fields still takes the
  window path (no band gate, release treated as false); only a missing global, `contract < 1` or a
  null range takes the rect path. Don't add shims.
- **fallow's "split `core/createHeader.ts`" recommendation: rejected.** It is the composition root;
  the wiring belongs in one place. fallow will keep suggesting it on fan-in.

## Dependencies

Runtime: **none** — the engine is self-contained (`utils/` is mostly a vendored `@arts/utilities`
subset; `Resize` stays a class there on purpose, matching the original's shape).
`@artemsemkin/elementor-types` is the lone `dependencies` entry and belongs there: it is type-only
(every import of it is `import type`, so nothing reaches the bundle), but the library surface's
type graph reaches it through `containerHandler`, so a consumer compiling this source has to
resolve it. Dev only: the `@arts/wp-plugin-tooling` CLI + shared configs, direct `esbuild`/`sass`
for the library build, `vite`, `typescript`,
`vitest` + `happy-dom` + coverage, `@biomejs/biome`, `stylelint`, `lefthook`, `knip`, `fallow`,
`@types/node`, `lenis` (playground only).
