# Changelog

## 1.0.3

* added: a `--arts-header-clearance-non-sticky` variable and a "Header Clearance (Non-Sticky)" preset: how far the header's content reaches from its top, counting elements marked `data-arts-header-extent` that the bar's box does not contain (such as a dropdown list hanging out of a fixed-height row), so page content can clear what the header paints.
* added: a getInstance( element ) lookup on the global app, resolving the header instance that owns any element inside a managed header.
* fixed: a lock-over or hide-over zone change no longer drops a lock held through lockSticky(), and lockSticky( false ) no longer releases an active lock-over zone.
* fixed: header offsets and spacing set in viewport units now update correctly when the browser window is resized, particularly in Safari.
* fixed: the logo's hover fade no longer snaps instead of animating smoothly.

## 1.0.2

* fixed: a hidden header now slides back into view when it holds keyboard focus, so tabbing never lands on an off-screen logo or menu link.
* fixed: "ResizeObserver loop completed with undelivered notifications" errors in the browser console when page spacing is bound to the header height.

## 1.0.1

* improved: sticky and auto-hide header performance during page load and scrolling.
* improved: header reliability on AJAX-driven page transitions.

## 1.0.0

Initial release.
