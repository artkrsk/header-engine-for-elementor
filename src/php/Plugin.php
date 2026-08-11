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
