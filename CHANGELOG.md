# CHANGELOG

## v10.4.1 - Tightness module loader fix
- Added explicit loading of `js/tightness.js` from root `index.html`.
- This allows the new modular Tightness Test Centre to override the legacy embedded calculator view.
- Keeps the new IGEM table-based calculation and save-record workflow from v10.4.

## v10.4 - Tightness Test Centre
- Added IGEM table-based time calculation workflow.
- Added Save Test Record function via `/api/tightness`.
- Added saved records table and selected record review.
