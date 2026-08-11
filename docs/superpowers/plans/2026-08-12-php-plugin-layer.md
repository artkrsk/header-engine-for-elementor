# PHP Plugin Layer (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the frontend-only repo into an installable WordPress plugin: a `build/` runner that bundles `boot.ts` + SCSS and packages a zip, plus a lean PHP layer that decorates an Elementor Container into a working sticky/reveal header driven by the panel keys the TS engine already reads.

**Architecture:** Lean, dependency-free PHP (the smooth-scrolling/cursor-follower shape — singleton `Plugin` + three focused classes, zero runtime composer packages, no arts/base managers). The predecessor package `/Users/art/Projects/Framework/packages/ArtsHeader/src/php` is the hook-level blueprint for Markup/Controls, but the options JSON it prints is rewritten to the NEW engine's schema (the PHP mirror of `src/ts/elementor/mapPanelSettings.ts`). The `build/` runner is ported file-for-file from `cursor-follower-for-elementor`.

**Tech Stack:** PHP 8.0+, Composer (PSR-4, dev-only deps), PHPStan level max + WordPress/Elementor stubs, esbuild (IIFE), Dart Sass, chokidar dev-mirror, archiver zip.

## Global Constraints

- PHP `>=8.0`; WordPress `Requires at least: 6.5` (for the `Requires Plugins: elementor` header); Elementor ≥ 3.27 assumed (no back-compat shims, no deprecated Elementor APIs).
- **Zero runtime composer dependencies** — `require` is `"php": ">=8.0"` only. `vendor/` ships autoloader-only (`vendor.autoloaderOnly: true` already in `project.config.js`).
- **PHP namespace is `Arts\HeaderForElementor`** — NOT `Arts\Header`. The old framework package (`arts/header`, ns `Arts\Header`) is still composer-required by `velum-core`; both may load in one PHP process during the transition, and same-named classes would fatal.
- **Frozen contracts (do not rename):** panel keys `arts_header_enabled`, `arts_header_sticky_enabled`, `arts_header_sticky_toggle_reveal_enabled`; classes `arts-header`, `js-arts-header`, `arts-header__bar`, `js-arts-header__bar`, `arts-header__bar_fixed`, `arts-header__bar_absolute`, `arts-header_elementor-element-{id}`; attribute `data-arts-header-options`; vars `--arts-header-height`, `--arts-header-height-non-sticky`; class `has-header-height`; global `window.artsHeaderOptions.isElementorEditor`. These are read by the shipped TS engine and by Velum.
- **The options JSON printed by PHP must byte-match what `mapPanelSettings.ts` produces for the same settings** (the editor writes the TS version, the frontend writes the PHP version — the engine must see one schema). `reveal: {}` must serialize as `{}`, never `[]`.
- Version is single-sourced from `composer.json`'s `"version"`; the build stamps the plugin header, `readme.txt`, and `package.json`.
- Text domain: `header-for-elementor`. No `load_plugin_textdomain()` call (JIT loading, WP 6.7+).
- Every `elementor/*` render/controls callback must early-exit unless the element is a Container with `arts_header_enabled` truthy — these hooks fire for every element on the page.
- All existing checks stay green after every task: `pnpm typecheck && pnpm test && pnpm lint && pnpm knip && pnpm fallow`.
- Do not modify `src/ts/**` in this plan (the engine is done; the PHP layer conforms to it).

**Explicitly out of scope (future plans):** DualLogo widget + `arts_header_state_*_logo_version` controls + MediaPreviewOnly + Customizer/kit secondary-logo sync (Phase 2 — needs Velum design input); sticky-state appearance controls (background/border/overlay tabs) + spacing sliders + `arts-header-padding-transition` (Phase 3); Velum integration — TGM entry, repointing `@arts/header` links, `ArtsHeaderForElementor` → `IHeaderApp` type renames (Phase 4); CI workflows (`test.yml`/`release.yml`) and readme changelog conventions (when first release approaches).

---

### Task 1: Composer + plugin skeleton (activatable no-op plugin)

**Files:**
- Create: `composer.json` (repo root)
- Create: `phpstan.neon`
- Create: `src/php/Plugin.php`
- Create: `src/wordpress-plugin/header-for-elementor.php`
- Create: `src/wordpress-plugin/readme.txt`
- Modify: `.gitignore` (add `vendor/`, `vendor-prefixed/`, `.env` if not present — check first, `vendor/` may already be listed)

**Interfaces:**
- Produces: `\Arts\HeaderForElementor\Plugin::instance(): Plugin` singleton; constant `ARTS_HEADER_PLUGIN_VERSION`; constant `ARTS_HEADER_PLUGIN_FILE`. Later tasks add hook wiring inside `Plugin::__construct()` / `Plugin::init_elementor()`.

- [ ] **Step 1: Write `composer.json`**

