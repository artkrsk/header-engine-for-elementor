<?php
/**
 * Plugin emitter. Row: {"didAction":0|1} — what did_action('elementor/loaded') reports when the
 * singleton is built. Reports the hooks registered at construction and, when the plugin deferred to
 * `elementor/loaded`, the hooks registered after that action fired. Every hook is checked for a
 * callable callback that accepts enough arguments for its required parameters.
 */

require __DIR__ . '/bootstrap.php';

use Arts\HeaderForElementor\Plugin;

/**
 * @param array<int, array<string, mixed>> $hooks
 * @return array<int, array<string, mixed>>
 */
function arts_test_describe_hooks( array $hooks ): array {
	return array_map(
		function ( array $hook ): array {
			$callback = $hook['callback'];
			$callable = is_callable( $callback );

			if ( $callback instanceof Closure ) {
				$name       = 'Closure';
				$reflection = new ReflectionFunction( $callback );
			} else {
				$name       = substr( strrchr( get_class( $callback[0] ), '\\' ), 1 ) . '::' . $callback[1];
				$reflection = new ReflectionMethod( $callback[0], $callback[1] );
			}

			return array(
				'hook'          => $hook['hook'],
				'callback'      => $name,
				'priority'      => $hook['priority'],
				'accepted_args' => $hook['accepted_args'],
				'callable'      => $callable,
				'args_ok'       => $reflection->getNumberOfRequiredParameters() <= $hook['accepted_args'],
			);
		},
		$hooks
	);
}

arts_test_run_rows(
	function ( array $row ): array {
		arts_test_reset_static( Plugin::class, 'instance', null );
		arts_test_drain_hooks();
		$GLOBALS['arts_test']['did_action']['elementor/loaded'] = $row['didAction'];

		$plugin    = Plugin::instance();
		$raw       = arts_test_drain_hooks();
		$construct = arts_test_describe_hooks( $raw );

		$after_loaded = null;
		if ( array() !== $raw && 'elementor/loaded' === $raw[0]['hook'] ) {
			call_user_func( $raw[0]['callback'] );
			$after_loaded = arts_test_describe_hooks( arts_test_drain_hooks() );
		}

		return array(
			'construct'   => $construct,
			'afterLoaded' => $after_loaded,
			'singleton'   => Plugin::instance() === $plugin && array() === arts_test_drain_hooks(),
		);
	}
);
