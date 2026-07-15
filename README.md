# Worldbook Workbench

[Français](README.fr.md)

[中文说明](README.zh-CN.md)

Worldbook Workbench is a SillyTavern extension for editing, versioning, comparing, restoring, and exporting worldbooks/lorebooks.

It is designed for creators who test roleplay output while actively revising worldbuilding, character notes, rules, or setting entries. Instead of manually exporting a JSON file before every change, you can work inside SillyTavern and keep a local history of your worldbook edits.

## Features

- Edit SillyTavern worldbooks directly in an in-Tavern workbench.
- Use focused `Worldbooks`, `Entries`, `Edit`, and `History` views on phones and narrow screens, without changing the desktop three-column workspace.
- Automatically save an `Origin` snapshot the first time a worldbook is opened.
- Create named experiments with baseline/after snapshots for testing a specific change.
- Compare current, previous, baseline, after, and saved versions with highlighted diffs.
- Restore the origin, an experiment result, or any saved version.
- Find keywords across worldbook entries, jump between matches, replace matches, or delete matches.
- Multi-select entries and copy them to another worldbook while keeping entry content and settings.
- Bind MVU InitVar presets to character greetings and current chat opening swipes for author testing.
- Rename experiments, add experiment notes, and search experiment history.
- Export a single experiment/version JSON or export the full local history for one worldbook.
- Use the standalone VS Code/Cursor workbench for batch editing, cross-file copy, prompt preview, snapshots, experiments, Diff, and Restore.
- Supports English and Chinese UI.
- Includes light and dark themes.

The standard editing workflow works with worldbooks/lorebooks. The optional `MVU InitVar` tab reads the current character card greetings and current chat opening swipes only when you use that workflow.

## Installation

Open SillyTavern and install this repository as a third-party extension:

```text
Extensions -> Install extension -> paste this repository URL
```

Repository URL:

```text
https://github.com/MeowMico/worldbook-backup-helper
```

After installing, open the extension from the SillyTavern extensions menu.

## VS Code / Cursor Extension

This repository also contains a standalone preview extension for VS Code, Cursor, and other compatible editors under `packages/vscode-extension`.