```json
{
  "name": "arts/header-for-elementor",
  "description": "Sticky/reveal header engine for Elementor containers.",
  "version": "0.1.0",
  "type": "wordpress-plugin",
  "license": "GPL-2.0-or-later",
  "wordpress": {
    "Requires at least": "6.5",
    "Tested up to": "7.0",
    "Requires PHP": "8.0"
  },
  "plugin": {
    "Plugin Name": "Arts Header for Elementor",
    "Plugin URI": "https://artemsemkin.com",
    "Description": "Sticky/reveal header engine for Elementor containers.",
    "Author": "Artem Semkin",
    "Author URI": "https://artemsemkin.com",
    "Text Domain": "header-for-elementor",
    "License": "GPL v2 or later",
    "License URI": "https://www.gnu.org/licenses/gpl-2.0.html"
  },
  "require": {
    "php": ">=8.0"
  },
  "autoload": {
    "psr-4": {
      "Arts\\HeaderForElementor\\": "src/php/"
    }
  },
  "require-dev": {
    "phpstan/phpstan": "^2.0",
    "szepeviktor/phpstan-wordpress": "^2.0",
    "arts/elementor-stubs": "^4.0"
  },
  "scripts": {
    "phpstan": "phpstan analyse --memory-limit=1G",
    "pre-autoload-dump": [
      "@php -r \"is_dir('vendor-prefixed') || mkdir('vendor-prefixed');\""
    ]
  }
}
```

Before writing, open `/Users/art/Projects/Plugins/cursor-follower-for-elementor/composer.json` and compare field-for-field — if it carries a `config` block (e.g. `allow-plugins`, `sort-packages`) copy that too. `arts/elementor-stubs` resolves from Packagist (cursor-follower has no `repositories` block).

- [ ] **Step 2: Copy `phpstan.neon` from cursor-follower and adjust**

Copy `/Users/art/Projects/Plugins/cursor-follower-for-elementor/phpstan.neon` verbatim, then confirm it contains (add if missing):

```neon
parameters:
    level: max
    phpVersion: 80000
    paths:
        - src/php
    treatPhpDocTypesAsCertain: false
```

`treatPhpDocTypesAsCertain: false` is load-bearing: Elementor's `Plugin::$instance` is `@var`-typed nullable, and without the flag PHPStan calls every `! Plugin::$instance` guard dead code.

- [ ] **Step 3: Write the WP bootstrap file**

`src/wordpress-plugin/header-for-elementor.php`:

```php
<?php
/**
 * Plugin Name: Arts Header for Elementor
 * Plugin URI: https://artemsemkin.com
 * Description: Sticky/reveal header engine for Elementor containers.
 * Version: 0.1.0
 * Author: Artem Semkin
 * Author URI: https://artemsemkin.com
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Requires Plugins: elementor
 * Text Domain: header-for-elementor
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Tested up to: 7.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ARTS_HEADER_PLUGIN_VERSION', '0.1.0' );
define( 'ARTS_HEADER_PLUGIN_FILE', __FILE__ );

require_once __DIR__ . '/vendor/autoload.php';

\Arts\HeaderForElementor\Plugin::instance();
```

The header values and the `define` line are stamped from `composer.json` by the build (Task 2) — hand-written once, machine-updated after.

- [ ] **Step 4: Write `readme.txt`**

Copy the shape of `/Users/art/Projects/Plugins/cursor-follower-for-elementor/src/wordpress-plugin/readme.txt`, substituting name/slug/description, `Stable tag: 0.1.0`, and a single `== Changelog ==` entry for `0.1.0` ("Initial release."). The build's `stampReadme()` regex-replaces `Stable tag`/`Requires at least`/`Tested up to`/`Requires PHP` — those lines must exist.

- [ ] **Step 5: Write the minimal `Plugin` singleton**

`src/php/Plugin.php`:

```php
<?php

namespace Arts\HeaderForElementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Plugin bootstrap: wires all WordPress/Elementor hooks.
 */
class Plugin {
	private static ?Plugin $instance = null;

	public static function instance(): Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// Guard against the alphabetical load-order race: a plugin slug sorting
		// after "elementor" can miss the elementor/loaded action entirely.
		if ( did_action( 'elementor/loaded' ) ) {
			$this->init_elementor();
		} else {
			add_action( 'elementor/loaded', array( $this, 'init_elementor' ) );
		}
	}

	public function init_elementor(): void {
		// Elementor-dependent wiring lands here in later tasks.
	}
}
```

- [ ] **Step 6: Install and verify**

```bash
composer install
composer phpstan
php -l src/wordpress-plugin/header-for-elementor.php
```

Expected: composer resolves (dev deps only), PHPStan reports no errors on `src/php`, lint passes. Also run `pnpm typecheck && pnpm test && pnpm lint` to confirm nothing TS-side broke (nothing should — no TS touched).

