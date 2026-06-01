# Worldbook Workbench

[中文说明](README.zh-CN.md)

Worldbook Workbench is a SillyTavern extension for editing, versioning, comparing, restoring, and exporting worldbooks/lorebooks.

It is designed for creators who test roleplay output while actively revising worldbuilding, character notes, rules, or setting entries. Instead of manually exporting a JSON file before every change, you can work inside SillyTavern and keep a local history of your worldbook edits.

## Features

- Edit SillyTavern worldbooks directly in an in-Tavern workbench.
- Automatically save an `Origin` snapshot the first time a worldbook is opened.
- Create named experiments with baseline/after snapshots for testing a specific change.
- Compare current, previous, baseline, after, and saved versions with highlighted diffs.
- Restore the origin, an experiment result, or any saved version.
- Find keywords across worldbook entries, jump between matches, replace matches, or delete matches.
- Rename experiments, add experiment notes, and search experiment history.
- Export a single experiment/version JSON or export the full local history for one worldbook.
- Supports English and Chinese UI.
- Includes light and dark themes.

The extension only works with worldbooks/lorebooks. It does not read chats or character descriptions.

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

## Recommended Workflow

1. Open `Worldbook Workbench`.
2. Select a worldbook.
3. Click `Start` and name the experiment, such as `trim mechanical wording` or `make the city rules stricter`.
4. Edit entries in the workbench.
5. Click `Save` to write the worldbook back to SillyTavern.
6. Use `Diff` to compare the baseline and after version.
7. Mark the experiment as `Keep` or `Reject`, add a note if useful, or restore a previous version.

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

## Search, Replace, and Delete

The workbench can search exact keywords across supported entry fields. It can:

- jump to the previous or next match
- select the matching text in place
- replace the current match
- replace all matches
- delete the current match
- delete all matches after confirmation

Search edits are added to the local undo stack.

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

In extension-only mode, snapshots and experiments are stored locally in the browser's IndexedDB for the current SillyTavern browser profile.

The extension reads and writes worldbooks through SillyTavern's worldbook API. It does not read chats, cookies, API keys, browser profiles, or unrelated local files.

## Compatibility

Built and tested against SillyTavern `1.17.0` public source.

The project uses the standard SillyTavern third-party extension format with a root `manifest.json`.

## Known Limits

- Extension-only snapshots are browser-local. If browser data is cleared, local history may be lost.
- Importing external experiment archives is not implemented yet.
- The extension focuses on worldbooks/lorebooks, not character card description editing.

## License

MIT License. See [LICENSE](LICENSE).
