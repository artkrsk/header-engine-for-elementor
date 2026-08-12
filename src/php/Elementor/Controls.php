<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Element_Base;
use Elementor\Group_Control_Background;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Group_Control_Css_Filter;

/**
 * Injects the "Create Header" section into the Container's Layout tab plus
 * the sticky-state style sections. Behavior keys the editor-side handler
 * reads via getElementSettings() must be frontend_available — the flag
 * gates its key allowlist and unmarked controls silently resolve undefined.
 */
class Controls {
	/** Wrapper scoped to one editor element. */
	const HEADER_SELECTOR = '.arts-header_elementor-element-{{ID}}';

	/**
	 * "Truly pinned and visible": sticky styles stay off while the auto-hide
	 * reveal is mid-hide (`_scrolling-down`), so the bar restyles only once
	 * it is actually shown in its stuck state.
	 */
	const HEADER_STICKY_SELECTOR = '.arts-header_sticky:not(.arts-header_scrolling-down)' . self::HEADER_SELECTOR;

	const HEADER_STICKY_BAR_SELECTOR = self::HEADER_STICKY_SELECTOR . ' .arts-header__bar';

	const CONDITION_HEADER_ENABLED = array( 'arts_header_enabled!' => '' );

	const CONDITION_HEADER_STICKY_ENABLED = array(
		'arts_header_enabled!'        => '',
		'arts_header_sticky_enabled!' => '',
	);

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
				'condition'          => self::CONDITION_HEADER_ENABLED,
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
				'condition'          => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->start_controls_tabs( 'tabs_theme_header_sticky' );
		$this->add_header_state_non_sticky_tab( $element );
		$this->add_header_state_sticky_tab( $element );
		$element->end_controls_tabs();

		$element->end_controls_section();
	}

	/**
	 * Every control id and CSS var below stays a literal string on purpose —
	 * the phpSync guard greps for them, matching the hand-synced identifier
	 * contract convention (see CLAUDE.md). Don't parameterize.
	 */
	private function add_header_state_non_sticky_tab( Element_Base $element ): void {
		$element->start_controls_tab(
			'tab_arts_header_non_sticky',
			array(
				'label'     => esc_html__( 'Non-Sticky State', 'header-for-elementor' ),
				'condition' => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_non_sticky_logo_version',
			array(
				'label'              => esc_html__( 'Logo to Display', 'header-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'primary'   => esc_html__( 'Primary', 'header-for-elementor' ),
					'secondary' => esc_html__( 'Secondary', 'header-for-elementor' ),
				),
				'default'            => 'primary',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_non_sticky_heading_spacing',
			array(
				'label'     => esc_html__( 'Inner Elements Spacing', 'header-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_responsive_control(
			'arts_header_state_non_sticky_spacing_horizontal',
			array(
				'label'              => esc_html__( 'Horizontal', 'header-for-elementor' ),
				'type'               => Controls_Manager::SLIDER,
				'size_units'         => array( 'px', 'em', 'rem', 'custom' ),
				'range'              => array(
					'px' => array(
						'min'  => 0,
						'max'  => 200,
						'step' => 1,
					),
				),
				'selectors'          => array(
					self::HEADER_SELECTOR => '--arts-header-non-sticky-spacing-horizontal: {{SIZE}}{{UNIT}};',
				),
				'frontend_available' => true,
				'default'            => array(
					'size' => 40,
					'unit' => 'px',
				),
				'desktop_default'    => array(
					'size' => 40,
					'unit' => 'px',
				),
				'render_type'        => 'template',
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_responsive_control(
			'arts_header_state_non_sticky_spacing_vertical',
			array(
				'label'              => esc_html__( 'Vertical', 'header-for-elementor' ),
				'type'               => Controls_Manager::SLIDER,
				'size_units'         => array( 'px', 'em', 'rem', 'custom' ),
				'range'              => array(
					'px' => array(
						'min'  => 0,
						'max'  => 200,
						'step' => 1,
					),
				),
				'selectors'          => array(
					self::HEADER_SELECTOR => '--arts-header-non-sticky-spacing-vertical: {{SIZE}}{{UNIT}};',
				),
				'frontend_available' => true,
				'default'            => array(
					'size' => 30,
					'unit' => 'px',
				),
				'desktop_default'    => array(
					'size' => 30,
					'unit' => 'px',
				),
				'render_type'        => 'template',
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->end_controls_tab();
	}

	private function add_header_state_sticky_tab( Element_Base $element ): void {
		$element->start_controls_tab(
			'tab_arts_header_sticky',
			array(
				'label'     => esc_html__( 'Sticky State', 'header-for-elementor' ),
				'condition' => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_sticky_logo_version',
			array(
				'label'              => esc_html__( 'Logo to Display', 'header-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'primary'   => esc_html__( 'Primary', 'header-for-elementor' ),
					'secondary' => esc_html__( 'Secondary', 'header-for-elementor' ),
				),
				'default'            => 'primary',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_sticky_heading_spacing',
			array(
				'label'     => esc_html__( 'Inner Elements Spacing', 'header-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->add_responsive_control(
			'arts_header_state_sticky_spacing_horizontal',
			array(
				'label'              => esc_html__( 'Horizontal', 'header-for-elementor' ),
				'type'               => Controls_Manager::SLIDER,
				'size_units'         => array( 'px', 'em', 'rem', 'custom' ),
				'range'              => array(
					'px' => array(
						'min'  => 0,
						'max'  => 200,
						'step' => 1,
					),
				),
				'selectors'          => array(
					self::HEADER_SELECTOR => '--arts-header-sticky-spacing-horizontal: {{SIZE}}{{UNIT}};',
				),
				'frontend_available' => true,
				'default'            => array(
					'size' => 40,
					'unit' => 'px',
				),
				'desktop_default'    => array(
					'size' => 40,
					'unit' => 'px',
				),
				'render_type'        => 'template',
				'condition'          => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->add_responsive_control(
			'arts_header_state_sticky_spacing_vertical',
			array(
				'label'              => esc_html__( 'Vertical', 'header-for-elementor' ),
				'type'               => Controls_Manager::SLIDER,
				'size_units'         => array( 'px', 'em', 'rem', 'custom' ),
				'range'              => array(
					'px' => array(
						'min'  => 0,
						'max'  => 200,
						'step' => 1,
					),
				),
				'selectors'          => array(
					self::HEADER_SELECTOR => '--arts-header-sticky-spacing-vertical: {{SIZE}}{{UNIT}};',
				),
				'frontend_available' => true,
				'default'            => array(
					'size' => 30,
					'unit' => 'px',
				),
				'desktop_default'    => array(
					'size' => 30,
					'unit' => 'px',
				),
				'render_type'        => 'template',
				'condition'          => self::CONDITION_HEADER_STICKY_ENABLED,
			)
		);

		$element->end_controls_tab();
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
