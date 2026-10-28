<?php
/**
 * Backend emitter. Row ops (both report the WordPress and kit calls the Backend made):
 *   {"op":"save","data":{...},"currentAction":"elementor/document/before_save"|false}
 *   {"op":"sync","handler":"secondary|logo|favicon","value":7,"attachments":{"7":"https://…"},"elementor":"kit|no-instance"}
 * Pass `--bare` to run without an \Elementor\Plugin class at all.
 */

require __DIR__ . '/bootstrap.php';

use Arts\HeaderForElementor\Elementor\Backend;
use Elementor\Core\Base\Document;

arts_test_run_rows(
	function ( array $row ): array {
		$backend = new Backend();
		$kits    = new Elementor\Kits_Manager();

		$GLOBALS['arts_test']['current_action'] = $row['currentAction'] ?? false;
		$GLOBALS['arts_test']['attachments']    = $row['attachments'] ?? array();

		if ( class_exists( '\Elementor\Plugin' ) ) {
			Elementor\Plugin::$instance = null;
			if ( 'no-instance' !== ( $row['elementor'] ?? 'kit' ) ) {
				Elementor\Plugin::$instance               = new Elementor\Plugin();
				Elementor\Plugin::$instance->kits_manager = $kits;
			}
		}

		$returned = null;

		if ( 'save' === $row['op'] ) {
			$backend->update_theme_mods_on_site_settings_save( new Document(), $row['data'] );
		} elseif ( 'secondary' === $row['handler'] ) {
			$returned = $backend->handle_secondary_logo_theme_mod( $row['value'], null );
		} elseif ( 'logo' === $row['handler'] ) {
			$returned = $backend->handle_custom_logo_theme_mod( $row['value'], null );
		} else {
			$returned = $backend->handle_favicon_option( $row['value'], null, 'site_icon' );
		}

		return array(
			'returned' => $returned,
			'calls'    => arts_test_drain_calls(),
			'kit'      => $kits->updates,
		);
	}
);
