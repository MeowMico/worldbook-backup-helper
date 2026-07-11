# Changelog

All notable changes to the VS Code and Cursor extension are documented here.

## 0.2.1 - 2026-07-11

- Replaced the raw messages field with structured chat-message editors for role, content, ordering, and deletion.
- Added a synchronized full Scenario JSON editor below the structured controls.
- Fixed preview scenarios to keep the portable `{{user}}` macro instead of storing a custom simulated user name.
- Preserved unknown scenario and message fields through preview and save round trips.
- Made force-activation IDs editable as a newline- or comma-separated list while retaining legacy JSON-array support.

## 0.2.0 - 2026-07-10

- Added entry multi-select actions for select all, enable, disable, delete, and cross-worldbook copy.
- Added batch find, replace, and match deletion across titles, keywords, and content.
- Added snapshots and named experiments stored in a separate `.wbh-history.json` sidecar.
- Added native VS Code Diff views for snapshots and experiment baselines/results.
- Added guarded Restore with an automatic pre-restore snapshot.
- Added automatic before/after history around saves and cross-worldbook copies.

## 0.1.3 - 2026-07-09

- Added the compact worldbook entry browser and detailed entry editor.
- Added direct editing for strategy, position, order, probability, depth, role, keyword logic, and content.
- Added per-entry and aggregate token estimates without enforcing a world-info budget.
- Added a collapsible ST-style prompt timeline with activation reasons.
- Added JSON and PNG character-card import plus optional embedded character-book support.
- Added reusable `.wbh.json` preview scenarios.
- Added marketplace icon, screenshots, and public documentation.

## 0.1.0 - 2026-07-03

- Added the first preview of the standalone Worldbook Workbench extension.
