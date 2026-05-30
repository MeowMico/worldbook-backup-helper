# Worldbook Backup Helper

Local version workbench for SillyTavern worldbooks.

## What It Does

- Lists SillyTavern worldbooks for the current user.
- Provides an in-extension workbench for editing common worldbook entry fields.
- Creates timestamped JSON snapshots under the current user's backups directory.
- Lets you name versions, compare a snapshot against the current worldbook, and restore a snapshot.
- Can compare a selected snapshot against its previous snapshot.
- Adds an experiment workflow for RP-driven edits: Start captures a baseline, Finish captures the edited result, Keep/Reject marks the attempt, and Baseline/After can restore either point.
- Includes an optional third-party extension that adds a menu entry and creates automatic before/after snapshots around `/api/worldinfo/edit` saves.

The plugin only works with worldbooks/lorebooks. It does not read character descriptions or chats.

## Recommended: Install As a UI Extension

This repository has a root `manifest.json`, so it can be installed from SillyTavern's third-party extension installer.

Open SillyTavern:

```text
Extensions -> Install extension -> paste this repository URL
```

In extension-only mode, snapshots are stored in the browser's IndexedDB. This gives you an in-Tavern workbench, entry editing, automatic before/after snapshots, labels, diff, and restore without installing a server plugin.

## Workbench Editing

The `Edit` tab reads the selected worldbook through SillyTavern's worldbook API and lets you create, duplicate, delete, and edit entries directly in the extension:

- title/comment
- content
- primary and secondary keys
- constant, disabled, selective, vectorized
- position, role, depth, order, probability
- recursion, matching, grouping, character filters, triggers, and sticky/cooldown/delay fields

Click `Save` to write the edited worldbook back to SillyTavern. A before-save snapshot and after-save snapshot are created automatically. If an experiment is selected, `Save` also updates that experiment's `After` version, so you do not need to click `Finish` for edits made inside the workbench.

## Experiment Workflow

Use this when you are testing a worldbook change against a specific RP problem:

1. Open `Worldbook Backups` from the extensions menu.
2. Select the worldbook.
3. Click `Start` and name the problem or attempt. This captures the current worldbook as the baseline.
4. Edit the worldbook in the workbench and click `Save`, or edit it in SillyTavern as usual.
5. If you edited in SillyTavern's native worldbook panel, click `Finish` and write a short note. If you edited in the workbench, `Save` already captures the after version.
6. Use the experiment diff to compare baseline against after, then mark the attempt as `Keep` or `Reject`.

`Baseline` restores the worldbook to the version before the attempt. `After` restores the finished attempt. Manual snapshots and automatic before/after snapshots still remain available in the Versions list.

## Optional: Install As Server Plugin

Copy or clone this folder into:

```text
SillyTavern/plugins/worldbook-backup-helper/
```

In `config.yaml`, server plugins must be enabled:

```yaml
enableServerPlugins: true
```

Restart SillyTavern, then open:

```text
http://127.0.0.1:8000/api/plugins/worldbook-backup-helper/ui
```

Use your SillyTavern port if it is not `8000`.

When the server plugin is present, the UI extension will open the server-backed workbench instead of the browser-only workbench.

## Backup Location

Server-plugin snapshots are stored under the current user's backup directory:

```text
data/<user>/backups/worldbook-backup-helper/<worldbook-name>/
```

Each file is named with a timestamp and a content hash:

```text
2026-05-30_21-14-03-123__abcdef1234.json
```

Extension-only snapshots are stored in browser IndexedDB and are not visible as files.

## Compatibility Notes

Checked against SillyTavern `1.17.0` public source:

- Worldbooks are read and written through the user's `directories.worlds`.
- Native worldbook saves use `/api/worldinfo/edit`.
- Server plugin routes are mounted at `/api/plugins/{id}/...`.
- Third-party extensions are loaded from the current user's extensions directory.
