<?php
/**
 * Seeds the "Artem Semkin Header Engine — Demo" page: the Live Preview landing page on
 * WordPress.org and the page this plugin is judged by.
 *
 * Run against the Local dev site:
 *   dev/wp eval-file dev/seed/demo-page.php --user=1
 *
 * Also inlined into .wordpress-org/blueprints/blueprint.json as a writeFile
 * step by `arts-wp blueprint build`, then required from the runPHP step that
 * follows it (no wp-cli context there — the WP_CLI:: calls below are guarded
 * for that reason). Idempotent: finds the page by slug and rewrites it
 * wholesale; the two logo attachments are keyed on a meta value and reused.
 *
 * Styling is hard-coded except the three "Header *" kit Global Colors the seed
 * installs itself — the sticky recolor showcase binds the header content to
 * them via __globals__. The header/dock/zone behavior is entirely this
 * plugin's panel controls — the seed writes the same settings the panel would
 * save, nothing hand-wired.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pinned so the blueprint's landingPage can address the page without guessing.
 * The blueprint generator regexes this constant out of the file — keep the
 * literal on one line.
 */
define( 'AHE_DEMO_PAGE_ID', 9941 );

// Elementor otherwise hijacks the first admin request with its onboarding
// wizard. Harmless on an already-onboarded dev site.
update_option( 'elementor_onboarded', true );
delete_transient( 'elementor_activation_redirect' );

// The set_theme_mod() calls below forward-sync into the Elementor kit through
// the plugin's pre_set_theme_mod filters, and the kit save runs a capability
// check ("Access denied" in the blueprint's userless runPHP context otherwise).
wp_set_current_user( 1 );

const AHE_TEXT      = '#111111';
const AHE_MUTED     = '#6b6b6b';
const AHE_BORDER    = '#e4e4e2';
const AHE_SOFT      = '#f6f6f4';
const AHE_DOCK_BG   = '#161616';
const AHE_DOCK_TEXT = '#d6d6d6';

// The stuck header goes dark and re-inks its content via the sticky
// global-color remap. Light values the remap (and the light logo SVG,
// which duplicates the ink hex — nowdoc can't interpolate) flips to.
const AHE_INK_STICKY   = '#f5f5f5';
const AHE_MUTED_STICKY = '#a3a3a3';

function ahe_seed_id(): string {
	return substr( bin2hex( random_bytes( 4 ) ), 0, 7 );
}

function ahe_zero_gap(): array {
	return array(
		'unit'     => 'px',
		'column'   => '0',
		'row'      => '0',
		'isLinked' => true,
	);
}

function ahe_gap( int $px ): array {
	return array(
		'unit'     => 'px',
		'column'   => (string) $px,
		'row'      => (string) $px,
		'isLinked' => true,
	);
}

/** Heading widget with explicit typography (the blueprint boots a bare kit). */
function ahe_heading( string $title, string $tag, string $font_size, array $extra = array() ): array {
	return array(
		'id'         => ahe_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array_merge(
			array(
				'title'                     => $title,
				'header_size'               => $tag,
				'title_color'               => AHE_TEXT,
				'typography_typography'     => 'custom',
				'typography_font_weight'    => '600',
				'typography_font_size'      => array(
					'unit' => 'custom',
					'size' => $font_size,
				),
				'typography_line_height'    => array(
					'unit' => 'custom',
					'size' => '1.2',
				),
				'typography_letter_spacing' => array(
					'unit'  => 'em',
					'size'  => -0.01,
					'sizes' => array(),
				),
			),
			$extra
		),
		'elements'   => array(),
	);
}

