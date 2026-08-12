<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Element_Base;

/**
 * Injects the "Create Header" section into the Container's Layout tab.
 * All behavior keys are frontend_available — the editor-side handler
 * reads them via getElementSettings(), which silently drops any control
 * missing that flag.
 */
class Controls {
	public function register_controls( Controls_Manager $controls_manager ): void {
		$controls_manager->register( MediaPreviewOnlyControl::instance() );
	}

	/**
	 * Inject the secondary-logo picker into the kit's Site Identity section,
	 * right after the native site_logo control. The hook fires for EVERY
	 * section of every element — the section-id early exit is load-bearing.
	 *
	 * @param \Elementor\Controls_Stack $controls_stack
	 */
	public function add_site_settings_secondary_logo( $controls_stack, string $section_id ): void {
		if ( $section_id !== 'section_settings-site-identity' ) {
			return;
		}

		if ( ! $controls_stack instanceof \Elementor\Controls_Stack ) {
			return;
		}

		$should_include_svg_inline_option = ! \Elementor\Core\Files\Uploads_Manager::are_unfiltered_uploads_enabled();

		$secondary_logo_id_mixed = get_theme_mod( 'arts_header_custom_logo_secondary' );
		$secondary_logo_id       = is_numeric( $secondary_logo_id_mixed ) ? (int) $secondary_logo_id_mixed : 0;
		$secondary_logo_src      = '';

		if ( $secondary_logo_id > 0 ) {
			$logo_src_result = wp_get_attachment_image_src( $secondary_logo_id, 'full' );
			if ( is_array( $logo_src_result ) && isset( $logo_src_result[0] ) ) {
				$secondary_logo_src = $logo_src_result[0];
			}
		}

		$controls_stack->start_injection(
			array(
				'of' => 'site_logo',
				'at' => 'after',
			)
		);

		$controls_stack->add_control(
			'site_secondary_logo',
			array(
				'label'                            => esc_html__( 'Site Secondary Logo', 'header-for-elementor' ),
				'type'                             => Controls_Manager::MEDIA,
				'should_include_svg_inline_option' => $should_include_svg_inline_option,
				'default'                          => array(
					'id'  => $secondary_logo_id,
					'url' => $secondary_logo_src,
				),
				'description'                      => sprintf(
					/* translators: 1: Width number pixel, 2: Height number pixel. */
					esc_html__( 'Suggested image dimensions: %1$s × %2$s pixels.', 'header-for-elementor' ),
					'350',
					'100'
				),
				'export'                           => false,
				'ai'                               => array(
					'active'   => true,
					'type'     => 'media',
					'category' => 'vector',
				),
			)
		);

		$controls_stack->end_injection();
	}

	public function add_header_section_controls( Element_Base $element ): void {
		$element->start_controls_section(
			'arts_header_section',
			array(
				'label' => esc_html__( 'Create Header', 'header-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$element->add_control(
			'arts_header_enabled',
			array(
				'label'              => sprintf(
					'<strong>%1$s %2$s %3$s</strong>',
					esc_html__( 'Use this', 'header-for-elementor' ),
					$element->get_title(),
					esc_html__( 'as Page Header', 'header-for-elementor' )
				),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => '',
				'frontend_available' => true,
			)
		);

		$element->add_control(
			'arts_header_sticky_enabled',
			array(
				'label'              => esc_html__( 'Enable Sticky Effect', 'header-for-elementor' ),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => 'yes',
				'frontend_available' => true,
				'condition'          => array( 'arts_header_enabled!' => '' ),
			)
		);

		$element->add_control(
			'arts_header_sticky_toggle_reveal_enabled',
			array(
				'label'              => esc_html__( 'Toggle Reveal on Scroll', 'header-for-elementor' ),
				'description'        => esc_html__( 'Hide the top bar when scrolling down and reveal it when scrolling up.', 'header-for-elementor' ),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => 'yes',
				'frontend_available' => true,
				'condition'          => array(
					'arts_header_enabled!'        => '',
					'arts_header_sticky_enabled!' => '',
				),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * Expose the engine-written height vars as pickable values in the Fluid
	 * Design System dropdown. A silent no-op when that plugin is absent.
	 * Only globally-inherited vars belong here (both are set on <html>);
	 * never register --arts-header-release-top — it is scoped to the header
	 * subtree and would silently fail to resolve elsewhere.
	 *
	 * @param array<int, array<string, mixed>> $result
	 * @return array<int, array<string, mixed>>
	 */
	public function add_header_custom_presets( $result ): array {
		$result[] = array(
			'name'  => esc_html__( 'Header Presets', 'header-for-elementor' ),
			'value' => array(
				array(
					'id'    => 'arts-header-height',
					'value' => 'var(--arts-header-height)',
					'title' => esc_html__( 'Header Current Height', 'header-for-elementor' ),
				),
				array(
					'id'    => 'arts-header-height-non-sticky',
					'value' => 'var(--arts-header-height-non-sticky)',
					'title' => esc_html__( 'Header Height (Non-Sticky)', 'header-for-elementor' ),
				),
			),
		);

		return $result;
	}
}
