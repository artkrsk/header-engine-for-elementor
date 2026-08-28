=== Artem Semkin Header Engine for Elementor ===
Contributors: artemsemkin
Tags: elementor, sticky header, elementor header, transparent header, hide header
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 1.0.0
License: GPLv3
License URI: https://www.gnu.org/licenses/gpl-3.0
GitHub Plugin URI: https://github.com/artkrsk/header-engine-for-elementor/

Sticky and auto-hide header for Elementor containers. Hide on scroll down, reveal on scroll up, logo swap, sticky styling. Free, zero dependencies.

== Description ==

Turn any Elementor Container into a site header that knows what to do on scroll: pin it to the top, tuck it away while readers scroll down, bring it back the moment they scroll up, and restyle it while it is stuck. You set it all up in the Container's own settings panel. There is no separate builder to learn, and the free version of Elementor is enough.

= What you get =

* **Sticky header** — the container pins to the viewport once the page would scroll it away.
* **Auto-hide and reveal** — the header slides out of view on scroll down and returns the moment the reader scrolls up, from anywhere on the page.
* **Transparent overlay headers** — lay the header over your hero section, then give the sticky state a solid background so it fills in as it pins.
* **Sticky-state styling** — separate background, border, box-shadow and padding for the stuck header, set with Elementor's native style controls.
* **Recolor while sticky** — remap any Elementor Global Color for the stuck header: every widget inside that uses it — menus, buttons, icons, from any addon — switches with it. No per-widget color settings to hunt down.
* **Logo swap** — the bundled Dual Site Logo widget switches between a primary and a secondary logo when the header sticks, so a light logo over the hero can become a dark one on a solid sticky bar.
* **Header zones** — mark any other container on the page to hide the header while visitors scroll over it, or to reveal and lock it there. Handy over full-screen galleries and embedded maps.
* **Reveal offset** — start auto-hiding only after a chosen scroll distance: a custom value, the viewport height, or the header's own height.
* **Pin offset** — stick the header below a custom line. Negative offsets work too, which lets a tall header stick in a compact form.
* **Bottom dock** — fix the header to the bottom edge instead; auto-hide slides it down and out of the way.
* **In-page sticky bars** — the Default position keeps the container in the page flow and pins it within its parent: mid-page filter bars, sub-menus, section navigation.
* **Multiple headers per page** — every container you mark runs as its own independent instance.

= Built to stay out of your way =

* Zero runtime dependencies. The engine ships without jQuery or animation libraries, so there is nothing for other plugins to conflict with.
* The engine only toggles CSS classes and custom properties; every visible animation runs in CSS. There is no per-frame JavaScript styling.
* No layout jumps. Overlay headers never affect page flow, and in-flow headers reserve a constant slot, so the page does not shift when the header sticks or shrinks.
* No external services. Nothing loads from third-party servers and nothing phones home.
* There is no Pro tier. Every feature is included, and your dashboard stays free of ads.

= Works with =

* Elementor Free. The header is a regular Container, styled with the controls you already use.
* Any theme. The plugin ships its styles in a dedicated CSS cascade layer, so your theme's CSS wins any conflict.
* Elementor Pro Theme Builder header templates, for the Top and Bottom positions.

= For developers =

The engine publishes its state as CSS classes and custom properties on the header wrapper and fires CustomEvents on `document`: `arts/header/sticky`, `arts/header/hidden`, `arts/header/locked`, `arts/header/released`, `arts/header/displaced`. The TypeScript and SCSS source lives on GitHub: https://github.com/artkrsk/header-engine-for-elementor

== Installation ==

1. Install and activate the plugin. Elementor must be active.
2. Edit a page with Elementor and select the top-level Container you want as your header.
3. In the Layout tab, open the Create Header section and switch on "Use this Container as Page Header".
4. Pick a Position (Top, Bottom or Default) and an On Scroll behavior (Sticky, or Sticky & Auto-Hide), then style the Sticky State to taste.

== Frequently Asked Questions ==

= Does it require Elementor Pro? =

No. It works with the free Elementor plugin — any Container can become a header. If you use Elementor Pro, header templates built with the Theme Builder work too, in the Top and Bottom positions.

= Where are the settings? =

On the Container itself. Select the container in the Elementor editor and open Layout → Create Header. There is no separate admin page.

= Will my content jump when the header becomes sticky? =

No. Headers in the Top and Bottom positions overlay the page and never affect its layout. Headers in the Default position reserve a constant slot in the page, so even a header that shrinks while sticky does not shift the content below it.

= Can the header look different while it is sticky? =

Yes. The Sticky State section has its own background, border, box-shadow and padding controls, the Sticky Colors rows can remap your Global Colors for everything inside, and the Dual Site Logo widget can swap to a second logo. The transition between the two states is animated in CSS.

= How do I change my menu and text colors when the header sticks? =

Use Elementor Global Colors in the widgets inside your header, then add rows under Create Header → Sticky Colors: each row maps one Global Color to the value it should take while the header is sticky. Every widget that uses that color follows automatically, third-party widgets included. Plain hex colors are left alone, and a widget's own sticky-specific color control, if it has one, still wins.

= How do I make a transparent header that turns solid on scroll? =

Set Position to Top, leave the container's background empty, and give the Sticky State a solid background. The header overlays your hero, then fills in as it pins.

= Can I hide the header over one specific section? =

Yes. Select any other container on the page and open its Header Zone section: choose Hide Header or Reveal & Lock Header, and pick when the zone counts: when it reaches the top, overlaps the header, or is in view.

= Why doesn't the Default position stick inside my Theme Builder header? =

The Default position pins the header within its parent container, and a Theme Builder header location is only as tall as the header itself, so there is nowhere to pin. Use the Top position for site headers; Default is meant for bars inside tall page content.

= Does it slow down my site? =

No. The script and stylesheet together weigh about 25 KB, and the engine does its work on a single shared scroll listener with cached geometry; the animations themselves run in CSS.

== Screenshots ==

1. The Create Header section in the Layout tab of an Elementor Container — turn any container into a site header right in its own settings panel.
2. Header scroll behavior settings: position, Sticky & Auto-Hide mode, pin and reveal offsets, the dual logo per state, and the Global Color overrides that recolor the stuck header.
3. Sticky Header Styles in the Style tab — a separate background for the stuck header, set with Elementor's native controls.
4. The bundled Dual Site Logo widget in the Elementor elements panel.
5. Primary and secondary logos in the Dual Site Logo widget — the header swaps them automatically when it sticks.

== Changelog ==

= 1.0.0 =
Initial release.
