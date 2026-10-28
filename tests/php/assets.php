<?php
/**
 * Assets emitter. Row: {"elementor":"no-instance|no-preview|preview-off|preview-on"} — how far the
 * Elementor singleton is built. Reports the register()/enqueue() calls. Pass `--bare` to run
 * without an \Elementor\Plugin class at all.
 */

require __DIR__ . '/bootstrap.php';

use Arts\HeaderForElementor\Elementor\Assets;

arts_test_run_rows(
	function ( array $row ): array {
		if ( class_exists( '\Elementor\Plugin' ) ) {
			Elementor\Plugin::$instance = null;
			if ( 'no-instance' !== $row['elementor'] ) {
				Elementor\Plugin::$instance = new Elementor\Plugin();
				if ( 'no-preview' !== $row['elementor'] ) {
					Elementor\Plugin::$instance->preview       = new Elementor\Preview();
					Elementor\Plugin::$instance->preview->mode = 'preview-on' === $row['elementor'];
				}
			}
		}

		$assets = new Assets();
		$assets->register();
		$assets->enqueue();

		return array( 'calls' => arts_test_drain_calls() );
	}
);
