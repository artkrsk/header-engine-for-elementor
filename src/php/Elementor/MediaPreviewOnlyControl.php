<?php

namespace Arts\HeaderForElementor\Elementor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Elementor\Control_Media;

/**
 * A read-only media preview control: renders the image swatch without any
 * upload/remove UI. Actual editing happens elsewhere (the widget pairs it
 * with a CTA button deep-linking into Site Identity settings). Uses only
 * stock Elementor editor classes — no custom editor CSS needed.
 *
 * @phpstan-consistent-constructor
 */
class MediaPreviewOnlyControl extends Control_Media {
	const CONTROL_TYPE = 'media-preview-only';

	/**
	 * @var array<string, static>
	 */
	protected static $instances = array();

	public static function instance(): static {
		$cls = static::class;
		if ( ! isset( self::$instances[ $cls ] ) ) {
			self::$instances[ $cls ] = new static();
		}
		return self::$instances[ $cls ];
	}

	public function get_type(): string {
		return self::CONTROL_TYPE;
	}

	public function content_template(): void {
		?>
		<div class="elementor-control-field elementor-control-media">
			<label class="elementor-control-title">{{{ data.label }}}</label>
			<div class="elementor-control-input-wrapper">
				<div class="elementor-control-media-area">
					<div class="elementor-control-media__preview" style="background-image: url('{{ data.src }}');"></div>
				</div>
			</div>
			<# if ( data.description ) { #>
			<div class="elementor-control-field-description">{{{ data.description }}}</div>
			<# } #>
			<input type="hidden" data-setting="{{ data.name }}"/>
		</div>
		<?php
	}
}
