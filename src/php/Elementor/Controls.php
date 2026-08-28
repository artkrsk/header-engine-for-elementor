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
	 * "Visible and stuck": reserved for styling that paints OUTSIDE the bar's
	 * box — box-shadow only. A hidden bar sits at `translateY(-100%)`, where an
	 * outside-the-box shadow would still bleed a sliver into the viewport, so
	 * the shadow fades out with the hide leg. Everything in-box belongs on the
	 * state selector below — scoping in-box styles here makes them flash back
	 * to the rest state while the bar visibly slides out.
	 */
	const HEADER_STICKY_SELECTOR = '.arts-header_sticky:not(.arts-header_scrolling-down)' . self::HEADER_SELECTOR;

	const HEADER_STICKY_BAR_SELECTOR = self::HEADER_STICKY_SELECTOR . ' .arts-header__bar';

	/**
	 * "Pseudo sticky": tracks `_sticky` alone — a hiding or locked bar is still
	 * sticky. The default scope for ALL in-box sticky styling (padding,
	 * backgrounds, borders, the recolor): clipped off-screen once hidden, so
	 * the styles ride the hide/reveal slide instead of flashing back to rest.
	 * The extra `.arts-header` class out-specifies the native controls'
	 * `.elementor-{post} .elementor-element.elementor-element-{id}`.
	 */
	const HEADER_STICKY_STATE_SELECTOR = '.arts-header.arts-header_sticky' . self::HEADER_SELECTOR;

	const HEADER_STICKY_STATE_BAR_SELECTOR = self::HEADER_STICKY_STATE_SELECTOR . ' .arts-header__bar';

	const CONDITION_HEADER_ENABLED = array( 'arts_header_enabled!' => '' );

	const CONDITION_HEADER_SCROLL_ENABLED = array(
		'arts_header_enabled!'   => '',
		'arts_header_on_scroll!' => '',
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
				'label'                            => esc_html__( 'Site Secondary Logo', 'artem-semkin-header-engine-for-elementor' ),
				'type'                             => Controls_Manager::MEDIA,
				'should_include_svg_inline_option' => $should_include_svg_inline_option,
				'default'                          => array(
					'id'  => $secondary_logo_id,
					'url' => $secondary_logo_src,
				),
				'description'                      => sprintf(
					/* translators: 1: Width number pixel, 2: Height number pixel. */
					esc_html__( 'Suggested image dimensions: %1$s × %2$s pixels.', 'artem-semkin-header-engine-for-elementor' ),
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
				'label' => esc_html__( 'Create Header', 'artem-semkin-header-engine-for-elementor' ),
				'tab'   => Controls_Manager::TAB_LAYOUT,
			)
		);

		$element->add_control(
			'arts_header_enabled',
			array(
				'label'              => sprintf(
					'<strong>%1$s %2$s %3$s</strong>',
					esc_html__( 'Use this', 'artem-semkin-header-engine-for-elementor' ),
					$element->get_title(),
					esc_html__( 'as Page Header', 'artem-semkin-header-engine-for-elementor' )
				),
				'type'               => Controls_Manager::SWITCHER,
				'default'            => '',
				'frontend_available' => true,
				// Hand-synced mirror of the bar transition in `_modes.scss`: Elementor's generic
				// `.elementor-element` transition shorthand is unlayered and beats the engine's
				// layered rule, so the longhands are re-emitted here — they land in Elementor's
				// generated per-element CSS, where specificity wins the unlayered fight.
				'selectors'          => array(
					'{{WRAPPER}}'                => 'transition-property: background, box-shadow, border-color, border-width, border-radius, opacity, padding; transition-duration: var(--spacing-transition, 0.3s); transition-timing-function: ease;',
					// A boxed container applies its vertical padding on the child .e-con-inner.
					'{{WRAPPER}} > .e-con-inner' => 'transition-property: padding; transition-duration: var(--spacing-transition, 0.3s); transition-timing-function: ease;',
				),
			)
		);

		$element->add_control(
			'arts_header_position',
			array(
				'label'              => esc_html__( 'Position', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'flow'   => esc_html__( 'Default', 'artem-semkin-header-engine-for-elementor' ),
					''       => esc_html__( 'Top', 'artem-semkin-header-engine-for-elementor' ),
					'bottom' => esc_html__( 'Bottom', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => '',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_on_scroll',
			array(
				'label'              => esc_html__( 'On Scroll', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					''          => esc_html__( 'None', 'artem-semkin-header-engine-for-elementor' ),
					'sticky'    => esc_html__( 'Sticky', 'artem-semkin-header-engine-for-elementor' ),
					'auto-hide' => esc_html__( 'Sticky & Auto-Hide', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => 'auto-hide',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_stick_to',
			array(
				'label'              => esc_html__( 'Stick To', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					''       => esc_html__( 'Top', 'artem-semkin-header-engine-for-elementor' ),
					'bottom' => esc_html__( 'Bottom', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => '',
				'frontend_available' => true,
				'condition'          => array_merge(
					self::CONDITION_HEADER_SCROLL_ENABLED,
					array( 'arts_header_position' => 'flow' )
				),
			)
		);

		// Both pin controls write --arts-header-pin-offset: the distance from the pinned edge.
		// The engine never reads the var itself — it reads the wrapper's RESULTING computed
		// top/bottom at measure time, so custom offsets keep stick detection exact. Negative
		// values pin above the viewport top (compact-header: a tall bar keeping a strip visible).
		$element->add_control(
			'arts_header_pin_offset_preset',
			array(
				'label'                => esc_html__( 'Pin Offset', 'artem-semkin-header-engine-for-elementor' ),
				'type'                 => Controls_Manager::SELECT,
				'options'              => array(
					''                  => esc_html__( 'Custom', 'artem-semkin-header-engine-for-elementor' ),
					'header'            => esc_html__( 'Header Current Height', 'artem-semkin-header-engine-for-elementor' ),
					'header-non-sticky' => esc_html__( 'Header Height (Non-Sticky)', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'              => '',
				'selectors_dictionary' => array(
					// Current height publishes at the bar's transition ENDPOINTS (per-frame root
					// var writes recalc the page) — a stacked panel hugs the shrink by
					// transitioning its own consuming property. The fallback covers pre-boot,
					// where only the non-sticky var is seeded.
					'header'            => 'var(--arts-header-height, var(--arts-header-height-non-sticky))',
					'header-non-sticky' => 'var(--arts-header-height-non-sticky)',
				),
				'selectors'            => array(
					self::HEADER_SELECTOR => '--arts-header-pin-offset: {{VALUE}};',
				),
				'render_type'          => 'template',
				'condition'            => array_merge(
					self::CONDITION_HEADER_SCROLL_ENABLED,
					array( 'arts_header_position!' => 'bottom' )
				),
			)
		);

		$element->add_responsive_control(
			'arts_header_pin_offset',
			array(
				'label'       => esc_html__( 'Offset', 'artem-semkin-header-engine-for-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => array( 'px' ),
				'range'       => array(
					'px' => array(
						'min'  => -300,
						'max'  => 300,
						'step' => 1,
					),
				),
				'default'     => array(
					'size' => 0,
					'unit' => 'px',
				),
				'selectors'   => array(
					self::HEADER_SELECTOR => '--arts-header-pin-offset: {{SIZE}}{{UNIT}};',
				),
				'render_type' => 'template',
				'condition'   => array_merge(
					self::CONDITION_HEADER_SCROLL_ENABLED,
					array(
						'arts_header_position!'         => 'bottom',
						'arts_header_pin_offset_preset' => '',
					)
				),
			)
		);

		// Both offset controls write the --arts-header-reveal-offset var (the engine registers it
		// as a <length> and reads the RESOLVED px value at measure time) — so px is responsive via
		// Elementor's own breakpoint pipeline, and the presets are just var values.
		$element->add_control(
			'arts_header_sticky_reveal_offset_preset',
			array(
				'label'                => esc_html__( 'Reveal Offset', 'artem-semkin-header-engine-for-elementor' ),
				'description'          => esc_html__( 'Scroll distance past the sticky point before the bar starts hiding.', 'artem-semkin-header-engine-for-elementor' ),
				'type'                 => Controls_Manager::SELECT,
				'options'              => array(
					''         => esc_html__( 'Custom', 'artem-semkin-header-engine-for-elementor' ),
					'viewport' => esc_html__( 'Viewport Height', 'artem-semkin-header-engine-for-elementor' ),
					'header'   => esc_html__( 'Header Height', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'              => '',
				'selectors_dictionary' => array(
					'viewport' => '100vh',
					'header'   => 'var(--arts-header-height-non-sticky)',
				),
				'selectors'            => array(
					self::HEADER_SELECTOR => '--arts-header-reveal-offset: {{VALUE}};',
				),
				'render_type'          => 'template',
				'condition'            => array_merge(
					self::CONDITION_HEADER_ENABLED,
					array( 'arts_header_on_scroll' => 'auto-hide' )
				),
			)
		);

		$element->add_responsive_control(
			'arts_header_sticky_reveal_offset',
			array(
				'label'       => esc_html__( 'Offset', 'artem-semkin-header-engine-for-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => array( 'px' ),
				'range'       => array(
					'px' => array(
						'min'  => 0,
						'max'  => 500,
						'step' => 1,
					),
				),
				'default'     => array(
					'size' => 0,
					'unit' => 'px',
				),
				'selectors'   => array(
					self::HEADER_SELECTOR => '--arts-header-reveal-offset: {{SIZE}}{{UNIT}};',
				),
				'render_type' => 'template',
				'condition'   => array_merge(
					self::CONDITION_HEADER_ENABLED,
					array(
						'arts_header_on_scroll' => 'auto-hide',
						'arts_header_sticky_reveal_offset_preset' => '',
					)
				),
			)
		);

		$this->add_header_state_controls( $element );

		// Lives here rather than the Advanced-tab Layout section its target
		// control (native padding) belongs to; its selectors aim at
		// {{WRAPPER}}, so the hosting section is irrelevant.
		// Not a real setting: a hidden carrier whose selectors emit the transition CSS
		// (same pattern as Pro's hidden_header_footer_style_control).
		$element->add_control(
			'arts-header-padding-transition',
			array(
				'type'       => Controls_Manager::HIDDEN,
				'default'    => 'yes',
				'conditions' => $this->generate_fluid_control_conditions( 'padding' ),
				'selectors'  => array(
					'{{WRAPPER}}' => 'transition: padding var(--spacing-transition,.3s), margin var(--spacing-transition,.3s), background var(--background-transition,.3s), border var(--border-transition,.3s), box-shadow var(--border-transition,.3s), transform var(--e-con-transform-transition-duration,.4s)',
				),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * The inverse of Create Header: marks CONTENT the header reacts to. Injected into every
	 * Container that is NOT a header (a container is either a header or a zone, never both).
	 * The keys are PHP-rendered as data attributes (see Markup::add_zone_attributes); the
	 * engine's body-wide MutationObserver picks up editor re-renders — no editor JS involved.
	 */
	public function add_header_zone_section_controls( Element_Base $element ): void {
		$element->start_controls_section(
			'arts_header_zone_section',
			array(
				'label'     => esc_html__( 'Header Zone', 'artem-semkin-header-engine-for-elementor' ),
				'tab'       => Controls_Manager::TAB_LAYOUT,
				'condition' => array( 'arts_header_enabled' => '' ),
			)
		);

		$element->add_control(
			'arts_header_zone',
			array(
				'label'              => esc_html__( 'While Scrolling Over This', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					''     => esc_html__( 'None', 'artem-semkin-header-engine-for-elementor' ),
					'hide' => esc_html__( 'Hide Header', 'artem-semkin-header-engine-for-elementor' ),
					'lock' => esc_html__( 'Reveal & Lock Header', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => '',
				'frontend_available' => true,
				'render_type'        => 'template',
			)
		);

		$element->add_control(
			'arts_header_zone_geometry',
			array(
				'label'              => esc_html__( 'Zone Counts When', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'at-top'  => esc_html__( 'It Reaches the Top', 'artem-semkin-header-engine-for-elementor' ),
					'overlap' => esc_html__( 'It Overlaps the Header', 'artem-semkin-header-engine-for-elementor' ),
					'in-view' => esc_html__( 'It Is In View', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => 'at-top',
				'frontend_available' => true,
				'render_type'        => 'template',
				'condition'          => array( 'arts_header_zone!' => '' ),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * Flat per-state controls — no tabs: after the spacing sliders moved to
	 * native Padding / Sticky Padding, two tabs wrapping one select each read
	 * as an empty panel. Every control id and CSS var below stays a literal
	 * string on purpose — the phpSync guard greps for them, matching the
	 * hand-synced identifier contract convention (see CLAUDE.md).
	 */
	private function add_header_state_controls( Element_Base $element ): void {
		$element->add_control(
			'arts_header_logo_heading',
			array(
				'label'     => esc_html__( 'Dual Logo', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_non_sticky_logo_version',
			array(
				'label'              => esc_html__( 'Logo', 'artem-semkin-header-engine-for-elementor' ),
				'description'        => esc_html__( 'Applies to the Dual Site Logo widget inside this header. The Secondary option needs a secondary logo set in the widget\'s Site Identity section.', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'primary'   => esc_html__( 'Primary', 'artem-semkin-header-engine-for-elementor' ),
					'secondary' => esc_html__( 'Secondary', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => 'primary',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_state_sticky_logo_version',
			array(
				'label'              => esc_html__( 'Logo While Sticky', 'artem-semkin-header-engine-for-elementor' ),
				'type'               => Controls_Manager::SELECT,
				'options'            => array(
					'primary'   => esc_html__( 'Primary', 'artem-semkin-header-engine-for-elementor' ),
					'secondary' => esc_html__( 'Secondary', 'artem-semkin-header-engine-for-elementor' ),
				),
				'default'            => 'primary',
				'frontend_available' => true,
				'condition'          => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_control(
			'arts_header_sticky_global_colors_heading',
			array(
				'label'     => esc_html__( 'Sticky Colors', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$global_colors_repeater = new \Elementor\Repeater();

		$global_colors_repeater->add_control(
			'global_id',
			array(
				'label'   => esc_html__( 'Global Color', 'artem-semkin-header-engine-for-elementor' ),
				'type'    => Controls_Manager::SELECT,
				'options' => $this->get_kit_global_color_options(),
				'default' => '',
			)
		);

		// The override value deliberately can't be a global itself (mirrors the
		// kit's own Global Colors repeater) — a global defined via a global the
		// bar may also remap would be a resolution cycle.
		$global_colors_repeater->add_control(
			'sticky_color',
			array(
				'label'     => esc_html__( 'Color While Sticky', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'global'    => array( 'active' => false ),
				'selectors' => array(
					self::HEADER_STICKY_STATE_BAR_SELECTOR => '--e-global-color-{{global_id.VALUE}}: {{VALUE}};',
				),
			)
		);

		// Remaps Elementor Global Colors within the stuck bar: the kit defines
		// `--e-global-color-{id}` on body, widgets consume it via var(), and a
		// custom property resolves from the nearest ancestor that defines it —
		// so redefining it here re-colors every widget inside the header that
		// uses that global, with no per-widget wiring. Same repeater-selector
		// idiom as the kit's own Global Colors panel (`{{_id.VALUE}}`).
		$element->add_control(
			'arts_header_sticky_global_colors',
			array(
				'label'         => esc_html__( 'Recolor While Sticky', 'artem-semkin-header-engine-for-elementor' ),
				'description'   => esc_html__( 'Widgets inside this header that use a Global Color switch to the override while the header is sticky. Hardcoded colors are not affected.', 'artem-semkin-header-engine-for-elementor' ),
				'type'          => Controls_Manager::REPEATER,
				'fields'        => $global_colors_repeater->get_controls(),
				'prevent_empty' => false,
				'title_field'   => '{{{ global_id }}}',
				'condition'     => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);
	}

	/**
	 * The active kit's Global Colors (system + custom) as SELECT options.
	 * Safe at control-registration time: the kit document and its parsed
	 * settings are request-memoized by Elementor, and this is not the
	 * group-control-singleton reentrancy core warns about.
	 *
	 * @return array<string, string>
	 */
	private function get_kit_global_color_options(): array {
		$options = array( '' => esc_html__( 'Select…', 'artem-semkin-header-engine-for-elementor' ) );

		if ( ! class_exists( '\Elementor\Plugin' ) || ! \Elementor\Plugin::$instance || ! \Elementor\Plugin::$instance->kits_manager ) {
			return $options;
		}

		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();

		if ( ! $kit instanceof \Elementor\Core\Kits\Documents\Kit ) {
			return $options;
		}

		$system_colors = $kit->get_settings_for_display( 'system_colors' );
		$custom_colors = $kit->get_settings_for_display( 'custom_colors' );
		$rows          = array_merge(
			is_array( $system_colors ) ? $system_colors : array(),
			is_array( $custom_colors ) ? $custom_colors : array()
		);

		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) || ! isset( $row['_id'] ) || ! is_string( $row['_id'] ) || '' === $row['_id'] ) {
				continue;
			}
			$title                  = isset( $row['title'] ) && is_string( $row['title'] ) && '' !== $row['title'] ? $row['title'] : $row['_id'];
			$options[ $row['_id'] ] = $title;
		}

		return $options;
	}

	/**
	 * Sticky-only padding: injected into the Container's Advanced → Layout
	 * section next to the native Padding control. Writes the same
	 * `--padding-*` custom properties the native control does (they inherit
	 * into a boxed container's `.e-con-inner`, which carries the vertical
	 * padding) through HEADER_STICKY_STATE_BAR_SELECTOR — sticky alone, no
	 * `:not(_scrolling-down)`: a hiding or locked bar keeps its sticky padding.
	 * Native-control quirk applies: all four sides must be filled or the rule
	 * emits nothing (an empty control cleanly falls through to native padding).
	 */
	public function add_header_sticky_layout_controls( Element_Base $element ): void {
		$element->add_control(
			'padding_sticky_heading',
			array(
				'label'     => esc_html__( 'Sticky Header Styles', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_responsive_control(
			'padding_sticky',
			array(
				'label'       => esc_html__( 'Padding', 'artem-semkin-header-engine-for-elementor' ),
				'description' => esc_html__( 'For the sticky header. Falls back to the regular Padding when empty.', 'artem-semkin-header-engine-for-elementor' ),
				'type'        => Controls_Manager::DIMENSIONS,
				'size_units'  => array( 'px', '%', 'em', 'rem', 'vw', 'custom' ),
				'selectors'   => array(
					self::HEADER_STICKY_STATE_BAR_SELECTOR => '--padding-top: {{TOP}}{{UNIT}}; --padding-bottom: {{BOTTOM}}{{UNIT}}; --padding-left: {{LEFT}}{{UNIT}}; --padding-right: {{RIGHT}}{{UNIT}};',
				),
				'condition'   => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);
	}

	/**
	 * Sticky-only background: injected into the Container's own Background
	 * section, applies through the sticky-state bar selector so it holds
	 * through the hide/reveal slide.
	 */
	public function add_header_sticky_background_controls( Element_Base $element ): void {
		$header_sticky_bar_selector = self::HEADER_STICKY_STATE_BAR_SELECTOR;

		$element->add_control(
			'background_sticky_heading',
			array(
				'label'     => esc_html__( 'Sticky Header Styles', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'           => 'background_sticky',
				'types'          => array( 'classic', 'gradient' ),
				'selector'       => "{$header_sticky_bar_selector}:not(.elementor-motion-effects-element-type-background), {$header_sticky_bar_selector} > .elementor-motion-effects-container > .elementor-motion-effects-layer",
				'fields_options' => array(
					'background' => array(
						'description'        => esc_html__( 'For the sticky header', 'artem-semkin-header-engine-for-elementor' ),
						'frontend_available' => true,
					),
				),
				'condition'      => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);
	}

	/** Sticky-only background overlay, CSS filters, and blend mode on the bar's ::before layers. */
	public function add_header_sticky_background_overlay_controls( Element_Base $element ): void {
		$header_sticky_bar_selector  = self::HEADER_STICKY_STATE_BAR_SELECTOR;
		$background_overlay_selector = "{$header_sticky_bar_selector}::before, {$header_sticky_bar_selector} > .elementor-background-video-container::before, {$header_sticky_bar_selector} > .e-con-inner > .elementor-background-video-container::before, {$header_sticky_bar_selector} > .elementor-background-slideshow::before, {$header_sticky_bar_selector} > .e-con-inner > .elementor-background-slideshow::before, {$header_sticky_bar_selector} > .elementor-motion-effects-container > .elementor-motion-effects-layer::before";

		$overlay_present_conditions = array(
			'relation' => 'and',
			'terms'    => array(
				array(
					'relation' => 'and',
					'terms'    => array(
						array(
							'name'     => 'arts_header_enabled',
							'operator' => '===',
							'value'    => 'yes',
						),
						array(
							'name'     => 'arts_header_on_scroll',
							'operator' => '!==',
							'value'    => '',
						),
					),
				),
				array(
					'relation' => 'or',
					'terms'    => array(
						array(
							'name'     => 'background_overlay_sticky_image[url]',
							'operator' => '!==',
							'value'    => '',
						),
						array(
							'name'     => 'background_overlay_sticky_color',
							'operator' => '!==',
							'value'    => '',
						),
					),
				),
			),
		);

		$element->add_control(
			'background_overlay_sticky_heading',
			array(
				'label'     => esc_html__( 'Sticky Header Styles', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_group_control(
			Group_Control_Background::get_type(),
			array(
				'name'           => 'background_overlay_sticky',
				'selector'       => $background_overlay_selector,
				'fields_options' => array(
					'background' => array(
						'selectors' => array(
							// Sets the ::before content so the pseudo-element renders only
							// when a background overlay is actually configured.
							$background_overlay_selector => '--background-overlay: \'\';',
						),
					),
				),
				'condition'      => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_responsive_control(
			'background_overlay_opacity_sticky',
			array(
				'label'     => esc_html__( 'Opacity', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'default'   => array(
					'size' => .5,
				),
				'range'     => array(
					'px' => array(
						'max'  => 1,
						'step' => 0.01,
					),
				),
				'selectors' => array(
					$header_sticky_bar_selector => '--overlay-opacity: {{SIZE}};',
				),
				'condition' => array_merge(
					self::CONDITION_HEADER_SCROLL_ENABLED,
					array( 'background_overlay_sticky_background' => array( 'classic', 'gradient' ) )
				),
			)
		);

		$element->add_group_control(
			Group_Control_Css_Filter::get_type(),
			array(
				'name'       => 'css_filters_sticky',
				'selector'   => "{$header_sticky_bar_selector}::before",
				'conditions' => $overlay_present_conditions,
			)
		);

		$element->add_control(
			'overlay_blend_mode_sticky',
			array(
				'label'      => esc_html__( 'Blend Mode', 'artem-semkin-header-engine-for-elementor' ),
				'type'       => Controls_Manager::SELECT,
				'options'    => array(
					''            => esc_html__( 'Normal', 'artem-semkin-header-engine-for-elementor' ),
					'multiply'    => esc_html__( 'Multiply', 'artem-semkin-header-engine-for-elementor' ),
					'screen'      => esc_html__( 'Screen', 'artem-semkin-header-engine-for-elementor' ),
					'overlay'     => esc_html__( 'Overlay', 'artem-semkin-header-engine-for-elementor' ),
					'darken'      => esc_html__( 'Darken', 'artem-semkin-header-engine-for-elementor' ),
					'lighten'     => esc_html__( 'Lighten', 'artem-semkin-header-engine-for-elementor' ),
					'color-dodge' => esc_html__( 'Color Dodge', 'artem-semkin-header-engine-for-elementor' ),
					'saturation'  => esc_html__( 'Saturation', 'artem-semkin-header-engine-for-elementor' ),
					'color'       => esc_html__( 'Color', 'artem-semkin-header-engine-for-elementor' ),
					'luminosity'  => esc_html__( 'Luminosity', 'artem-semkin-header-engine-for-elementor' ),
				),
				'selectors'  => array(
					$header_sticky_bar_selector => '--overlay-mix-blend-mode: {{VALUE}}',
				),
				'conditions' => $overlay_present_conditions,
			)
		);
	}

	/** Sticky-only border, radius, and box shadow on the bar. */
	public function add_header_sticky_border_controls( Element_Base $element ): void {
		$header_sticky_bar_selector = self::HEADER_STICKY_STATE_BAR_SELECTOR;

		$element->add_control(
			'border_sticky_heading',
			array(
				'label'     => esc_html__( 'Sticky Header Styles', 'artem-semkin-header-engine-for-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'           => 'border_sticky',
				'selector'       => $header_sticky_bar_selector,
				'fields_options' => array(
					'width'  => array(
						'selectors' => array(
							'{{SELECTOR}}' => 'border-width: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}}; --border-top-width: {{TOP}}{{UNIT}}; --border-right-width: {{RIGHT}}{{UNIT}}; --border-bottom-width: {{BOTTOM}}{{UNIT}}; --border-left-width: {{LEFT}}{{UNIT}};',
						),
					),
					'color'  => array(
						'selectors' => array(
							'{{SELECTOR}}' => 'border-color: {{VALUE}}; --border-color: {{VALUE}};',
						),
					),
					'border' => array(
						'selectors' => array(
							'{{SELECTOR}}' => 'border-style: {{VALUE}}; --border-style: {{VALUE}};',
						),
					),
				),
				'condition'      => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_responsive_control(
			'border_radius_sticky',
			array(
				'label'      => esc_html__( 'Border Radius', 'artem-semkin-header-engine-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem', 'custom' ),
				'selectors'  => array(
					$header_sticky_bar_selector => '--border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
				'condition'  => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);

		$element->add_group_control(
			Group_Control_Box_Shadow::get_type(),
			array(
				'name'      => 'box_shadow_sticky',
				// The one deliberate visible-scope user: shadow paints outside
				// the box and would bleed into the viewport while hidden.
				'selector'  => self::HEADER_STICKY_BAR_SELECTOR,
				'condition' => self::CONDITION_HEADER_SCROLL_ENABLED,
			)
		);
	}

	/**
	 * Expose header vars as pickable values in the Fluid Design System
	 * dropdown. A silent no-op when that plugin is absent. The two
	 * engine-written height vars (set on <html>, so they resolve page-wide).
	 * The test for adding one is whether the var resolves wherever its preset
	 * will be applied; --arts-header-release-top fails it and must stay out.
	 *
	 * @param array<int, array<string, mixed>> $result
	 * @return array<int, array<string, mixed>>
	 */
	public function add_header_custom_presets( $result ): array {
		$result[] = array(
			'name'  => esc_html__( 'Header Presets', 'artem-semkin-header-engine-for-elementor' ),
			'value' => $this->get_header_presets(),
		);

		return $result;
	}

	/**
	 * The pickable header presets — also the source of truth for the fluid
	 * transition conditions, which derive their var list from these values.
	 *
	 * @return array<int, array<string, string>>
	 */
	private function get_header_presets(): array {
		return array(
			array(
				'id'    => 'arts-header-height',
				'value' => 'var(--arts-header-height)',
				'title' => esc_html__( 'Header Current Height', 'artem-semkin-header-engine-for-elementor' ),
			),
			array(
				'id'    => 'arts-header-height-non-sticky',
				'value' => 'var(--arts-header-height-non-sticky)',
				'title' => esc_html__( 'Header Height (Non-Sticky)', 'artem-semkin-header-engine-for-elementor' ),
			),
		);
	}

	/**
	 * Conditions for the silent transition-carrier control: match while any
	 * dimension of the given control is fluid-bound to one of the header
	 * presets — so a padding bound to a live height var animates across state
	 * changes instead of jumping.
	 *
	 * @return array<string, mixed>
	 */
	private function generate_fluid_control_conditions( string $control_name ): array {
		$css_variables = array_column( $this->get_header_presets(), 'value' );

		$dimensions = array( 'top', 'right', 'bottom', 'left' );
		$terms      = array();

		foreach ( $css_variables as $css_variable ) {
			foreach ( $dimensions as $dimension ) {
				$terms[] = array(
					'terms' => array(
						array(
							'name'     => $control_name . '[unit]',
							'operator' => '===',
							'value'    => 'fluid',
						),
						array(
							'name'     => $control_name . '[' . $dimension . ']',
							'operator' => '===',
							'value'    => $css_variable,
						),
					),
				);
			}
		}

		return array(
			'relation' => 'or',
			'terms'    => $terms,
		);
	}
}
