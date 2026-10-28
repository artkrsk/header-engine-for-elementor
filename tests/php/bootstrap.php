<?php
/**
 * Shared bootstrap for the PHP emitters that tests/ts/php*.test.ts spawn. An emitter reads a JSON
 * array of rows on stdin and prints one JSON line per row; vitest compares the lines to the TS
 * side. The plugin has no composer runtime deps, so a tiny PSR-4 loader stands in for
 * vendor/autoload.php and the suite runs without `composer install`.
 *
 * No PHP 8.1+ syntax here: the plugin's floor is 8.0 and these scripts run on whatever `php` is on PATH.
 */

error_reporting( E_ALL );
ini_set( 'display_errors', 'stderr' );

// A warning inside the plugin is a finding, not noise. Deprecations are PHP-version churn.
set_error_handler(
	function ( int $severity, string $message, string $file, int $line ): bool {
		if ( E_DEPRECATED === $severity || E_USER_DEPRECATED === $severity ) {
			return true;
		}
		throw new ErrorException( $message, 0, $severity, $file, $line );
	}
);

define( 'ABSPATH', __DIR__ . '/' );
define( 'ARTS_HEADER_PLUGIN_VERSION', '9.9.9' );
define( 'ARTS_HEADER_PLUGIN_FILE', '/srv/wp-content/plugins/artem-semkin-header-engine-for-elementor/artem-semkin-header-engine-for-elementor.php' );

spl_autoload_register(
	function ( string $class_name ): void {
		$prefix = 'Arts\\HeaderForElementor\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}
		$path = dirname( __DIR__, 2 ) . '/src/php/' . str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) ) . '.php';
		if ( is_file( $path ) ) {
			require $path;
		}
	}
);

require __DIR__ . '/elementor-fakes.php';

/** Everything the WordPress shims record, plus the knobs the emitters turn per row. */
$GLOBALS['arts_test'] = array(
	'calls'          => array(),
	'hooks'          => array(),
	'did_action'     => array(),
	'current_action' => false,
	'attachments'    => array(),
);

/**
 * @param array<int, mixed> $args
 */
function arts_test_record( string $function, array $args ): void {
	$GLOBALS['arts_test']['calls'][] = array(
		'fn'   => $function,
		'args' => $args,
	);
}

/**
 * Returns the calls recorded since the last drain.
 *
 * @return array<int, array{fn: string, args: array<int, mixed>}>
 */
function arts_test_drain_calls(): array {
	$calls                         = $GLOBALS['arts_test']['calls'];
	$GLOBALS['arts_test']['calls'] = array();

	return $calls;
}

/**
 * Returns the hooks registered since the last drain, each as it would reach WordPress.
 *
 * @return array<int, array<string, mixed>>
 */
function arts_test_drain_hooks(): array {
	$hooks                         = $GLOBALS['arts_test']['hooks'];
	$GLOBALS['arts_test']['hooks'] = array();

	return $hooks;
}

/**
 * Feeds each stdin row to $handler and prints its result as one JSON line.
 */
function arts_test_run_rows( callable $handler ): void {
	$rows = json_decode( (string) stream_get_contents( STDIN ), true );
	if ( ! is_array( $rows ) ) {
		throw new RuntimeException( 'stdin must be a JSON array of rows' );
	}

	foreach ( $rows as $row ) {
		echo json_encode( $handler( $row ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n";
	}
}

/**
 * Sets a private static the plugin keeps between calls (Markup::$primary_id, Plugin::$instance).
 *
 * @param mixed $value
 */
function arts_test_reset_static( string $class_name, string $property, $value = null ): void {
	$reflection = new ReflectionProperty( $class_name, $property );
	if ( PHP_VERSION_ID < 80100 ) {
		$reflection->setAccessible( true );
	}
	$reflection->setValue( null, $value );
}

function wp_json_encode( $data, int $flags = 0, int $depth = 512 ) {
	return json_encode( $data, $flags, $depth );
}

function esc_attr( $text ): string {
	return htmlspecialchars( (string) $text, ENT_QUOTES );
}

function esc_url( $url ): string {
	return (string) $url;
}

function esc_html__( string $text, string $domain = 'default' ): string {
	return $text;
}

function did_action( string $hook_name ): int {
	return $GLOBALS['arts_test']['did_action'][ $hook_name ] ?? 0;
}

function current_action() {
	return $GLOBALS['arts_test']['current_action'];
}

function add_action( string $hook_name, $callback, int $priority = 10, int $accepted_args = 1 ): bool {
	return add_filter( $hook_name, $callback, $priority, $accepted_args );
}

function add_filter( string $hook_name, $callback, int $priority = 10, int $accepted_args = 1 ): bool {
	$GLOBALS['arts_test']['hooks'][] = array(
		'hook'          => $hook_name,
		'callback'      => $callback,
		'priority'      => $priority,
		'accepted_args' => $accepted_args,
	);

	return true;
}

function set_theme_mod( string $name, $value ): void {
	arts_test_record( 'set_theme_mod', array( $name, $value ) );
}

function update_option( string $option, $value ): bool {
	arts_test_record( 'update_option', array( $option, $value ) );

	return true;
}

/** Resolves by integer id like core does, so a numeric string works and a non-numeric one would not. */
function wp_get_attachment_image_url( int $attachment_id, string $size = 'thumbnail' ) {
	arts_test_record( 'wp_get_attachment_image_url', array( $attachment_id, $size ) );

	return $GLOBALS['arts_test']['attachments'][ $attachment_id ] ?? false;
}

function untrailingslashit( string $value ): string {
	return rtrim( $value, '/\\' );
}

function plugin_dir_url( string $file ): string {
	return 'https://example.test/wp-content/plugins/' . basename( dirname( $file ) ) . '/';
}

function wp_register_style( string $handle, string $src, array $deps = array(), $ver = false ): bool {
	arts_test_record( 'wp_register_style', array( $handle, $src, $deps, $ver ) );

	return true;
}

function wp_add_inline_style( string $handle, string $data ): bool {
	arts_test_record( 'wp_add_inline_style', array( $handle, $data ) );

	return true;
}

function wp_register_script( string $handle, string $src, array $deps = array(), $ver = false, $args = array() ): bool {
	arts_test_record( 'wp_register_script', array( $handle, $src, $deps, $ver, $args ) );

	return true;
}

function wp_add_inline_script( string $handle, string $data, string $position = 'after' ): bool {
	arts_test_record( 'wp_add_inline_script', array( $handle, $data, $position ) );

	return true;
}

function wp_enqueue_style( string $handle ): void {
	arts_test_record( 'wp_enqueue_style', array( $handle ) );
}

function wp_enqueue_script( string $handle ): void {
	arts_test_record( 'wp_enqueue_script', array( $handle ) );
}