/** Muted body paragraph, capped at a readable measure. */
function ahe_body( string $title, array $extra = array() ): array {
	return array(
		'id'         => ahe_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array_merge(
			array(
				'title'                  => $title,
				'header_size'            => 'p',
				'title_color'            => AHE_MUTED,
				'typography_typography'  => 'custom',
				'typography_font_size'   => array(
					'unit'  => 'px',
					'size'  => 17,
					'sizes' => array(),
				),
				'typography_line_height' => array(
					'unit' => 'custom',
					'size' => '1.65',
				),
				'_element_width'         => 'initial',
				'_element_custom_width'  => array(
					'unit' => 'custom',
					'size' => 'min(54ch, 100%)',
				),
			),
			$extra
		),
		'elements'   => array(),
	);
}

/**
 * Plain-text nav link (heading widget — free Elementor has no nav widget).
 * Colors bind to the header's Global Color tokens (__globals__ wins over the
 * hardcoded fallbacks), so the sticky recolor re-inks the whole menu.
 */
function ahe_nav_link( string $title, string $url ): array {
	return array(
		'id'         => ahe_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'heading',
		'settings'   => array(
			'title'                 => $title,
			'header_size'           => 'p',
			'link'                  => array(
				'url'         => $url,
				'is_external' => '',
				'nofollow'    => '',
			),
			'title_color'           => AHE_MUTED,
			'title_hover_color'     => AHE_TEXT,
			'__globals__'           => array(
				'title_color'       => 'globals/colors?id=ahemute01',
				'title_hover_color' => 'globals/colors?id=aheink01',
			),
			'typography_typography' => 'custom',
			'typography_font_size'  => array(
				'unit'  => 'px',
				'size'  => 15,
				'sizes' => array(),
			),
			'_element_width'        => 'auto',
		),
		'elements'   => array(),
	);
}

/** Pill button: hairline border, fully rounded, inverts on hover. */
function ahe_pill( string $text, string $url, array $extra = array() ): array {
	return array(
		'id'         => ahe_seed_id(),
		'elType'     => 'widget',
		'widgetType' => 'button',
		'settings'   => array_merge(
			array(
				'text'                    => $text,
				'link'                    => array(
					'url'         => $url,
					'is_external' => '',
					'nofollow'    => '',
				),
				'button_text_color'       => AHE_TEXT,
				// Group_Control_Background defaults to the kit's global accent
				// color when unset — explicit so the pill stays transparent.
				'background_background'   => 'classic',
				'background_color'        => 'transparent',
				'border_border'           => 'solid',
				'border_width'            => array(
					'unit'     => 'px',
					'top'      => '1',
					'right'    => '1',
					'bottom'   => '1',
					'left'     => '1',
					'isLinked' => true,
				),
				'border_color'            => AHE_TEXT,
				'border_radius'           => array(
					'unit'     => 'px',
					'top'      => '999',
					'right'    => '999',
					'bottom'   => '999',
					'left'     => '999',
					'isLinked' => true,
				),
				'text_padding'            => array(
					'unit'     => 'px',
					'top'      => '8',
					'right'    => '18',
					'bottom'   => '8',
					'left'     => '18',
					'isLinked' => false,
				),
				'typography_typography'   => 'custom',
				'typography_font_size'    => array(
					'unit'  => 'px',
					'size'  => 15,
					'sizes' => array(),
				),
				'typography_font_weight'  => '500',
				'hover_color'             => '#ffffff',
				'button_background_hover_background' => 'classic',
				'button_background_hover_color'      => AHE_TEXT,
				'button_hover_border_color'          => AHE_TEXT,
				// Token-bound (globals win over the hardcoded fallbacks): the
				// sticky recolor inverts the pill, hover included — hover text
				// takes the Surface token, which goes dark while the bar does.
				'__globals__'             => array(
					'button_text_color'             => 'globals/colors?id=aheink01',
					'border_color'                  => 'globals/colors?id=aheink01',
					'hover_color'                   => 'globals/colors?id=ahesurf01',
					'button_background_hover_color' => 'globals/colors?id=aheink01',
					'button_hover_border_color'     => 'globals/colors?id=aheink01',
				),
				'_element_width'          => 'auto',
			),
			$extra
		),
		'elements'   => array(),
	);
}

