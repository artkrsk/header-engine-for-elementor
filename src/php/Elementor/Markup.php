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
