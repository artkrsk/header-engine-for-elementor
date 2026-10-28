<?php
/**
 * Minimal fakes for the Elementor classes the plugin touches at runtime. They record what the
 * plugin does to them; they re-implement only as much of Elementor as the emitters need.
 */

namespace Elementor {
	abstract class Element_Base {
		/** @var array<string, mixed> */
		public $settings;

		/** @var string */
		public $id;

		/** @var array<string, array<string, array<int, mixed>>> */
		public $render_attributes = array();

		/**
		 * @param array<string, mixed> $settings
		 */
		public function __construct( array $settings = array(), string $id = 'a' ) {
			$this->settings = $settings;
			$this->id       = $id;
		}

		/** @return array<string, mixed> */
		public function get_settings_for_display() {
			return $this->settings;
		}

		public function get_id(): string {
			return $this->id;
		}

		/**
		 * Same merge semantics as Elementor's: values accumulate per attribute, scalars become lists.
		 *
		 * @param string|array<string, mixed> $key
		 * @param mixed                       $value
		 */
		public function add_render_attribute( string $element, $key, $value = null ): self {
			if ( is_array( $key ) ) {
				foreach ( $key as $attribute => $attribute_value ) {
					$this->add_render_attribute( $element, $attribute, $attribute_value );
				}
				return $this;
			}

			$current                                = $this->render_attributes[ $element ][ $key ] ?? array();
			$this->render_attributes[ $element ][ $key ] = array_merge( $current, (array) $value );

			return $this;
		}

		public function print_render_attribute_string( string $element ): void {
			foreach ( $this->render_attributes[ $element ] ?? array() as $attribute => $values ) {
				echo ' ' . $attribute . '="' . esc_attr( implode( ' ', array_map( 'strval', $values ) ) ) . '"';
			}
		}
	}

	/** Records the kit updates the Backend pushes to Elementor. */
	class Kits_Manager {
		/** @var array<int, array<string, mixed>> */
		public $updates = array();

		/**
		 * @param array<string, mixed> $value
		 */
		public function update_kit_settings_based_on_option( string $option, array $value ): void {
			$this->updates[] = array(
				'option' => $option,
				'value'  => $value,
			);
		}
	}

	class Preview {
		/** @var bool */
		public $mode = false;

		public function is_preview_mode(): bool {
			return $this->mode;
		}
	}

	// `--bare` runs prove the class_exists() guards: the class is never declared in that process.
	if ( ! in_array( '--bare', $GLOBALS['argv'], true ) ) {
		class Plugin {
			/** @var Plugin|null */
			public static $instance = null;

			/** @var Preview|null */
			public $preview = null;

			/** @var Kits_Manager|null */
			public $kits_manager = null;
		}
	}
}

namespace Elementor\Includes\Elements {
	class Container extends \Elementor\Element_Base {
	}
}

namespace Elementor\Core\Base {
	class Document {
		const STATUS_PUBLISH = 'publish';
	}
}