/**
 * Inner structural container. Explicit zero padding + gap: the kit's default
 * container padding and --widgets-spacing (20px) would leak in otherwise.
 */
function ahe_row( array $settings, array $children ): array {
	return array(
		'id'       => ahe_seed_id(),
		'elType'   => 'container',
		'settings' => array_merge(
			array(
				'content_width' => 'full',
				'padding'       => array(
					'unit'     => 'px',
					'top'      => '0',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => true,
				),
				'flex_gap'      => ahe_zero_gap(),
			),
			$settings
		),
		'elements' => $children,
	);
}

/** Content section: single column, generous vertical padding, anchor id. */
function ahe_section( string $anchor, array $children, array $extra = array() ): array {
	return ahe_row(
		array_merge(
			array(
				'_element_id'    => $anchor,
				'flex_direction' => 'column',
				'flex_gap'       => ahe_gap( 12 ),
				'padding'        => array(
					'unit'     => 'px',
					'top'      => '120',
					'right'    => '0',
					'bottom'   => '120',
					'left'     => '0',
					'isLinked' => false,
				),
			),
			$extra
		),
		$children
	);
}

/**
 * Header Zone block: a NON-header container carrying the zone controls the
 * plugin adds to every regular container ($type: 'hide' or 'lock').
 */
function ahe_zone( string $type, array $children ): array {
	return ahe_row(
		array(
			'arts_header_zone'          => $type,
			'arts_header_zone_geometry' => 'overlap',
			'min_height'                => array(
				'unit'  => 'vh',
				'size'  => 78,
				'sizes' => array(),
			),
			'flex_direction'            => 'column',
			'flex_justify_content'      => 'center',
			'flex_gap'                  => ahe_gap( 8 ),
			'background_background'     => 'classic',
			'background_color'          => AHE_SOFT,
			'border_radius'             => array(
				'unit'     => 'px',
				'top'      => '4',
				'right'    => '4',
				'bottom'   => '4',
				'left'     => '4',
				'isLinked' => true,
			),
			'padding'                   => array(
				'unit'     => 'px',
				'top'      => '48',
				'right'    => '32',
				'bottom'   => '48',
				'left'     => '32',
				'isLinked' => false,
			),
			'_margin'                   => array(
				'unit'     => 'px',
				'top'      => '24',
				'right'    => '0',
				'bottom'   => '0',
				'left'     => '0',
				'isLinked' => false,
			),
		),
		$children
	);
}

// --- Logo attachments (dual-logo demo) ----------------------------------------

$ahe_fail = static function ( string $message ): void {
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		WP_CLI::error( $message );
	}
	throw new RuntimeException( $message );
};

$upload = wp_upload_dir();

if ( ! empty( $upload['error'] ) ) {
	$ahe_fail( $upload['error'] );
}

/**
 * Writes a file into uploads and registers it as an attachment, reusing one
 * previously created under the same key.
 *
 * SVG is not on WordPress's mime whitelist, so the media uploader is bypassed:
 * inserting the attachment directly skips the whitelist (it only guards
 * uploads). Metadata is hand-written because generate_attachment_metadata()
 * would hand the file to the image editor, which cannot measure an SVG and
 * would record zeros.
 */
