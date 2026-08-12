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
		$assets   = new Elementor\Assets();
		$markup   = new Elementor\Markup();
		$controls = new Elementor\Controls();

		add_action( 'wp_enqueue_scripts', array( $assets, 'register' ) );
		add_action( 'wp_enqueue_scripts', array( $assets, 'enqueue' ) );

		add_action( 'elementor/frontend/container/before_render', array( $markup, 'add_header_wrapper_before' ) );
		add_action( 'elementor/frontend/container/after_render', array( $markup, 'add_header_wrapper_after' ) );
		add_action( 'elementor/element/after_add_attributes', array( $markup, 'add_header_bar_attributes' ) );

		add_action( 'elementor/controls/register', array( $controls, 'register_controls' ) );
		add_action( 'elementor/element/container/section_layout_container/after_section_end', array( $controls, 'add_header_section_controls' ) );

		add_filter( 'arts/fluid_design_system/custom_presets', array( $controls, 'add_header_custom_presets' ) );
	}
}
