<?php
/**
 * Controls emitter. One row, any content: prints the resolved class constants. Controls resolves its
 * Elementor classes lazily, so the class loads without Elementor present.
 */

require __DIR__ . '/bootstrap.php';

use Arts\HeaderForElementor\Elementor\Controls;

arts_test_run_rows(
	function (): array {
		return ( new ReflectionClass( Controls::class ) )->getConstants();
	}
);