$ahe_attach = static function (
	string $key,
	string $filename,
	string $bytes,
	string $title
) use ( $upload, $ahe_fail ): int {
	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'meta_key'       => '_arts_he_asset',
			'meta_value'     => $key,
			'fields'         => 'ids',
		)
	);

	$target = "{$upload['path']}/{$filename}";

	if ( false === file_put_contents( $target, $bytes ) ) {
		$ahe_fail( "Could not write {$target}" );
	}

	$relative = ltrim( str_replace( $upload['basedir'], '', $target ), '/' );
	$id       = $existing ? (int) $existing[0] : 0;

	if ( $id ) {
		wp_update_post(
			array(
				'ID'             => $id,
				'post_title'     => $title,
				'post_mime_type' => 'image/svg+xml',
			)
		);
		update_post_meta( $id, '_wp_attached_file', $relative );
	} else {
		$id = wp_insert_attachment(
			array(
				'post_mime_type' => 'image/svg+xml',
				'post_title'     => $title,
				'post_content'   => '',
				'post_status'    => 'inherit',
			),
			$target,
			0,
			true
		);

		if ( is_wp_error( $id ) ) {
			$ahe_fail( $id->get_error_message() );
		}

		update_post_meta( $id, '_arts_he_asset', $key );
	}

	wp_update_attachment_metadata(
		$id,
		array(
			'width'  => 40,
			'height' => 40,
			'file'   => $relative,
			'sizes'  => array(),
		)
	);

	return (int) $id;
};

$ahe_svg_outline = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" fill="none" stroke="#111111" stroke-width="5"/></svg>
SVG;

$ahe_svg_filled = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" fill="#f5f5f5"/></svg>
SVG;

$outline_id = $ahe_attach( 'logo-outline', 'ahe-logo-outline.svg', $ahe_svg_outline, 'Header Engine — Logo (outline)' );
$filled_id  = $ahe_attach( 'logo-filled', 'ahe-logo-filled.svg', $ahe_svg_filled, 'Header Engine — Logo (filled)' );

// The dual-logo widget reads these theme mods directly; setting them also
// forward-syncs into the Elementor kit via the plugin's pre_set_theme_mod
// filters. header_text gates the site-title text next to the mark.
set_theme_mod( 'custom_logo', $outline_id );
set_theme_mod( 'arts_header_custom_logo_secondary', $filled_id );
set_theme_mod( 'header_text', 1 );
update_option( 'blogname', 'Header Engine' );
// Blank, or "Just another WordPress site" renders as a tagline line.
update_option( 'blogdescription', '' );

// --- Kit tokens: explicit header Global Colors -----------------------------------
// The recolor workflow the demo showcases: header content binds to these three
// tokens, and the header's Sticky Colors rows remap them while stuck. Merged
// into the kit's custom_colors keyed on _id — idempotent, other colors kept.

$kit_id = 0;
if ( class_exists( '\Elementor\Plugin' ) && \Elementor\Plugin::$instance && \Elementor\Plugin::$instance->kits_manager ) {
	$kit_id = (int) \Elementor\Plugin::$instance->kits_manager->get_active_id();
}

if ( $kit_id ) {
	$kit_settings = get_post_meta( $kit_id, '_elementor_page_settings', true );
	$kit_settings = is_array( $kit_settings ) ? $kit_settings : array();
	$kit_custom   = isset( $kit_settings['custom_colors'] ) && is_array( $kit_settings['custom_colors'] ) ? $kit_settings['custom_colors'] : array();

	$ahe_tokens = array(
		array(
			'_id'   => 'aheink01',
			'title' => 'Header Ink',
			'color' => AHE_TEXT,
		),
		array(
			'_id'   => 'ahemute01',
			'title' => 'Header Muted',
			'color' => AHE_MUTED,
		),
		array(
			'_id'   => 'ahesurf01',
			'title' => 'Header Surface',
			'color' => '#ffffff',
		),
	);

	foreach ( $ahe_tokens as $ahe_token ) {
		$replaced = false;
		foreach ( $kit_custom as $i => $row ) {
			if ( is_array( $row ) && isset( $row['_id'] ) && $row['_id'] === $ahe_token['_id'] ) {
				$kit_custom[ $i ] = $ahe_token;
				$replaced         = true;
				break;
			}
		}
		if ( ! $replaced ) {
			$kit_custom[] = $ahe_token;
		}
	}

	$kit_settings['custom_colors'] = $kit_custom;
	update_post_meta( $kit_id, '_elementor_page_settings', wp_slash( $kit_settings ) );

	if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
		\Elementor\Core\Files\CSS\Post::create( $kit_id )->delete();
	}
}

