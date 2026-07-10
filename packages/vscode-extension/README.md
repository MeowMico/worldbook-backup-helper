# Worldbook Workbench

Edit SillyTavern worldbooks in VS Code or Cursor, then inspect where every activated entry lands in the final system/user/assistant message order.

Worldbook Workbench is a standalone companion to the SillyTavern extension. It works directly with exported worldbook JSON files and does not require a running SillyTavern instance.

## Install

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MeowMico.worldbook-workbench-vscode) for Microsoft Visual Studio Code.
- [Open VSX](https://open-vsx.org/extension/meowmico/worldbook-workbench-vscode) for Cursor, VSCodium, and other Open VSX clients.

Install from your editor's marketplace to receive normal extension updates. Manual `.vsix` installation is intended for local testing; Microsoft Visual Studio Code disables automatic updates for that extension by default.

![Worldbook Workbench entry editor and prompt preview](https://raw.githubusercontent.com/MeowMico/worldbook-backup-helper/main/packages/vscode-extension/media/screenshots/workbench-overview.png)

## Highlights

- Browse worldbook entries in a compact, searchable list.
- Select multiple entries to enable, disable, delete, or copy them into any other worldbook JSON file.
- Find, replace, or delete matching text across titles, keywords, and content in one batch.
- Edit title, strategy, position, order, probability, depth, role, keywords, selective logic, and content.
- See constant, selective, vectorized, disabled, triggered, and not-triggered states at a glance.
- Preview ST-style world-info placement as a system/user/assistant timeline.
- See why each entry activated or did not activate.
- Display token estimates for every entry, all entries, active world info, and the complete timeline.
- Import character cards from JSON or PNG metadata, including embedded character books.
- Save reusable chat and activation scenarios beside the worldbook.
- Create snapshots and named experiments, compare them in VS Code's native Diff editor, and restore earlier versions.
- Preserve unknown worldbook fields and the original object/array shape of `entries`.

## Quick Start

1. Open a folder containing an exported SillyTavern worldbook JSON file.
2. Right-click the JSON file and select **Worldbook Workbench: Open Worldbook Workbench**.
3. Select an entry to edit it, then choose **Save** to write changes back to the worldbook.
4. Choose **Preview** to inspect activation results and prompt order.

The same commands are available from the Command Palette. This is useful when an editor or file explorer context menu is not visible.

## Prompt Preview

The preview combines the selected worldbook, optional character card, and a local chat scenario. It shows the resulting message skeleton without pretending to reproduce a provider-specific API request wrapper.

![Prompt timeline with triggered and not-triggered entries](https://raw.githubusercontent.com/MeowMico/worldbook-backup-helper/main/packages/vscode-extension/media/screenshots/prompt-preview.png)

Strategy indicators use familiar worldbook states:

- Blue: selective entry
- Green: constant entry
- Purple: vectorized entry
- Gray: normal or disabled entry

Token profiles identify whether their result is exact for the selected tokenizer or an estimate. Unknown and unavailable tokenizers fall back to a clearly labeled estimate.

## Scenario Files

Preview settings are stored next to the worldbook as `<worldbook>.wbh.json`. A scenario can include:

- chat messages
- user and character names
- generation mode
- deterministic probability seed
- recursion and scan settings
- tokenizer profile
- manually forced entry IDs
- an optional character-card path

The sidecar file does not modify or add workbench metadata to the worldbook itself. Imported character cards are read-only.

## History Files

Snapshots and experiments are stored beside the worldbook as `<worldbook>.wbh-history.json`. The history file contains complete restore points, experiment baselines and results, and automatic before/after records for saves and cross-worldbook copies.

History never adds workbench fields to the worldbook JSON. Restoring a snapshot saves the current draft to history before writing the selected version, so the restore itself remains reversible.

## Compatibility Notes

The prompt engine is a clean-room compatibility implementation of common SillyTavern world-info behavior. It supports world-info positions, order, depth and role, keyword logic, probability, groups, recursion, scan depth, and timed activation state.

Vector search, automation hooks, and external outlet runtimes require SillyTavern or another host. The workbench identifies those entries and lets you force them active for placement inspection, but it does not make external runtime calls.

## Commands

- `Worldbook Workbench: Open Worldbook Workbench`
- `Worldbook Workbench: Import Character Card`
- `Worldbook Workbench: Open Prompt Preview`
- `Worldbook Workbench: Save Scenario`
- `Worldbook Workbench: Export Worldbook JSON`

## Privacy

Worldbooks, character cards, scenarios, and previews are processed locally. The extension does not upload their contents.

## Support

Report problems or request features in the [GitHub issue tracker](https://github.com/MeowMico/worldbook-backup-helper/issues).

Worldbook Workbench is released under the [MIT License](LICENSE).

## Development

```bash
npm install
npm run check
npm run package:openvsx
npm run package:microsoft
```

See the [publishing guide](https://github.com/MeowMico/worldbook-backup-helper/blob/main/docs/vscode-publishing.md) for the dual-market release workflow.
