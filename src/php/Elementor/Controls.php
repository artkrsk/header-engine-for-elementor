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