// --- Primary header (top overlay, sticky + auto-hide) ---------------------------

$header = array(
	'id'       => ahe_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'                     => 'Header',
		'content_width'              => 'full',
		'flex_direction'             => 'row',
		'flex_justify_content'       => 'space-between',
		'flex_align_items'           => 'center',
		'flex_gap'                   => ahe_gap( 24 ),

		// The plugin's panel controls — everything the demo shows.
		'arts_header_enabled'        => 'yes',
		'arts_header_position'       => '',
		'arts_header_on_scroll'      => 'auto-hide',
		'arts_header_sticky_reveal_offset_preset'       => 'viewport',
		'arts_header_state_non_sticky_logo_version'     => 'primary',
		'arts_header_state_sticky_logo_version'         => 'secondary',

		// The recolor showcase: the stuck bar goes dark, and the three kit
		// tokens the header content binds to flip light-on-dark with it.
		'arts_header_sticky_global_colors'              => array(
			array(
				'_id'          => 'ahegc001',
				'global_id'    => 'aheink01',
				'sticky_color' => AHE_INK_STICKY,
			),
			array(
				'_id'          => 'ahegc002',
				'global_id'    => 'ahemute01',
				'sticky_color' => AHE_MUTED_STICKY,
			),
			array(
				'_id'          => 'ahegc003',
				'global_id'    => 'ahesurf01',
				'sticky_color' => AHE_DOCK_BG,
			),
		),
		'background_sticky_background' => 'classic',
		'background_sticky_color'      => AHE_DOCK_BG,
		// Explicit zero-width rest border: the bar transitions border-width, and
		// without a rest value the unstick leg animates toward the browser
		// default `medium` (3px, all sides) while the discrete border-style
		// flips mid-transition — a visible border flash.
		'border_border'                => 'solid',
		'border_width'                 => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '0',
			'bottom'   => '0',
			'left'     => '0',
			'isLinked' => false,
		),
		'border_color'                 => AHE_BORDER,
		'border_sticky_border'         => 'solid',
		'border_sticky_width'          => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '0',
			'bottom'   => '1',
			'left'     => '0',
			'isLinked' => false,
		),
		'border_sticky_color'          => '#2a2a2a',

		// Rest padding = the native control; the stuck state overrides it via
		// padding_sticky (all four sides filled on both — a blank side makes
		// Elementor skip the whole rule). No native position/z-index:
		// _modes.scss owns positioning via the bar modifier class.
		'padding'                    => array(
			'unit'     => 'px',
			'isLinked' => false,
			'top'      => '28',
			'bottom'   => '28',
			'left'     => '32',
			'right'    => '32',
		),
		'padding_sticky'             => array(
			'unit'     => 'px',
			'isLinked' => false,
			'top'      => '14',
			'bottom'   => '14',
			'left'     => '32',
			'right'    => '32',
		),
	),
	'elements' => array(
		array(
			'id'         => ahe_seed_id(),
			'elType'     => 'widget',
			'widgetType' => 'arts-header-dual-site-logo',
			'settings'   => array(
				'logo_link_type'   => 'custom',
				'logo_custom_link' => array(
					'url'         => '#top',
					'is_external' => '',
					'nofollow'    => '',
				),
				'logo_max_height'  => array(
					'size' => 18,
					'unit' => 'px',
				),
				'gap_logo_text'    => array(
					'size' => 9,
					'unit' => 'px',
				),
				'typography_title_control_typography'  => 'custom',
				'typography_title_control_font_size'   => array(
					'unit'  => 'px',
					'size'  => 16,
					'sizes' => array(),
				),
				'typography_title_control_font_weight' => '600',
				'color_title_control' => AHE_TEXT,
				'__globals__'         => array(
					'color_title_control' => 'globals/colors?id=aheink01',
				),
				'_element_width'      => 'auto',
			),
			'elements'   => array(),
		),
		ahe_row(
			array(
				'width'            => array(
					'unit' => 'custom',
					'size' => 'auto',
				),
				'flex_direction'   => 'row',
				'flex_align_items' => 'center',
				'flex_gap'         => ahe_gap( 26 ),
			),
			array(
				ahe_nav_link( 'Sticky', '#sticky' ),
				ahe_nav_link( 'Zones', '#zones' ),
				ahe_nav_link( 'Dock', '#dock' ),
				ahe_pill( 'Open editor', '#outro' ),
			)
		),
	),
);

