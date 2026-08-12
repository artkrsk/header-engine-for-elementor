<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Controls_Manager;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Typography;
use Elementor\Utils;
use Elementor\Widget_Base;

/**
 * Site identity widget rendering WP's site logo with an optional secondary
 * logo stacked on top (the sticky-state CSS swap in _logo.scss keys off the
 * wrapper's data-arts-header-*-logo attributes), plus site title/tagline.
 * Both logos are edited through Site Identity — the widget only previews.
 */
class DualLogoWidget extends Widget_Base {
	public function get_name(): string {
		return 'arts-header-dual-site-logo';
	}

	public function get_title(): string {
		return esc_html__( 'Dual Site Logo', 'header-for-elementor' );
	}

	public function get_icon(): string {
		return 'eicon-site-logo';
	}

	/**
	 * @return array<int, string>
	 */
	public function get_categories(): array {
		return array( 'theme-elements' );
	}

	protected function register_controls(): void {
		$this->register_content_controls( Controls_Manager::TAB_CONTENT );
		$this->register_style_controls( Controls_Manager::TAB_STYLE );
	}

	private function register_content_controls( string $tab ): void {
		$this->start_controls_section(
			'site_identity_section',
			array(
				'label' => esc_html__( 'Site Identity', 'header-for-elementor' ),
				'tab'   => $tab,
			)
		);

		// Live feature-detection flags: register_controls() re-runs per request,
		// so these HIDDEN defaults track the current theme mods; the style
		// sections' conditions key off them.
		$this->add_control(
			'has_logo',
			array(
				'type'    => Controls_Manager::HIDDEN,
				'default' => get_theme_mod( 'custom_logo' ) ? 'yes' : '',
			)
		);

		$this->add_control(
			'has_title',
			array(
				'type'    => Controls_Manager::HIDDEN,
				'default' => get_theme_mod( 'header_text' ) && get_bloginfo( 'name' ) ? 'yes' : '',
			)
		);

		$this->add_control(
			'has_tagline',
			array(
				'type'    => Controls_Manager::HIDDEN,
				'default' => get_theme_mod( 'header_text' ) && get_bloginfo( 'description' ) ? 'yes' : '',
			)
		);

		$media_preview_type = MediaPreviewOnlyControl::instance()->get_type();

		$this->add_control(
			'primary_logo',
			array(
				'label' => esc_html__( 'Site Logo', 'header-for-elementor' ),
				'type'  => $media_preview_type,
				'src'   => $this->get_site_logo(),
			)
		);

		$this->add_control(
			'change_site_logo_cta',
			array(
				'type' => Controls_Manager::RAW_HTML,
				'raw'  => $this->get_site_identity_cta( esc_html__( 'Change Site Logo', 'header-for-elementor' ) ),
			)
		);

		$this->add_control(
			'secondary_logo',
			array(
				'label' => esc_html__( 'Secondary Site Logo', 'header-for-elementor' ),
				'type'  => $media_preview_type,
				'src'   => $this->get_site_secondary_logo(),
			)
		);

		$this->add_control(
			'change_site_secondary_logo_cta',
			array(
				'type' => Controls_Manager::RAW_HTML,
				'raw'  => $this->get_site_identity_cta( esc_html__( 'Change Site Secondary Logo', 'header-for-elementor' ) ),
			)
		);

		$this->add_control(
			'logo_link_type',
			array(
				'label'     => esc_html__( 'Logo Link', 'header-for-elementor' ),
				'separator' => 'before',
				'type'      => Controls_Manager::SELECT,
				'options'   => array(
					'home'   => esc_html__( 'Home URL', 'header-for-elementor' ),
					'custom' => esc_html__( 'Custom URL', 'header-for-elementor' ),
					'none'   => esc_html__( 'No Link', 'header-for-elementor' ),
				),
				'default'   => 'home',
			)
		);

		$this->add_control(
			'logo_custom_link',
			array(
				'label'     => esc_html__( 'Custom URL', 'header-for-elementor' ),
				'type'      => Controls_Manager::URL,
				'default'   => array(
					'url' => '',
				),
				'condition' => array(
					'logo_link_type' => 'custom',
				),
				'dynamic'   => array(
					'active' => true,
				),
			)
		);

		$this->end_controls_section();
	}

