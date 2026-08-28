<?php
/**
 * Plugin Name: Artem Semkin Header Engine for Elementor
 * Plugin URI: https://artemsemkin.com/plugins/header-engine-for-elementor/
 * Description: Sticky and auto-hide header for Elementor containers. Hide on scroll down, reveal on scroll up, logo swap, sticky styling. Free, zero dependencies.
 * Version: 1.0.0
 * Author: Artem Semkin
 * Author URI: https://artemsemkin.com
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * Requires Plugins: elementor
 * Text Domain: artem-semkin-header-engine-for-elementor
 * License: GPLv3
 * License URI: https://www.gnu.org/licenses/gpl-3.0
 * Tested up to: 7.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ARTS_HEADER_PLUGIN_VERSION', '1.0.0' );
define( 'ARTS_HEADER_PLUGIN_FILE', __FILE__ );

require_once __DIR__ . '/vendor/autoload.php';

\Arts\HeaderForElementor\Plugin::instance();