// --- Page content ---------------------------------------------------------------

$hero = ahe_row(
	array(
		'_element_id'          => 'top',
		'flex_direction'       => 'column',
		'flex_justify_content' => 'center',
		'flex_gap'             => ahe_gap( 18 ),
		'min_height'           => array(
			'unit'  => 'vh',
			'size'  => 92,
			'sizes' => array(),
		),
	),
	array(
		// Anchor smoothness + landing clear of the fixed bar. Baked into page
		// content because the seed runs once at provisioning — a wp_head hook
		// registered here would not survive past that request.
		array(
			'id'         => ahe_seed_id(),
			'elType'     => 'widget',
			'widgetType' => 'html',
			'settings'   => array(
				'html' => '<style>html{scroll-behavior:smooth;scroll-padding-top:84px}</style>',
			),
			'elements'   => array(),
		),
		ahe_heading(
			'A header that stays out of the way.',
			'h1',
			'clamp(32px, 5vw, 44px)',
			array(
				'typography_line_height'    => array(
					'unit' => 'custom',
					'size' => '1.15',
				),
				'typography_letter_spacing' => array(
					'unit'  => 'em',
					'size'  => -0.02,
					'sizes' => array(),
				),
			)
		),
		ahe_body(
			'Sticky, auto-hide, and zone-aware — animated entirely in CSS, configured entirely in the Elementor panel.',
			array(
				'_element_custom_width' => array(
					'unit' => 'custom',
					'size' => 'min(44ch, 100%)',
				),
			)
		),
		ahe_body(
			'Scroll — the bar above is live.',
			array(
				'typography_font_size' => array(
					'unit'  => 'px',
					'size'  => 14,
					'sizes' => array(),
				),
				'_margin'              => array(
					'unit'     => 'px',
					'top'      => '30',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => false,
				),
			)
		),
	)
);

$sticky_section = ahe_section(
	'sticky',
	array(
		ahe_heading( 'The sticky flip', 'h2', '22px' ),
		ahe_body( 'Past the first screen the bar turns dark — and everything in it re-inks itself. The header remaps Global Colors while sticky, so the menu, the button and the site title follow with no per-widget wiring; the logo swaps to its light version.' ),
		ahe_body( 'Auto-hide waits out the first full screen — the reveal offset, set to one viewport height in the panel. From here on, scrolling down sends the bar away; scrolling up brings it back.' ),
	)
);