- [ ] **Step 7: Commit**

```bash
git add composer.json composer.lock phpstan.neon src/php src/wordpress-plugin .gitignore
git commit -m "Add PHP plugin skeleton: composer, phpstan, bootstrap singleton"
```

---

### Task 2: Port the build runner

**Files:**
- Create: `build/index.js`, `build/config.js`, `build/js.js`, `build/sass.js`, `build/sync.js`, `build/package.js`, `build/meta.js`, `build/env.js`, `build/log.js`, `build/extract-changelog.js` — all copied from `/Users/art/Projects/Plugins/cursor-follower-for-elementor/build/`
- Modify: `project.config.js`
- Modify: `biome.json` (the `includes` list already has `build/**` — verify, add if missing)

**Interfaces:**
- Consumes: `composer.json` version/metadata (Task 1), `ARTS_HEADER_PLUGIN_VERSION` constant name.
- Produces: `pnpm dev:plugin` (watch + optional `DEV_TARGET` mirror) and `pnpm build` (staged release + `dist/header-for-elementor.zip`). Bundles land at `src/php/libraries/header-for-elementor/header-for-elementor.{js,css}` — Task 3's enqueue paths depend on these exact names.

- [ ] **Step 1: Copy the runner**

```bash
cp /Users/art/Projects/Plugins/cursor-follower-for-elementor/build/*.js build/
```

- [ ] **Step 2: De-cursor-follower the copies**

Grep the copied files for `cursor`, `ARTS_CURSOR`, `gate` and adjust:
- Any `__ARTS_CURSOR_VERSION__` define key → `__ARTS_HEADER_VERSION__`.
- Remove gate-entry special-casing **only if** it is hardcoded rather than driven by `config.entry.gate` being unset — cursor-follower's runner is config-driven (`entry` keys are read generically); prefer leaving the code generic and simply not defining `entry.gate`. Verify by reading `build/config.js`'s derived-paths section: if `gateOut` derivation no-ops on a missing `entry.gate`, leave everything as-is.
- `assertRelease()`'s required-files list in `build/package.js` must match what this plugin actually ships: `header-for-elementor.php`, `readme.txt`, `composer.json`, `vendor/autoload.php`, `src/php/libraries/header-for-elementor/header-for-elementor.js`, `.../header-for-elementor.css`. Remove `gate.js` from the list.

- [ ] **Step 3: Fix `project.config.js`**

Two stale values (the file predates the SCSS rewrite):

```js
import process from 'node:process'

export default {
  slug: 'header-for-elementor',
  entry: { ts: './src/ts/boot.ts', sass: './src/styles/index.scss' },
  paths: { php: './src/php', plugin: './src/wordpress-plugin', dist: './dist' },
  // Machine-specific: the Local site's plugin dir, from the gitignored .env (DEV_TARGET)
  devTarget: process.env.DEV_TARGET ?? null,
  esbuildTarget: 'es2022',
  versionConstant: 'ARTS_HEADER_PLUGIN_VERSION',
  // Strauss copies prefixed arts/* into vendor-prefixed/; vendor/ ships the autoloader only.
  vendor: { autoloaderOnly: true }
}
```

