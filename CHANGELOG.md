# Changelog

## 1.1.0 – October 13, 2026

* added: the Header Zone settings can now be set per screen size, so a section can hide or lock the header on desktop and leave it alone on tablet and mobile.
* added: a new header clearance size is published for page content to clear dropdowns that hang out of a fixed-height header.
* fixed: the editor canvas no longer jumps while scrolling when the header shrinks on stick.
* fixed: the header's hidden, locked and sticky states can no longer get stuck after a page transition that keeps the header in place.
* fixed: pages swapped by an AJAX transition no longer let the leaving page's zones hide the incoming header.

## 1.0.3 – October 8, 2026

* added: a getInstance( element ) lookup on the global app, resolving the header instance that owns any element inside a managed header.
* fixed: a lock-over or hide-over zone change no longer drops a lock held through lockSticky(), and lockSticky( false ) no longer releases an active lock-over zone.
* fixed: header offsets and spacing set in viewport units now update correctly when the browser window is resized, particularly in Safari.
* fixed: the logo's hover fade no longer snaps instead of animating smoothly.

## 1.0.2 – September 23, 2026

* fixed: a hidden header now slides back into view when it holds keyboard focus, so tabbing never lands on an off-screen logo or menu link.
* fixed: "ResizeObserver loop completed with undelivered notifications" errors in the browser console when page spacing is bound to the header height.

## 1.0.1 – September 20, 2026

* improved: sticky and auto-hide header performance during page load and scrolling.
* improved: header reliability on AJAX-driven page transitions.

## 1.0.0 – August 28, 2026

Initial release.