Install it from the marketplace used by your editor:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=MeowMico.worldbook-workbench-vscode) for Microsoft Visual Studio Code.
- [Open VSX](https://open-vsx.org/extension/meowmico/worldbook-workbench-vscode) for Cursor, VSCodium, and other Open VSX clients.

See the [English user guide](packages/vscode-extension/USER_GUIDE.md) or [Simplified Chinese user guide](packages/vscode-extension/USER_GUIDE.zh-CN.md) for the complete editing, preview, and history workflow.

Marketplace installation is recommended because it enables normal extension updates. A manually installed `.vsix` is mainly intended for local testing.

It can:

- open a SillyTavern worldbook JSON file in a webview workbench
- import a character card from JSON or PNG metadata
- save preview setups as `<worldbook>.wbh.json` without exporting them into the worldbook
- browse entries in a compact list and edit strategy, position, order, keys, and content directly
- show an ST-style system/user/assistant timeline for activated worldbook entries
- explain activated and skipped entries, including keyword misses and group losers
- show total timeline/worldbook token estimates and token counts for every entry
- multi-select entries to enable, disable, delete, or copy them into another worldbook JSON file
- find, replace, or delete matching text across titles, keywords, and content
- undo or redo up to 80 in-session worldbook edits before saving
- display the standalone Workbench in English, Simplified Chinese, or the editor-following default mode
- save snapshots and experiments in `<worldbook>.wbh-history.json`, with native VS Code Diff and Restore

The preview engine lives in `packages/core`. It is a clean-room compatibility implementation and does not copy SillyTavern source. Token counts are profile based: OpenAI profiles use `tiktoken` when it is installed, otherwise the preview clearly falls back to an estimate.

Local development:

```bash
npm run check
npm test
cd packages/vscode-extension
npm install
npm run package:openvsx
npm run package:microsoft
```

See the [dual-market publishing guide](docs/vscode-publishing.md) for the release checklist and publisher identifiers.

## Recommended Workflow

1. Open `Worldbook Workbench`.
2. Select a worldbook.
3. Click `Start` and name the experiment, such as `trim mechanical wording` or `make the city rules stricter`.
4. Edit entries in the workbench.
5. Click `Save` to write the worldbook back to SillyTavern.
6. Use `Diff` to compare the baseline and after version.
7. Mark the experiment as `Keep` or `Reject`, add a note if useful, or restore a previous version.

`Save` is not a draft-only action. It writes the edited worldbook directly back to SillyTavern's native worldbook data, so no extra save step in the native editor is required. A before-save snapshot and an after-save snapshot are created automatically.

If you edit in SillyTavern's native worldbook editor instead of the workbench, click `Finish` after the change to capture the after snapshot.

## Workbench Editing

The `Edit` tab supports common SillyTavern worldbook entry fields, including:

- title/comment
- content
- primary and secondary keys
- constant, disabled, selective, vectorized
- insertion position, role, depth, order, probability
- recursion, grouping, scanning, triggers, character filters, and match sources
- sticky, cooldown, delay, automation ID, and outlet/anchor fields

The first time a worldbook is opened, the current state is saved as `Origin`. The origin snapshot is not overwritten by later edits.

When you click `Save`, the live SillyTavern worldbook is updated immediately. If the result is not what you wanted, use the history sidebar to restore `Origin`, an experiment baseline/after version, or another saved version.

## Search, Replace, and Delete

The workbench can search exact keywords across supported entry fields. It can:

- jump to the previous or next match
- select the matching text in place
- replace the current match
- replace all matches
- delete the current match
- delete all matches after confirmation

Search edits are added to the local undo stack.

## Copy Entries Between Worldbooks

In the `Edit` tab, select one or more entries with the checkboxes in the entry list, then click `Copy to...`.

Copied entries keep their content, keys, insertion position, role, depth, order, toggles, probability, grouping, triggers, filters, match sources, and other supported settings. New UIDs are generated in the target worldbook, so existing entries are not overwritten.

The target worldbook gets before-copy and after-copy snapshots automatically, so you can restore it if the copy was not what you wanted.

## MVU InitVar Presets

The `MVU InitVar` tab scans the current character card `first_mes`, `alternate_greetings`, and the current chat opening swipes. You can create InitVar presets, bind each opening to a preset, and sync the selected preset into the disabled `[initvar]变量初始化勿开` entry for local author testing.

For author-side testing, `Auto inject at opening` can be enabled while a new chat is still at the opening message. When you swipe to a bound opening, the workbench writes only the matched preset into the single disabled `[initvar]变量初始化勿开` worldbook entry and creates before/after history snapshots. If the MVU bundle has exposed `window.Mvu`, the workbench also asks MVU to reload InitVar data into the current opening swipe so authors can test the selected opening without sending a message.

For shareable cards, use `Copy player script` after your presets and opening bindings are ready. It copies a standalone JS-Slash-Runner/Tavern Helper character script with the preset map embedded. Paste it into the character script library so it exports with the card. On the player side, the script runs only at the opening message, watches the selected swipe, maintains the disabled `[initvar]变量初始化勿开` entry in the current character worldbook, and asks MVU to reload the selected preset into the current opening swipe.

The workflow keeps only one visible disabled worldbook entry, `[initvar]变量初始化勿开`. Presets and the opening map are stored inside that entry's extension metadata so ordinary worldbook editors do not show extra `[MVU_INIT_PRESET:...]` or `[MVU_INIT_MAP]` entries. Older workbench data using those entries is migrated into the `[initvar]` metadata the next time the worldbook is saved through the workbench. The workbench remains an author-side tool; the copied character script is the optional player-side runtime.

## Experiments

Experiments are meant for small, testable changes.

`Start` captures the baseline. `Save` or `Finish` captures the after version. Each experiment can have:

- a name
- a note
- a baseline snapshot
- an after snapshot
- a keep/reject status

Experiment names and notes are searchable in the history sidebar.

## Export

You can export:

- a single experiment JSON
- a single saved version JSON
- all local history for the selected worldbook

This can be useful for organizing creative files or sharing a specific revision.

## Storage and Privacy

When the companion server plugin is available, snapshots and experiments are stored as JSON files under SillyTavern's user backup directory:

```text
backups/worldbook-backup-helper/<worldbook>/
```

When server file storage is available, existing browser IndexedDB history is copied into that folder automatically. The old browser copy is left in place as a fallback.

In extension-only mode, snapshots and experiments are still stored locally in the browser's IndexedDB for the current SillyTavern browser profile.

The extension reads and writes worldbooks through SillyTavern's worldbook API. The `MVU InitVar` tab also reads the current in-page character greetings and current chat opening swipes for binding presets. It does not read cookies, API keys, browser profiles, or unrelated local files.

## Compatibility

Built and tested against SillyTavern `1.17.0` public source.

The project uses the standard SillyTavern third-party extension format with a root `manifest.json`.

TauriTavern is supported through the same repository link. The extension detects the TauriTavern host and marks the workbench as a fullscreen mobile/desktop surface so the panel can respect TauriTavern viewport and safe-area behavior.

## Known Limits

- Extension-only history is browser-local. If browser data is cleared before server-file migration or manual export, local history may be lost.
- Importing external experiment archives is not implemented yet.
- The extension focuses on worldbooks/lorebooks, not character card description editing.

## License

MIT License. See [LICENSE](LICENSE).
