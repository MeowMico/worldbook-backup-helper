# Changelog

All notable changes to the VS Code and Cursor extension are documented here.

## 0.2.9 - 2026-07-12

- Renamed the user-facing Scenario workspace to Preview Setup so it is not confused with the character-card Scenario field.
- Added a concise explanation that preview setup is stored separately and never exported into worldbook JSON.
- Added built-in English and Simplified Chinese user guides, available from the toolbar and Command Palette.

## 0.2.8 - 2026-07-12

- Added English and Simplified Chinese interfaces with an Auto mode that follows the VS Code or Cursor display language by default.
- Added a persistent language selector in the Workbench toolbar and the `worldbookWorkbench.language` editor setting.
- Localized Workbench controls, generated labels, history views, preview metadata, dialogs, notifications, and extension commands without changing worldbook or sidecar data formats.

## 0.2.7 - 2026-07-12

- Added an 80-step worldbook Undo/Redo history for entry edits, entry actions, batch replacements, and applied Raw JSON changes.

## 0.2.6 - 2026-07-12

- Fixed Advanced Entry Settings and scenario disclosure rows so they reliably expand in VS Code and Cursor webviews.
- Added visible disclosure indicators and scroll the first settings group into view after expanding.

## 0.2.5 - 2026-07-12

- Aligned entry status with SillyTavern 1.18: Normal, Constant, and Vectorized are the three statuses, while Optional Filter is controlled independently.
- Added a collapsed Advanced Entry Settings editor for per-entry overrides, recursion, budget behavior, inclusion groups, timed effects, character and generation filters, and additional matching sources.
- Added advanced scenario inputs for persona description, Character's Note, forced activation, sticky state, and cooldown state.
- Added Workbench and SillyTavern 1.18 activation presets without adding scenario settings to exported worldbook JSON.

## 0.2.4 - 2026-07-12

- Removed the redundant manual character-name field from the structured scenario editor while preserving legacy `charName` values in scenario JSON.
- Renamed Depth to Scan Depth and clarified that it controls world-info keyword scanning across recent chat messages.
- Added Scenario-only global activation controls for context budget, minimum activations, name and keyword matching, recursion limits, group scoring, overflow alerts, and character/global lore insertion strategy.

## 0.2.3 - 2026-07-11

- Aligned strategy indicator colors with SillyTavern conventions: blue for constant entries and green for keyword-triggered selective entries.

## 0.2.2 - 2026-07-11

- Renamed the entry search to Filter entries and the Batch tab to Find & Replace to clarify which controls modify content.
- Added a compact toggle that collapses the entry filter and multi-select tools.
- Added a top-level Experiments shortcut and clearer New experiment and Save result actions.

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