	private function register_style_controls( string $tab ): void {
		$logo_wrapper_selector = '{{WRAPPER}} .arts-header-logo__wrapper-img';
		$title_selector        = '{{WRAPPER}} .arts-header-logo__text-title';
		$tagline_selector      = '{{WRAPPER}} .arts-header-logo__text-tagline';

		$this->start_controls_section(
			'typography_colors_section',
			array(
				'label'      => esc_html__( 'Typography & Colors', 'header-for-elementor' ),
				'tab'        => $tab,
				'conditions' => array(
					'relation' => 'or',
					'terms'    => array(
						array(
							'name'     => 'has_title',
							'operator' => '===',
							'value'    => 'yes',
						),
						array(
							'name'     => 'has_tagline',
							'operator' => '===',
							'value'    => 'yes',
						),
					),
				),
			)
		);

		$this->add_control(
			'typography_colors_title_heading',
			array(
				'type'      => Controls_Manager::HEADING,
				'label'     => esc_html__( 'Site Title', 'header-for-elementor' ),
				'condition' => array( 'has_title' => 'yes' ),
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'      => 'typography_title_control',
				'selector'  => $title_selector,
				'condition' => array( 'has_title' => 'yes' ),
			)
		);

		$this->add_control(
			'color_title_control',
			array(
				'label'     => esc_html__( 'Text Color', 'header-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					$title_selector => 'color: {{VALUE}};',
				),
				'condition' => array( 'has_title' => 'yes' ),
			)
		);

		$this->add_control(
			'typography_colors_description_heading',
			array(
				'type'      => Controls_Manager::HEADING,
				'label'     => esc_html__( 'Site Tagline', 'header-for-elementor' ),
				'condition' => array( 'has_tagline' => 'yes' ),
				'separator' => get_theme_mod( 'header_text' ) && get_bloginfo( 'name' ) && get_bloginfo( 'description' ) ? 'before' : 'default',
			)
		);

		$this->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'      => 'typography_description_control',
				'selector'  => $tagline_selector,
				'condition' => array( 'has_tagline' => 'yes' ),
			)
		);

		$this->add_control(
			'color_description_control',
			array(
				'label'     => esc_html__( 'Text Color', 'header-for-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'selectors' => array(
					$tagline_selector => 'color: {{VALUE}};',
				),
				'condition' => array( 'has_tagline' => 'yes' ),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'spacing_sizes_section',
			array(
				'label'      => esc_html__( 'Spacing & Sizes', 'header-for-elementor' ),
				'tab'        => $tab,
				'conditions' => array(
					'relation' => 'or',
					'terms'    => array(
						array(
							'name'     => 'has_logo',
							'operator' => '===',
							'value'    => 'yes',
						),
						array(
							'relation' => 'and',
							'terms'    => array(
								array(
									'name'     => 'has_title',
									'operator' => '===',
									'value'    => 'yes',
								),
								array(
									'name'     => 'has_tagline',
									'operator' => '===',
									'value'    => 'yes',
								),
							),
						),
					),
				),
			)
		);

		$this->add_responsive_control(
			'logo_max_height',
			array(
				'label'      => esc_html__( 'Logo Max Height', 'header-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'custom' ),
				'range'      => array(
					'px' => array(
						'min'  => 0,
						'max'  => 512,
						'step' => 1,
					),
				),
				'selectors'  => array(
					'{{WRAPPER}} .arts-header-logo__wrapper-img img' => 'height: {{SIZE}}{{UNIT}};',
				),
				'default'    => array(
					'size' => 48,
					'unit' => 'px',
				),
				'condition'  => array( 'has_logo' => 'yes' ),
			)
		);

		$this->add_responsive_control(
			'gap_logo_text',
			array(
				'label'      => esc_html__( 'Gap Between Logo & Text', 'header-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'custom' ),
				'range'      => array(
					'px' => array(
						'min'  => 0,
						'max'  => 100,
						'step' => 1,
					),
				),
				'default'    => array(
					'size' => 12,
					'unit' => 'px',
				),
				'selectors'  => array(
					'{{WRAPPER}} .arts-header-logo' => 'gap: {{SIZE}}{{UNIT}};',
				),
				'conditions' => array(
					'relation' => 'and',
					'terms'    => array(
						array(
							'name'     => 'has_logo',
							'operator' => '===',
							'value'    => 'yes',
						),
						array(
							'relation' => 'or',
							'terms'    => array(
								array(
									'name'     => 'has_title',
									'operator' => '===',
									'value'    => 'yes',
								),
								array(
									'name'     => 'has_tagline',
									'operator' => '===',
									'value'    => 'yes',
								),
							),
						),
					),
				),
			)
		);

		$this->add_responsive_control(
			'gap_title_tagline',
			array(
				'label'      => esc_html__( 'Gap Between Title and Tagline', 'header-for-elementor' ),
				'type'       => Controls_Manager::SLIDER,
				'size_units' => array( 'px', 'em', 'rem', 'custom' ),
				'range'      => array(
					'px' => array(
						'min'  => 0,
						'max'  => 100,
						'step' => 1,
					),
				),
				'default'    => array(
					'size' => 4,
					'unit' => 'px',
				),
				'selectors'  => array(
					'{{WRAPPER}} .arts-header-logo__text' => 'gap: {{SIZE}}{{UNIT}};',
				),
				'conditions' => array(
					'relation' => 'and',
					'terms'    => array(
						array(
							'name'     => 'has_title',
							'operator' => '===',
							'value'    => 'yes',
						),
						array(
							'name'     => 'has_tagline',
							'operator' => '===',
							'value'    => 'yes',
						),
					),
				),
			)
		);

		$this->end_controls_section();

		$this->start_controls_section(
			'border_section',
			array(
				'label'     => esc_html__( 'Border', 'header-for-elementor' ),
				'tab'       => $tab,
				'condition' => array( 'has_logo' => 'yes' ),
			)
		);

		$this->add_group_control(
			Group_Control_Border::get_type(),
			array(
				'name'      => 'logo_border',
				'selector'  => $logo_wrapper_selector,
				'condition' => array( 'has_logo' => 'yes' ),
			)
		);

		$this->add_responsive_control(
			'logo_border_radius',
			array(
				'label'      => esc_html__( 'Border Radius', 'header-for-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%', 'em', 'rem', 'custom' ),
				'selectors'  => array(
					$logo_wrapper_selector => 'border-radius: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
				),
				'condition'  => array( 'has_logo' => 'yes' ),
			)
		);

		$this->end_controls_section();
	}

	/** The "edit in Site Identity" deep-link button markup for RAW_HTML controls. */
	private function get_site_identity_cta( string $label ): string {
		return sprintf(
			'<div class="elementor-control-field">
				<div class="elementor-control-input-wrapper">
					<button type="button" class="elementor-button elementor-button-default elementor-button-center" onClick="javascript: $e.run(\'panel/global/open\').then(() => $e.route(\'panel/global/settings-site-identity\'));">%1$s</button>
				</div>
			</div>',
			$label
		);
	}

	/** The site logo URL, or Elementor's placeholder when none is set. */
	private function get_site_logo(): string {
		return $this->get_logo_url( $this->get_theme_mod_id( 'custom_logo' ) );
	}

	/** The secondary logo URL, or Elementor's placeholder when none is set. */
	private function get_site_secondary_logo(): string {
		return $this->get_logo_url( $this->get_theme_mod_id( 'arts_header_custom_logo_secondary' ) );
	}

	/** A theme mod holding an attachment id; 0 when unset or non-numeric. */
	private function get_theme_mod_id( string $key ): int {
		$value = get_theme_mod( $key );

		return is_numeric( $value ) ? (int) $value : 0;
	}

	private function get_logo_url( int $attachment_id ): string {
		if ( $attachment_id > 0 ) {
			$logo_src = wp_get_attachment_image_src( $attachment_id, 'full' );
			return is_array( $logo_src ) && isset( $logo_src[0] ) ? $logo_src[0] : '';
		}

		return Utils::get_placeholder_image_src();
	}

	protected function render(): void {
		$settings = (array) $this->get_settings_for_display();

		$title                         = get_bloginfo( 'name' );
		$tagline                       = get_bloginfo( 'description' );
		$display_title_tagline_enabled = get_theme_mod( 'header_text' );
		$primary_logo_id               = $this->get_theme_mod_id( 'custom_logo' );
		$secondary_logo_id             = $this->get_theme_mod_id( 'arts_header_custom_logo_secondary' );

		$logo_link_type   = is_string( $settings['logo_link_type'] ?? null ) ? $settings['logo_link_type'] : 'home';
		$logo_custom_link = is_array( $settings['logo_custom_link'] ?? null ) ? $settings['logo_custom_link'] : array();

		$logo = 'logo';

		$logo_primary_attributes = array(
			'class' => 'arts-header-logo__img-primary',
			'alt'   => $title,
		);

		$logo_secondary_attributes = array(
			'class' => 'arts-header-logo__img-secondary',
			'alt'   => $title,
		);

		if ( $logo_link_type === 'home' ) {
			$this->add_render_attribute( $logo, 'href', esc_url( home_url( '/' ) ) );
		} elseif ( $logo_link_type === 'custom' ) {
			$this->add_link_attributes( $logo, $logo_custom_link );
		}

		if ( $primary_logo_id && $title ) {
			$this->add_render_attribute( $logo, 'aria-label', esc_attr( $title ) );
		}

		$this->add_render_attribute( $logo, array( 'class' => array( 'arts-header-logo' ) ) );

		$href_value = $this->get_render_attributes( $logo, 'href' );
		$logo_tag   = ! empty( $href_value ) && $logo_link_type !== 'none' ? 'a' : 'div';
		?>
		<<?php echo esc_attr( $logo_tag ); ?> <?php $this->print_render_attribute_string( $logo ); ?>>
			<?php if ( $primary_logo_id ) : ?>
				<div class="arts-header-logo__wrapper-img">
					<?php echo wp_get_attachment_image( $primary_logo_id, 'full', false, $logo_primary_attributes ); ?>
					<?php if ( $secondary_logo_id ) : ?>
						<?php echo wp_get_attachment_image( $secondary_logo_id, 'full', false, $logo_secondary_attributes ); ?>
					<?php endif; ?>
				</div>
			<?php endif; ?>
			<?php if ( ( ! empty( $title ) || ! empty( $tagline ) ) && $display_title_tagline_enabled ) : ?>
				<div class="arts-header-logo__text">
					<span class="arts-header-logo__text-title"><?php echo esc_html( $title ); ?></span>
					<?php if ( ! empty( $tagline ) ) : ?>
						<span class="arts-header-logo__text-tagline"><?php echo esc_html( $tagline ); ?></span>
					<?php endif; ?>
				</div>
			<?php endif; ?>
		</<?php echo esc_attr( $logo_tag ); ?>>
		<?php
	}
}