$zones_section = ahe_section(
	'zones',
	array(
		ahe_heading( 'Zones', 'h2', '22px' ),
		ahe_body( 'Any section can tell the header what to do while they overlap. This one asks it to stay hidden:' ),
		ahe_zone(
			'hide',
			array(
				ahe_heading( 'Hide zone', 'h3', '17px' ),
				ahe_body(
					"Think fullscreen slider or video. Scrolling up in here won't bring the header back — it returns when you leave.",
					array(
						'typography_font_size'  => array(
							'unit'  => 'px',
							'size'  => 15,
							'sizes' => array(),
						),
						'_element_custom_width' => array(
							'unit' => 'custom',
							'size' => 'min(46ch, 100%)',
						),
					)
				),
				ahe_body(
					'Try it: scroll up — the bar waits outside.',
					array(
						'typography_font_size' => array(
							'unit'  => 'px',
							'size'  => 13,
							'sizes' => array(),
						),
						'_margin'              => array(
							'unit'     => 'px',
							'top'      => '16',
							'right'    => '0',
							'bottom'   => '0',
							'left'     => '0',
							'isLinked' => false,
						),
					)
				),
			)
		),
		ahe_body(
			'Between zones normal auto-hide applies. The next one does the opposite:',
			array(
				'typography_font_size' => array(
					'unit'  => 'px',
					'size'  => 15,
					'sizes' => array(),
				),
				'_margin'              => array(
					'unit'     => 'px',
					'top'      => '32',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => false,
				),
			)
		),
		ahe_zone(
			'lock',
			array(
				ahe_heading( 'Lock zone', 'h3', '17px' ),
				ahe_body(
					"This one pins the bar on screen: while you're over it the header shows and stays, whatever the scroll direction — useful over forms and checkout steps.",
					array(
						'typography_font_size'  => array(
							'unit'  => 'px',
							'size'  => 15,
							'sizes' => array(),
						),
						'_element_custom_width' => array(
							'unit' => 'custom',
							'size' => 'min(46ch, 100%)',
						),
					)
				),
				ahe_body(
					'Try it: keep scrolling down — the bar refuses to leave.',
					array(
						'typography_font_size' => array(
							'unit'  => 'px',
							'size'  => 13,
							'sizes' => array(),
						),
						'_margin'              => array(
							'unit'     => 'px',
							'top'      => '16',
							'right'    => '0',
							'bottom'   => '0',
							'left'     => '0',
							'isLinked' => false,
						),
					)
				),
			)
		),
	)
);

$dock_section = ahe_section(
	'dock',
	array(
		ahe_heading( 'More than one', 'h2', '22px' ),
		ahe_body( "The dark rail along the bottom edge is a second header instance, docked low and hiding downward — it's been there since the page loaded, leaving whenever you scroll down. Instances run independently on the same page." ),
	)
);

$outro_section = ahe_section(
	'outro',
	array(
		ahe_heading( 'See the panel', 'h2', '22px' ),
		ahe_body( 'Everything on this page is a panel setting. The preview logs you in — open the page in Elementor and click the header container.' ),
		ahe_pill(
			'Open in Elementor',
			admin_url( 'post.php?post=' . AHE_DEMO_PAGE_ID . '&action=elementor' ),
			array(
				'_margin' => array(
					'unit'     => 'px',
					'top'      => '14',
					'right'    => '0',
					'bottom'   => '0',
					'left'     => '0',
					'isLinked' => false,
				),
			)
		),
	),
	array(
		'padding' => array(
			'unit'     => 'px',
			'top'      => '120',
			'right'    => '0',
			'bottom'   => '200',
			'left'     => '0',
			'isLinked' => false,
		),
	)
);

$page_wrapper = array(
	'id'       => ahe_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'        => 'Content',
		'content_width' => 'boxed',
		'boxed_width'   => array(
			'unit'  => 'px',
			'size'  => 640,
			'sizes' => array(),
		),
		'flex_gap'      => ahe_zero_gap(),
		'padding'       => array(
			'unit'     => 'px',
			'top'      => '0',
			'right'    => '24',
			'bottom'   => '0',
			'left'     => '24',
			'isLinked' => false,
		),
	),
	'elements' => array( $hero, $sticky_section, $zones_section, $dock_section, $outro_section ),
);

// --- Secondary header (bottom dock) ---------------------------------------------
// Rendered after the primary in the element tree — the first-rendered header
// container becomes the primary (page globals owner); this one runs with
// heightObserver and zones off automatically. It must also come BEFORE the tall
// page content: a fixed wrapper's natural position is estimated from its
// previous sibling (estimateNaturalTop), and a document-end estimate would keep
// the bottom dock un-stuck — auto-hide machinery never engages.

