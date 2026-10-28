<?php
/**
 * Markup emitter. Row ops:
 *   {"op":"map","onScroll":"sticky","isPrimary":true}
 *   {"op":"render","elements":[{"id":"a","type":"container|widget","settings":{...}}]}
 * `render` resets the primary-header tracker, then runs the four Markup callbacks per element in
 * Elementor's order and reports the render attributes plus what the before/after hooks printed.
 */

require __DIR__ . '/bootstrap.php';

use Arts\HeaderForElementor\Elementor\Markup;
use Elementor\Element_Base;
use Elementor\Includes\Elements\Container;

class Arts_Test_Widget extends Element_Base {
}

/**
 * @param array<string, mixed> $element
 * @return array<string, mixed>
 */
function arts_test_render_element( Markup $markup, array $element ): array {
	$class = 'widget' === $element['type'] ? Arts_Test_Widget::class : Container::class;
	$fake  = new $class( $element['settings'], $element['id'] );

	ob_start();
	$markup->add_header_wrapper_before( $fake );
	$before = (string) ob_get_clean();

	$markup->add_header_bar_attributes( $fake );
	$markup->add_zone_attributes( $fake );

	ob_start();
	$markup->add_header_wrapper_after( $fake );
	$after = (string) ob_get_clean();

	return array(
		'id'         => $element['id'],
		'attributes' => (object) $fake->render_attributes,
		'before'     => $before,
		'after'      => $after,
	);
}

arts_test_run_rows(
	function ( array $row ): array {
		if ( 'map' === $row['op'] ) {
			return array( 'json' => wp_json_encode( Markup::map_panel_settings( $row['onScroll'], $row['isPrimary'] ) ) );
		}

		arts_test_reset_static( Markup::class, 'primary_id', null );
		$markup = new Markup();

		return array(
			'elements' => array_map(
				function ( array $element ) use ( $markup ): array {
					return arts_test_render_element( $markup, $element );
				},
				$row['elements']
			),
		);
	}
);
