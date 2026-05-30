# Worldbook Backup Helper

Local version workbench for SillyTavern worldbooks.

## What It Does

- Lists SillyTavern worldbooks for the current user.
- Creates timestamped JSON snapshots under the current user's backups directory.
- Lets you name versions, compare a snapshot against the current worldbook, and restore a snapshot.
- Can compare a selected snapshot against its previous snapshot.
- Includes an optional third-party extension that adds a menu entry and creates an automatic snapshot before `/api/worldinfo/edit` saves.

The plugin only works with worldbooks/lorebooks. It does not read character descriptions or chats.

## Recommended: Install As a UI Extension

This repository has a root `manifest.json`, so it can be installed from SillyTavern's third-party extension installer.

Open SillyTavern:

```text
Extensions -> Install extension -> paste this repository URL
```

In extension-only mode, snapshots are stored in the browser's IndexedDB. This gives you an in-Tavern workbench, automatic pre-save snapshots, labels, diff, and restore without installing a server plugin.

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