Changed: `entry.sass` `index.sass` → `index.scss`; `esbuildTarget` `es2018` → `es2022` (matches the engine's tsconfig target; the TS source uses ES2022 features).

- [ ] **Step 4: Run the build**

```bash
pnpm build
unzip -l dist/header-for-elementor.zip
```

Expected: build completes, `assertRelease()` passes, zip contains the bootstrap php, readme, composer.json, autoloader-only `vendor/`, `src/php/Plugin.php`, and the built `libraries/header-for-elementor/header-for-elementor.js` + `.css` with the version banner. Also `pnpm lint` (biome now covers `build/**`) and `pnpm knip` stay green — if knip flags the `build/*.js` files or `archiver`/`chokidar`/`esbuild` movement, update `knip.json`/`.fallowrc.jsonc` entry points accordingly (the deps move OUT of `ignoreDependencies` now that the runner exists).

- [ ] **Step 5: Run dev mode briefly**

```bash
node build/index.js dev &
sleep 5 && kill %1
```

Expected: stamps versions, starts esbuild watch + sass, no `DEV_TARGET` set → compiles into `src/php/libraries/` and skips mirroring, exits cleanly on signal.

- [ ] **Step 6: Commit**

```bash
git add build project.config.js knip.json .fallowrc.jsonc biome.json src/wordpress-plugin src/php
git commit -m "Port the build runner from cursor-follower-for-elementor"
```

(`src/php/libraries/` build output: check whether cursor-follower gitignores it — mirror that decision. If ignored there, add `src/php/libraries/` to `.gitignore` instead of committing bundles.)

---

### Task 3: Assets class — register, enqueue, localize

**Files:**
- Create: `src/php/Elementor/Assets.php`
- Modify: `src/php/Plugin.php`
- Test: PHPStan + manual (Step 4)

**Interfaces:**
- Consumes: bundle paths from Task 2 (`src/php/libraries/header-for-elementor/header-for-elementor.{js,css}`), `ARTS_HEADER_PLUGIN_FILE`.
- Produces: handle `header-for-elementor` (script + style), `window.artsHeaderOptions = { isElementorEditor: bool }`. Task 4's inline pre-paint script and the engine bundle both assume these load on every Elementor-rendered page.

- [ ] **Step 1: Write `Assets.php`**

```php
<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers and enqueues the engine bundle + stylesheet.
 *
 * Enqueued unconditionally whenever Elementor is present: per-element
 * add_style_depends() only guarantees footer-time styles (FOUC for an
 * above-the-fold header), and Velum uses the header on every template.
 */
class Assets {
	public const HANDLE = 'header-for-elementor';

	public function register(): void {
		$dir_url = untrailingslashit( plugin_dir_url( ARTS_HEADER_PLUGIN_FILE ) );
		$base    = $dir_url . '/src/php/libraries/' . self::HANDLE . '/' . self::HANDLE;
		$ver     = defined( 'ARTS_HEADER_PLUGIN_VERSION' ) ? ARTS_HEADER_PLUGIN_VERSION : false;

		wp_register_style(
			self::HANDLE,
			esc_url( $base . '.css' ),
			array( 'elementor-frontend' ),
			$ver
		);

		// No dependency on elementor-frontend: the bundle boots off plain DOM
		// queries on published pages and gates the editor path itself.
		wp_register_script(
			self::HANDLE,
			esc_url( $base . '.js' ),
			array(),
			$ver,
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);

		wp_localize_script(
			self::HANDLE,
			'artsHeaderOptions',
			array(
				'isElementorEditor' => $this->is_elementor_editor(),
			)
		);
	}

	public function enqueue(): void {
		wp_enqueue_style( self::HANDLE );
		wp_enqueue_script( self::HANDLE );
	}

	private function is_elementor_editor(): bool {
		if ( ! class_exists( '\Elementor\Plugin' ) ) {
			return false;
		}
		return \Elementor\Plugin::$instance->editor->is_edit_mode()
			|| \Elementor\Plugin::$instance->preview->is_preview_mode();
	}
}
```

Note on `is_elementor_editor()`: the predecessor delegated to `Arts\Utilities\Utilities::is_elementor_editor_active()`. We are dependency-free, so before finalizing, open `/Users/art/Projects/Framework/packages/ArtsUtilities/src/php/Traits/Elementor.php` (grep for `is_elementor_editor_active`) and mirror its exact checks — the editor *preview iframe* is the case that matters (that's where the bundle attaches `containerHandler`), and `preview->is_preview_mode()` is the flag that covers it. Copy the real implementation's conditions, not this sketch, if they differ.

- [ ] **Step 2: Wire into `Plugin.php`**

In `init_elementor()`:

```php
	public function init_elementor(): void {
		$assets = new Elementor\Assets();

		add_action( 'wp_enqueue_scripts', array( $assets, 'register' ) );
		add_action( 'wp_enqueue_scripts', array( $assets, 'enqueue' ) );
	}
```

(Elementor registers its own handles at priority 5, so default priority 10 is safe for the `elementor-frontend` style dependency.)

- [ ] **Step 3: Static checks**

```bash
composer phpstan
```

Expected: clean. PHPStan knows Elementor's classes via `arts/elementor-stubs`.

- [ ] **Step 4: Manual verify on the Local dev site**

Create `.env` at repo root (gitignored):

```
DEV_TARGET=/Users/art/Local Sites/dev/app/public/wp-content/plugins/header-for-elementor
```

Run `pnpm dev:plugin` (leave it running from here through Task 6), activate the plugin in wp-admin (or `wp plugin activate header-for-elementor` if wp-cli is available for the Local site), load any Elementor page. Expected: `header-for-elementor.js` + `.css` requests succeed (200), `window.artsHeaderOptions` is `{ isElementorEditor: false }`, console shows no errors (the engine logs "container not found" style warnings only in dev builds — a missing header container must NOT throw).

- [ ] **Step 5: Commit**

```bash
git add src/php
git commit -m "Register and enqueue the engine bundle with editor-flag localization"
```

---

### Task 4: Markup class — wrapper, bar attributes, options JSON, pre-paint script

**Files:**
- Create: `src/php/Elementor/Markup.php`
- Modify: `src/php/Plugin.php`

**Interfaces:**
- Consumes: nothing from other tasks (pure Elementor hooks).
- Produces: static `Markup::map_panel_settings( bool $sticky_enabled, bool $toggle_reveal_enabled ): array` — Task 6's sync test greps for its shape; the frontend DOM contract the engine boots against.

Blueprint: `/Users/art/Projects/Framework/packages/ArtsHeader/src/php/Managers/Markup.php` — same hooks, same guard, but the options array is replaced with the new engine's schema and `Utilities::*` helpers are inlined.

- [ ] **Step 1: Write `Markup.php`**

```php
<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Element_Base;
use Elementor\Includes\Elements\Container;

/**
 * Decorates a header-enabled Container: prints the .arts-header wrapper
 * around it, adds the bar classes to the container's own tag, and emits
 * the per-instance pre-paint height script.
 *
 * Every callback fires for EVERY element Elementor renders — the
 * is_header_element() guard is load-bearing, keep it first and cheap.
 */
class Markup {
	/**
	 * PHP mirror of src/ts/elementor/mapPanelSettings.ts — the editor writes
	 * the TS version of this JSON, the frontend writes this one; the engine
	 * must see one schema. `reveal => (object) array()` keeps `{}` from
	 * collapsing to `[]` in wp_json_encode.
	 *
	 * @return array{sticky: false|array{reveal: object|false}}
	 */
	public static function map_panel_settings( bool $sticky_enabled, bool $toggle_reveal_enabled ): array {
		if ( ! $sticky_enabled ) {
			return array( 'sticky' => false );
		}

		return array(
			'sticky' => array(
				'reveal' => $toggle_reveal_enabled ? (object) array() : false,
			),
		);
	}

	public function add_header_wrapper_before( Element_Base $element ): void {
		if ( ! $this->is_header_element( $element ) ) {
			return;
		}

		$settings = (array) $element->get_settings_for_display();

		$sticky_enabled        = ! empty( $settings['arts_header_sticky_enabled'] );
		$toggle_reveal_enabled = ! empty( $settings['arts_header_sticky_toggle_reveal_enabled'] );

		$options = self::map_panel_settings( $sticky_enabled, $toggle_reveal_enabled );

		$element->add_render_attribute(
			'header_wrapper',
			array(
				'class'                    => array(
					'arts-header',
					'arts-header_elementor-element-' . $element->get_id(),
					'js-arts-header',
				),
				'data-arts-header-options' => wp_json_encode( $options ),
			)
		);

		?><div <?php $element->print_render_attribute_string( 'header_wrapper' ); ?>>
		<?php
	}

	public function add_header_wrapper_after( Element_Base $element ): void {
		if ( ! $this->is_header_element( $element ) ) {
			return;
		}

		?>
		</div>
		<?php

		$this->print_inline_height_script( 'arts-header-height-' . $element->get_id() . '-js' );
	}

	public function add_header_bar_attributes( Element_Base $element ): void {
		if ( ! $this->is_header_element( $element ) ) {
			return;
		}

		$settings       = (array) $element->get_settings_for_display();
		$sticky_enabled = ! empty( $settings['arts_header_sticky_enabled'] );

		$element->add_render_attribute(
			'_wrapper',
			array(
				'class' => array(
					'arts-header__bar',
					'js-arts-header__bar',
					$sticky_enabled ? 'arts-header__bar_fixed' : 'arts-header__bar_absolute',
				),
			)
		);
	}

	private function is_header_element( Element_Base $element ): bool {
		if ( ! ( $element instanceof Container ) ) {
			return false;
		}

		$settings = (array) $element->get_settings_for_display();

		return ! empty( $settings['arts_header_enabled'] );
	}

	/**
	 * Pre-paint seed: sets the two height vars + the has-header-height class
	 * synchronously, immediately after the header markup, so first paint has
	 * the correct layout and the engine's height observer can trust the
	 * seeded non-sticky value on scroll-restored loads.
	 */
	private function print_inline_height_script( string $script_id ): void {
		?>
		<script id="<?php echo esc_attr( $script_id ); ?>">
			(function() {
				var bar = document.querySelector('.arts-header__bar');
				if (!bar) { return; }
				var height = bar.clientHeight;
				document.documentElement.style.setProperty('--arts-header-height', height + 'px');
				document.documentElement.style.setProperty('--arts-header-height-non-sticky', height + 'px');
				document.documentElement.classList.add('has-header-height');
			})();
		</script>
		<?php
	}
}
```

Two deliberate simplifications vs. the predecessor (record in the commit message): the `$args`/`wp_parse_args` parameterization of the inline script is dropped (single consumer, fixed contract — YAGNI), and logo-version attributes are not printed (Phase 2, with the DualLogo widget).

- [ ] **Step 2: Wire into `Plugin.php`**

Extend `init_elementor()`:

```php
	public function init_elementor(): void {
		$assets = new Elementor\Assets();
		$markup = new Elementor\Markup();

		add_action( 'wp_enqueue_scripts', array( $assets, 'register' ) );
		add_action( 'wp_enqueue_scripts', array( $assets, 'enqueue' ) );

		add_action( 'elementor/frontend/container/before_render', array( $markup, 'add_header_wrapper_before' ) );
		add_action( 'elementor/frontend/container/after_render', array( $markup, 'add_header_wrapper_after' ) );
		add_action( 'elementor/element/after_add_attributes', array( $markup, 'add_header_bar_attributes' ) );
	}
```

- [ ] **Step 3: Static checks**

```bash
composer phpstan
```

Expected: clean. If PHPStan flags `Elementor\Includes\Elements\Container` as unknown, check how the stubs name it (`\Elementor\Includes\Elements\Container` vs legacy `\ElementorPro...`) and match the stubs.

- [ ] **Step 4: Manual verify — no header enabled yet**

With `pnpm dev:plugin` still mirroring: reload the Elementor test page. Expected: no wrapper divs anywhere (no container has `arts_header_enabled` — the setting doesn't even exist until Task 5), no PHP notices in the Local site's error log.

- [ ] **Step 5: Commit**

```bash
git add src/php
git commit -m "Decorate header containers: wrapper, bar classes, options JSON, pre-paint height seed"
```

---

### Task 5: Controls class — panel section + fluid presets

**Files:**
- Create: `src/php/Elementor/Controls.php`
- Modify: `src/php/Plugin.php`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: the three `frontend_available` panel keys the TS `containerHandler`/`mapPanelSettings` and Task 4's Markup read.

Blueprint: `/Users/art/Projects/Framework/packages/ArtsHeader/src/php/Managers/Controls.php:145-197` (the `add_header_section_controls` method), minus the state tabs (Phase 2/3) and minus the transition control (Phase 3).

- [ ] **Step 1: Write `Controls.php`**

```php
<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Element_Base;

/**
 * Injects the "Create Header" section into the Container's Layout tab.
 * All behavior keys are frontend_available — the editor-side handler
 * reads them via getElementSettings(), which silently drops any control
 * missing that flag.
 */
class Controls {
	public function add_header_section_controls( Element_Base $element ): void {
		$element->start_controls_section(
			'arts_header_section',
			array(
				'label' => esc_html__( 'Create Header', 'header-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$element->add_control(
			'arts_header_enabled',
			array(
				'label'              => sprintf(
					'<strong>%1$s %2$s %3$s</strong>',
					esc_html__( 'Use this', 'header-for-elementor' ),
					$element->get_title(),
					esc_html__( 'as Page Header', 'header-for-elementor' )
				),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => '',
				'frontend_available' => true,
			)
		);

		$element->add_control(
			'arts_header_sticky_enabled',
			array(
				'label'              => esc_html__( 'Enable Sticky Effect', 'header-for-elementor' ),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => 'yes',
				'frontend_available' => true,
				'condition'          => array( 'arts_header_enabled!' => '' ),
			)
		);

		$element->add_control(
			'arts_header_sticky_toggle_reveal_enabled',
			array(
				'label'              => esc_html__( 'Toggle Reveal on Scroll', 'header-for-elementor' ),
				'description'        => esc_html__( 'Hide the top bar when scrolling down and reveal it when scrolling up.', 'header-for-elementor' ),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => 'yes',
				'frontend_available' => true,
				'condition'          => array(
					'arts_header_enabled!'        => '',
					'arts_header_sticky_enabled!' => '',
				),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * Expose the engine-written height vars as pickable values in the Fluid
	 * Design System dropdown. A silent no-op when that plugin is absent.
	 * Only globally-inherited vars belong here (both are set on <html>);
	 * never register --arts-header-release-top — it is scoped to the header
	 * subtree and would silently fail to resolve elsewhere.
	 *
	 * @param array<int, array<string, mixed>> $result
	 * @return array<int, array<string, mixed>>
	 */
	public function add_header_custom_presets( $result ): array {
		$result[] = array(
			'name'  => esc_html__( 'Header Presets', 'header-for-elementor' ),
			'value' => array(
				array(
					'id'    => 'arts-header-height',
					'value' => 'var(--arts-header-height)',
					'title' => esc_html__( 'Header Current Height', 'header-for-elementor' ),
				),
				array(
					'id'    => 'arts-header-height-non-sticky',
					'value' => 'var(--arts-header-height-non-sticky)',
					'title' => esc_html__( 'Header Height (Non-Sticky)', 'header-for-elementor' ),
				),
			),
		);

		return $result;
	}
}
```

(The predecessor's two spacing presets are dropped: nothing writes `--arts-header-spacing-*` until the Phase 3 spacing sliders exist.)

- [ ] **Step 2: Wire into `Plugin.php`**

Extend `init_elementor()` (final Phase-1 shape):

```php
	public function init_elementor(): void {
		$assets   = new Elementor\Assets();
		$markup   = new Elementor\Markup();
		$controls = new Elementor\Controls();

		add_action( 'wp_enqueue_scripts', array( $assets, 'register' ) );
		add_action( 'wp_enqueue_scripts', array( $assets, 'enqueue' ) );

		add_action( 'elementor/frontend/container/before_render', array( $markup, 'add_header_wrapper_before' ) );
		add_action( 'elementor/frontend/container/after_render', array( $markup, 'add_header_wrapper_after' ) );
		add_action( 'elementor/element/after_add_attributes', array( $markup, 'add_header_bar_attributes' ) );

		add_action( 'elementor/element/container/section_layout_container/after_section_end', array( $controls, 'add_header_section_controls' ) );

		add_filter( 'arts/fluid_design_system/custom_presets', array( $controls, 'add_header_custom_presets' ) );
	}
```

(`section_layout_container` is the Container Layout section's real id — `section_layout` does not exist on Containers.)

- [ ] **Step 3: Static checks**

```bash
composer phpstan
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/php
git commit -m "Inject the Create Header panel section and fluid design system presets"
```

---

### Task 6: TS↔PHP identifier sync test

**Files:**
- Create: `tests/phpSync.test.ts`

**Interfaces:**
- Consumes: `src/php/Elementor/{Markup,Controls,Assets}.php` sources (read as text); TS constants from `@ts/constants` (`WRAPPER_CLASS`, `WRAPPER_JS_CLASS`, `WRAPPER_ELEMENT_ID_PREFIX`, `BAR_CLASS`, `BAR_JS_CLASS`, `BAR_FIXED_CLASS`, `BAR_ABSOLUTE_CLASS`, `OPTIONS_ATTR`, `defaultConfig`) and the panel keys read by `src/ts/elementor/containerHandler.ts`.

This is the `styleSync.test.ts` pattern extended across the language boundary: PHP and TS have no shared source of truth, so a mechanical grep keeps them honest.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BAR_ABSOLUTE_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  OPTIONS_ATTR,
  WRAPPER_CLASS,
  WRAPPER_ELEMENT_ID_PREFIX,
  WRAPPER_JS_CLASS,
  defaultConfig
} from '@ts/constants'

const php = (file: string): string =>
  readFileSync(resolve(__dirname, `../src/php/Elementor/${file}`), 'utf8')

/** Panel keys the editor-side handler reads — the PHP Controls section must define each. */
const PANEL_KEYS = [
  'arts_header_enabled',
  'arts_header_sticky_enabled',
  'arts_header_sticky_toggle_reveal_enabled'
]

describe('PHP markup mirrors the TS identifier contract', () => {
  const markup = php('Markup.php')

  it.each([
    WRAPPER_CLASS,
    WRAPPER_JS_CLASS,
    WRAPPER_ELEMENT_ID_PREFIX,
    BAR_CLASS,
    BAR_JS_CLASS,
    BAR_FIXED_CLASS,
    BAR_ABSOLUTE_CLASS,
    OPTIONS_ATTR
  ])('prints %s', (identifier) => {
    expect(markup).toContain(identifier)
  })

  it('seeds both engine height vars and the height class pre-paint', () => {
    expect(markup).toContain(defaultConfig.vars.headerHeight)
    expect(markup).toContain(defaultConfig.vars.headerHeightNonSticky)
    expect(markup).toContain(defaultConfig.classes.hasHeaderHeight)
  })

  it('reads every panel key the engine maps', () => {
    for (const key of PANEL_KEYS) {
      expect(markup.includes(key) || php('Controls.php').includes(key)).toBe(true)
    }
  })
})

describe('PHP controls define the frontend_available panel keys', () => {
  const controls = php('Controls.php')

  it.each(PANEL_KEYS)('defines %s', (key) => {
    expect(controls).toContain(`'${key}'`)
  })
})
```

Check the exact constant names against `src/ts/constants/dom.ts` / `dataAttrs.ts` barrels before writing — the names above come from `constants/index.ts` re-exports; adjust the import list to what the barrel actually exports.

- [ ] **Step 2: Run to verify it exercises the real files**

```bash
pnpm test -- phpSync
```

Expected: PASS if Tasks 4-5 landed faithfully — this test's value is as a tripwire for future drift. Force one failure to prove it bites: temporarily change `js-arts-header` to `js-arts-headerX` in `Markup.php`, re-run (expect FAIL), revert.

- [ ] **Step 3: Full suite + analyzers**

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm knip && pnpm fallow
```

Expected: all green (`tests/phpSync.test.ts` runs in the node environment — it must not touch `document`).

- [ ] **Step 4: Commit**

```bash
git add tests/phpSync.test.ts
git commit -m "Guard the TS/PHP identifier contract with a sync test"
```

---

### Task 7: End-to-end smoke on the Local dev site

**Files:** none created — verification task. (Fixes discovered here fold back into the owning task's files.)

**Interfaces:**
- Consumes: everything above, running via `pnpm dev:plugin` + `DEV_TARGET`.

- [ ] **Step 1: Build a header page**

In the Local site's Elementor editor: create/edit a page, add a Container with a small nav placeholder, open the Container's **Layout** tab → "Create Header" section, switch **Use this Container as Page Header** on. Expected in the editor preview: the container gets wrapped (`.arts-header.js-arts-header` — inspect via devtools inside the preview iframe), toggling **Enable Sticky Effect** re-renders and re-inits without console errors, and the bar swaps `arts-header__bar_fixed` ↔ `arts-header__bar_absolute`.

- [ ] **Step 2: Verify the published page**

Save, view the page logged-out (or in a private window — the admin bar changes `stickyTop`, test both states):
- Wrapper markup present with `data-arts-header-options` matching the panel state — with all defaults on, exactly `{"sticky":{"reveal":{}}}`.
- The inline height script tag sits right after the closing wrapper div; `document.documentElement` carries `has-header-height` and both `--arts-header-height` vars **before** the bundle loads (check with JS disabled the vars are still set by the inline script — it's plain inline JS, it runs regardless of the deferred bundle).
- Scrolling: `arts-header_sticky` appears at the sticky line; scrolling down hides the bar, scrolling up reveals it (auto-hide default); `document.addEventListener('arts/header/sticky', console.log)` fires on transitions.
- Logged-in with admin bar: the header pins below the 32px bar (the engine reads `<html>` margin-top as `stickyTop`).

The chrome-devtools MCP tools can drive this (navigate, evaluate, screenshot) if a scripted pass is preferred over manual clicking.

- [ ] **Step 3: Verify the AJAX-transition contract shape**

On the published page console:

```js
await window.artsHeaderForElementor.destroy(false)  // → true; classes stay
await window.artsHeaderForElementor.init()          // → true; engine re-arms
```

This is the exact call sequence Velum's `velum-ajax-transitions/src/ts/app.ts:68,92` performs on every page transition.

- [ ] **Step 4: Fix anything found, amend the owning commits or add fix commits, re-run the full gate**

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm knip && pnpm fallow && composer phpstan && pnpm build
```

- [ ] **Step 5: Update CLAUDE.md Status section + commit**

The "Status / scope" section of `CLAUDE.md` says the PHP layer doesn't exist and `pnpm build`/`pnpm dev:plugin` don't run — rewrite that paragraph to describe the now-real `build/` runner, `src/php` layout (`Plugin`, `Elementor/{Assets,Markup,Controls}`), and the Phase 2-4 scope still outstanding.

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for the PHP plugin layer"
```

---

## Decisions encoded in this plan (with the reasoning)

1. **Lean dependency-free PHP, not the predecessor's arts/base + arts/elementor-extension managers.** Two of the three sibling plugins (smooth-scrolling, cursor-follower) ship zero runtime composer deps; the research confirmed ArtsElementorExtension provides nothing for container decoration (it's a widget/kit-tab registration bus — every predecessor hook was hand-rolled `add_action` anyway), and the DualLogo widget never actually used the component runtime it inherited. When Phase 2 adds DualLogo, it can extend `\Elementor\Widget_Base` directly.
2. **`Arts\HeaderForElementor` namespace** — `Arts\Header` collides with the old framework package still loaded by `velum-core` during the transition.
3. **Unconditional enqueue, not per-element `add_script_depends()`** — the per-element path only reliably flushes styles at footer time (FOUC for an above-the-fold header), and Velum renders the header on every template. Conditional loading can come later via a pre-render `get_elements_data()` scan if ever needed.
4. **Conventional enqueue, not the siblings' inline gate pattern** — the gate exists to skip network requests on touch devices for optional engines; a header must be present at first paint, so there's nothing to gate. The pre-paint concern is handled by the per-instance inline height script instead (predecessor pattern, endorsed by the WP-core research).
5. **Panel keeps the two sticky switchers mapping to `reveal: {}` (auto-hide default)** — no BC pressure to reproduce the old GSAP scrub feel; a reveal-mode select (off/auto-hide/scrub + offset) is a natural Phase 3 addition once Velum's designs demand it, and `data-arts-header-options` already supports every engine option for hand-authored cases meanwhile.
6. **Logo-version controls/attributes deferred to Phase 2** — the attrs have no reader until a dual-logo widget renders `.arts-header-logo` markup (Velum has none yet; its docs call for one).
7. **`options.heightObserver` is not emitted in the JSON** — the resolver default (enabled) is correct for both frontend and editor; the predecessor's `cleanupOnDestroy: isEditor` special case is obsolete because the editor path constructs the app with explicit args, and TS `mapPanelSettings` (the parity source) doesn't emit it either.
