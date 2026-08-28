<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Core\Base\Document;

/**
 * The secondary-logo storage story: a native Customizer media control backed
 * by the `arts_header_custom_logo_secondary` theme mod, kept in two-way sync
 * with Elementor's kit Site Identity settings (site_logo / site_secondary_logo
 * / site_favicon) so editing from either surface updates both.
 */
class Backend {
	/**
	 * @param \WP_Customize_Manager $wp_customize
	 */
	public function add_customizer_settings( $wp_customize ): void {
		$wp_customize->add_setting(
			'arts_header_custom_logo_secondary',
			array(
				'default'           => '',
				'theme_mod'         => 'image',
				'capability'        => 'edit_theme_options',
				'sanitize_callback' => 'esc_attr',
			)
		);

		$wp_customize->add_control(
			new \WP_Customize_Media_Control(
				$wp_customize,
				'arts_header_custom_logo_secondary',
				array(
					'label'         => esc_html__( 'Secondary Logo', 'artem-semkin-header-engine-for-elementor' ),
					'setting'       => 'arts_header_custom_logo_secondary',
					'priority'      => 8,
					'mime_type'     => 'image',
					'section'       => 'title_tagline',
					'button_labels' => array(
						'select'       => esc_html__( 'Select secondary logo', 'artem-semkin-header-engine-for-elementor' ),
						'change'       => esc_html__( 'Change secondary logo', 'artem-semkin-header-engine-for-elementor' ),
						'remove'       => esc_html__( 'Remove', 'artem-semkin-header-engine-for-elementor' ),
						'default'      => esc_html__( 'Default', 'artem-semkin-header-engine-for-elementor' ),
						'placeholder'  => esc_html__( 'No secondary logo selected', 'artem-semkin-header-engine-for-elementor' ),
						'frame_title'  => esc_html__( 'Select secondary logo', 'artem-semkin-header-engine-for-elementor' ),
						'frame_button' => esc_html__( 'Choose secondary logo', 'artem-semkin-header-engine-for-elementor' ),
					),
				)
			)
		);
	}

	/**
	 * Kit → WordPress direction, fired on every Elementor document save.
	 *
	 * @param Document             $document
	 * @param array<string, mixed> $data
	 */
	public function update_theme_mods_on_site_settings_save( Document $document, $data ): void {
		if ( ! is_array( $data ) || ! isset( $data['settings'] ) || ! is_array( $data['settings'] ) ) {
			return;
		}

		$settings = $data['settings'];

		if ( ! isset( $settings['post_status'] ) || Document::STATUS_PUBLISH !== $settings['post_status'] ) {
			return;
		}

		// Defensive re-entrancy guard: bail if a kit save is ever re-fired from
		// inside the reverse-direction sync — the set_theme_mod() calls below
		// would loop back through this handler. Covers the two
		// pre_set_theme_mod_* filters; the favicon one runs on
		// pre_update_option_site_icon, which these prefixes do not match — that
		// path is held instead by Elementor's own is_saving() kit check.
		$current_action = current_action();
		if ( is_string( $current_action ) &&
			( strpos( $current_action, 'update_option_' ) === 0 ||
				strpos( $current_action, 'update_theme_mod_' ) === 0 ||
				strpos( $current_action, 'pre_set_theme_mod_' ) === 0 )
		) {
			return;
		}

		if ( isset( $settings['site_favicon'] ) && is_array( $settings['site_favicon'] ) && isset( $settings['site_favicon']['id'] ) ) {
			update_option( 'site_icon', $settings['site_favicon']['id'] );
		}

		if ( isset( $settings['site_logo'] ) && is_array( $settings['site_logo'] ) && isset( $settings['site_logo']['id'] ) ) {
			set_theme_mod( 'custom_logo', $settings['site_logo']['id'] );
		}

		if ( isset( $settings['site_secondary_logo'] ) && is_array( $settings['site_secondary_logo'] ) && isset( $settings['site_secondary_logo']['id'] ) ) {
			set_theme_mod( 'arts_header_custom_logo_secondary', $settings['site_secondary_logo']['id'] );
		}
	}

	/**
	 * @param mixed $value
	 * @param mixed $old_value
	 * @return mixed
	 */
	public function handle_custom_logo_theme_mod( $value, $old_value ) {
		$this->sync_value_to_elementor_site_settings( $value, 'site_logo' );
		return $value;
	}

	/**
	 * @param mixed $value
	 * @param mixed $old_value
	 * @return mixed
	 */
	public function handle_secondary_logo_theme_mod( $value, $old_value ) {
		$this->sync_value_to_elementor_site_settings( $value, 'site_secondary_logo' );
		return $value;
	}

	/**
	 * @param mixed  $value
	 * @param mixed  $old_value
	 * @param string $option
	 * @return mixed
	 */
	public function handle_favicon_option( $value, $old_value, $option ) {
		$this->sync_value_to_elementor_site_settings( $value, 'site_favicon' );
		return $value;
	}

	/**
	 * WordPress → kit direction. update_kit_settings_based_on_option() goes
	 * through Document::update_settings() → save_settings(), never save(), so
	 * it cannot re-fire elementor/document/before_save — no loop through the
	 * handler above.
	 *
	 * @param mixed $value The attachment id.
	 */
	private function sync_value_to_elementor_site_settings( $value, string $elementor_option ): void {
		if ( ! class_exists( '\Elementor\Plugin' ) || ! \Elementor\Plugin::$instance ) {
			return;
		}

		$url = is_int( $value ) ? wp_get_attachment_image_url( $value, 'full' ) : '';

		if ( $url === false ) {
			$url = '';
		}

		\Elementor\Plugin::$instance->kits_manager->update_kit_settings_based_on_option(
			$elementor_option,
			array(
				'id'  => $value,
				'url' => $url,
			)
		);
	}
}