$dock = array(
	'id'       => ahe_seed_id(),
	'elType'   => 'container',
	'isInner'  => false,
	'settings' => array(
		'_title'                => 'Bottom Dock',
		'content_width'         => 'full',
		'flex_direction'        => 'row',
		'flex_justify_content'  => 'space-between',
		'flex_align_items'      => 'center',
		'flex_gap'              => ahe_gap( 16 ),

		'arts_header_enabled'   => 'yes',
		'arts_header_position'  => 'bottom',
		'arts_header_on_scroll' => 'auto-hide',
		'arts_header_sticky_reveal_offset_preset' => 'viewport',

		'background_background' => 'classic',
		'background_color'      => AHE_DOCK_BG,
		'padding'               => array(
			'unit'     => 'px',
			'top'      => '13',
			'right'    => '32',
			'bottom'   => '13',
			'left'     => '32',
			'isLinked' => false,
		),
	),
	'elements' => array(
		ahe_body(
			'Second instance — bottom dock',
			array(
				'title_color'          => AHE_DOCK_TEXT,
				'typography_font_size' => array(
					'unit'  => 'px',
					'size'  => 13,
					'sizes' => array(),
				),
				'_element_width'       => 'auto',
				'_element_custom_width' => array(),
			)
		),
		ahe_body(
			'hides on scroll down',
			array(
				'title_color'          => AHE_DOCK_TEXT,
				'typography_font_size' => array(
					'unit'  => 'px',
					'size'  => 13,
					'sizes' => array(),
				),
				'_element_width'       => 'auto',
				'_element_custom_width' => array(),
			)
		),
	),
);

// --- Persist --------------------------------------------------------------------

$slug     = 'ahe-demo';
$existing = get_page_by_path( $slug );

$post_id = $existing ? $existing->ID : wp_insert_post(
	array(
		'import_id'   => AHE_DEMO_PAGE_ID,
		'post_type'   => 'page',
		'post_status' => 'publish',
		'post_title'  => 'Artem Semkin Header Engine — Demo',
		'post_name'   => $slug,
	),
	true
);

if ( is_wp_error( $post_id ) ) {
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		WP_CLI::error( $post_id->get_error_message() );
	}
	return;
}

$elements = array( $header, $dock, $page_wrapper );

$page_settings = array(
	'template'              => 'elementor_canvas',
	'hide_title'            => 'yes',
	'background_background' => 'classic',
	'background_color'      => '#ffffff',
);

// Mirrors Document::save()'s sequence (elementor/core/base/document.php).
update_post_meta( $post_id, '_elementor_page_settings', wp_slash( $page_settings ) );
update_post_meta( $post_id, '_elementor_data', wp_slash( wp_json_encode( $elements, JSON_UNESCAPED_UNICODE ) ) );
update_post_meta( $post_id, '_elementor_edit_mode', 'builder' );
update_post_meta( $post_id, '_elementor_template_type', 'wp-page' );
update_post_meta( $post_id, '_wp_page_template', 'elementor_canvas' );

if ( defined( 'ELEMENTOR_VERSION' ) ) {
	update_post_meta( $post_id, '_elementor_version', ELEMENTOR_VERSION );
}

// Post CSS never diffs (is_update_required() is hard-coded false) — delete to regen.
if ( class_exists( '\Elementor\Core\Files\CSS\Post' ) ) {
	\Elementor\Core\Files\CSS\Post::create( $post_id )->delete();
}
delete_post_meta( $post_id, '_elementor_element_cache' );

// The editor prefers newer autosave revisions over raw meta — remove them all.
foreach ( wp_get_post_revisions( $post_id, array( 'fields' => 'ids' ) ) as $revision_id ) {
	wp_delete_post_revision( $revision_id );
}

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::success( sprintf( 'Demo page seeded: post_id=%d %s', $post_id, get_permalink( $post_id ) ) );
}
