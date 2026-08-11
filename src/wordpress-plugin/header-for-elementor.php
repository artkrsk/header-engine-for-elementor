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
