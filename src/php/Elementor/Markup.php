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
 * the pre-paint height script for the page's PRIMARY header.
 *
 * The two elementor/frontend/container/* hooks are type-scoped, but
 * elementor/element/after_add_attributes fires for EVERY element
 * Elementor renders — the guard opening each callback is load-bearing
 * there, keep it first and cheap.
 */
class Markup {
	/**
	 * The first rendered header element's id — the page's PRIMARY header.
	 * Tracked by id (not a render counter) so Elementor re-rendering the
	 * same element within one request keeps its classification.
	 *
	 * @var string|null
	 */
	private static $primary_id = null;

	/**
	 * PHP mirror of src/ts/elementor/mapPanelSettings.ts — the editor writes
	 * the TS version of this JSON, the frontend writes this one; the engine
	 * must see one schema. Position never travels here (docking is a
	 * markup/CSS concern), and the reveal offset is a CSS var the engine
	 * reads directly. A secondary header (not first in DOM order) is kept
	 * off the page globals: no height publishing, no zone reactions.
	 *
	 * @return array{sticky: false|array{reveal: bool, zones?: false}, heightObserver?: false}
	 */
	public static function map_panel_settings( string $on_scroll, bool $is_primary ): array {
		$machinery_on = 'sticky' === $on_scroll || 'auto-hide' === $on_scroll;

		if ( $machinery_on ) {
			$sticky = array( 'reveal' => 'auto-hide' === $on_scroll );
			if ( ! $is_primary ) {
				$sticky['zones'] = false;
			}
		} else {
			$sticky = false;
		}

		$options = array( 'sticky' => $sticky );
		if ( ! $is_primary ) {
			$options['heightObserver'] = false;
		}

		return $options;
	}

	public function add_header_wrapper_before( Element_Base $element ): void {
		if ( ! $this->is_header_element( $element ) ) {
			return;
		}

		$settings = (array) $element->get_settings_for_display();

		$on_scroll_raw = $settings['arts_header_on_scroll'] ?? '';
		$on_scroll     = is_string( $on_scroll_raw ) ? $on_scroll_raw : '';

		if ( null === self::$primary_id ) {
			self::$primary_id = $element->get_id();
		}
		$is_primary = $element->get_id() === self::$primary_id;

		$options = self::map_panel_settings( $on_scroll, $is_primary );

		$attributes = array(
			'class'                    => array(
				'arts-header',
				'arts-header_elementor-element-' . $element->get_id(),
				'js-arts-header',
			),
			'data-arts-header-options' => wp_json_encode( $options ),
		);

		// Logo version tokens, read by CSS only — written only when set, mirroring the
		// editor-side containerHandler (an absent attribute is the "no swap" state).
		$non_sticky_logo_version = $settings['arts_header_state_non_sticky_logo_version'] ?? '';
		$sticky_logo_version     = $settings['arts_header_state_sticky_logo_version'] ?? '';

		if ( is_string( $non_sticky_logo_version ) && $non_sticky_logo_version !== '' ) {
			$attributes['data-arts-header-non-sticky-logo'] = $non_sticky_logo_version;
		}

		if ( is_string( $sticky_logo_version ) && $sticky_logo_version !== '' ) {
			$attributes['data-arts-header-sticky-logo'] = $sticky_logo_version;
		}

		$element->add_render_attribute( 'header_wrapper', $attributes );

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

		// Only the PRIMARY header seeds the page-global height vars — a secondary bar's height
		// must never masquerade as "the header height" for content offsets and fluid presets.
		if ( $element->get_id() === self::$primary_id ) {
			$this->print_inline_height_script( 'arts-header-height-' . $element->get_id() . '-js', $element->get_id() );
		}
	}

	public function add_header_bar_attributes( Element_Base $element ): void {
		if ( ! $this->is_header_element( $element ) ) {
			return;
		}

		$settings     = (array) $element->get_settings_for_display();
		$on_scroll    = $settings['arts_header_on_scroll'] ?? '';
		$machinery_on = 'sticky' === $on_scroll || 'auto-hide' === $on_scroll;
		$position     = $settings['arts_header_position'] ?? '';

		$classes = array(
			'arts-header__bar',
			'js-arts-header__bar',
		);

		// Bottom is inherently fixed (On Scroll only governs the state machinery). Default (flow)
		// pins via CSS-native position:sticky, so there the behavior decides the modifier — None
		// emits no modifier at all (plain static in-page bar), and Stick To picks the pin edge.
		if ( 'bottom' === $position ) {
			$classes[] = 'arts-header__bar_bottom';
		} elseif ( 'flow' === $position ) {
			if ( $machinery_on ) {
				$stick_to_bottom = 'bottom' === ( $settings['arts_header_stick_to'] ?? '' );
				$classes[]       = $stick_to_bottom ? 'arts-header__bar_sticky-bottom' : 'arts-header__bar_sticky';
			}
		} else {
			$classes[] = $machinery_on ? 'arts-header__bar_fixed' : 'arts-header__bar_absolute';
		}

		$element->add_render_attribute(
			'_wrapper',
			array(
				'class' => $classes,
			)
		);
	}

	/**
	 * Renders the Header Zone attributes on a non-header Container — the engine's zone tracker
	 * reads them from ANY element; the body-wide MutationObserver makes editor re-renders live.
	 */
	public function add_zone_attributes( Element_Base $element ): void {
		if ( ! ( $element instanceof Container ) ) {
			return;
		}

		$settings = (array) $element->get_settings_for_display();

		$zone = $settings['arts_header_zone'] ?? '';
		if ( ( 'hide' !== $zone && 'lock' !== $zone ) || ! empty( $settings['arts_header_enabled'] ) ) {
			return;
		}

		$geometry_raw = $settings['arts_header_zone_geometry'] ?? 'at-top';
		$geometry     = in_array( $geometry_raw, array( 'at-top', 'overlap', 'in-view' ), true ) ? $geometry_raw : 'at-top';

		$attribute = 'hide' === $zone ? 'data-arts-header-hide-over' : 'data-arts-header-lock-over';

		$element->add_render_attribute( '_wrapper', array( $attribute => $geometry ) );
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
	private function print_inline_height_script( string $script_id, string $element_id ): void {
		?>
		<script id="<?php echo esc_attr( $script_id ); ?>">
			(function() {
				var bar = document.querySelector('.arts-header_elementor-element-<?php echo esc_attr( $element_id ); ?> .arts-header__bar');
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
