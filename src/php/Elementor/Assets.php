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

		// Not wp_localize_script: it string-casts scalars (false becomes ""),
		// and the TS side types isElementorEditor as a real boolean.
		wp_add_inline_script(
			self::HANDLE,
			'window.artsHeaderOptions = ' . (string) wp_json_encode(
				array( 'isElementorEditor' => $this->is_elementor_editor() )
			) . ';',
			'before'
		);
	}

	public function enqueue(): void {
		wp_enqueue_style( self::HANDLE );
		wp_enqueue_script( self::HANDLE );
	}

	/** True inside the Elementor editor's preview iframe (where the container handler attaches). */
	private function is_elementor_editor(): bool {
		if ( ! class_exists( '\Elementor\Plugin' )
			|| ! \Elementor\Plugin::$instance
			|| ! \Elementor\Plugin::$instance->preview ) {
			return false;
		}

		return \Elementor\Plugin::$instance->preview->is_preview_mode();
	}
}
