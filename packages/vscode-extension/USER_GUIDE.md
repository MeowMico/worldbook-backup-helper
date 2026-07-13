# Worldbook Workbench User Guide

[简体中文](USER_GUIDE.zh-CN.md)

Worldbook Workbench edits exported SillyTavern worldbook JSON files in VS Code and Cursor. It can also simulate world-info activation and placement without requiring a running SillyTavern instance.

## Quick Start

1. Open a folder containing a SillyTavern worldbook JSON file.
2. Right-click the file and choose **Worldbook Workbench: Open Worldbook Workbench**.
3. Select an entry in the left column and edit it in the middle column.
4. Choose **Save** to write the current draft back to the original worldbook.
5. Choose **Preview** to inspect which entries trigger and where they enter the message timeline.

All commands are also available from the Command Palette. Use the `?` button in the Workbench toolbar to reopen this guide.

## What Gets Saved

| File | Purpose | Included when exporting the worldbook? |
| --- | --- | --- |
| `<worldbook>.json` | The worldbook itself | Yes |
| `<worldbook>.wbh.json` | Preview messages and activation settings | No |
| `<worldbook>.wbh-history.json` | Snapshots and experiments | No |

The sidecar files are kept beside the worldbook. Workbench metadata is not added to the worldbook JSON.

## Entry Editor

The entry browser supports filtering, multi-selection, enable, disable, delete, duplicate, and cross-worldbook copy. Selecting an entry opens its editable fields.

### Status

- **Normal** uses keyword activation and has a green indicator.
- **Constant** is always active while enabled and has a blue indicator.
- **Vectorized** depends on a compatible SillyTavern vector runtime. The Workbench can display and edit it but does not run vector search itself.

**Use Optional Filter** is SillyTavern's secondary-keyword/selective logic. It is independent of entry status.

### Placement

- **Position** chooses the prompt bucket, such as Before Character, After Character, Author's Note, Example Messages, At Depth, or Outlet.
- **Order** sorts entries that share a compatible insertion bucket.
- **Depth** and **Role** appear for At Depth entries.
- **Probability** is only evaluated when **Use Probability** is enabled.

### Advanced Entry Settings

Open the disclosure below Content for SillyTavern-compatible overrides, recursion controls, inclusion groups, sticky/cooldown/delay values, character filters, generation filters, and additional matching sources.

Some fields require a SillyTavern runtime to have an effect, including vector search, Automation ID hooks, and external Outlet consumers. They are preserved when editing and exporting.

## Preview Setup

**Preview Setup is a local test environment.** It is stored separately and is not exported into the worldbook.

Use it to provide the context needed to answer these questions:

- Which keyword entries activate for this conversation?
- Why did another entry not activate?
- In what system/user/assistant order will active entries appear?
- How do scan depth, recursion, grouping, probability, and insertion strategy change the result?

### Chat Messages

Add ordered system, user, and assistant messages that represent the conversation before the current turn. Keyword matching scans these messages according to **Scan Depth**.

Use **Last Human Message** for the optional current user turn. It is appended after Chat Messages for activation scanning and prompt-order preview, so a Depth 0 entry appears after it at the bottom of the prompt.

Keep portable macros such as `{{user}}` in worldbook content. The Workbench does not require a custom user name for preview setup.

### Global Activation Settings

These controls model SillyTavern-style world-info activation. **Workbench defaults** restore the recommended authoring setup: Scan Depth 2, Context 100%, Recursive Scan enabled, and optional caps disabled.

Token counts are descriptive by default. Context percentage and budget cap only restrict preview activation when you deliberately configure them.

### Advanced Preview Settings

- **Preview Generation Type** tests entries filtered to Normal, Continue, Impersonate, Swipe, Regenerate, or Quiet generation events.
- **Force Activate IDs** places selected entries into the preview even when their external runtime is unavailable.
- **Sticky Active IDs** and **Cooldown Active IDs** simulate state normally carried between SillyTavern generations.
- **Preview Seed** keeps probability and group selection deterministic between repeated previews.

Choose **Save Preview Setup** to write these settings to `<worldbook>.wbh.json`. This is optional; Preview works with unsaved setup changes too.

## Prompt Preview

Choose **Preview** after changing the worldbook or preview setup.

The right column shows:

- triggered and not-triggered entry counts
- token counts for all entries, active world info, and the complete timeline
- a system/user/assistant timeline in insertion order
- the activation or rejection reason for each entry
- warnings for behavior that needs a SillyTavern runtime

Select a previewed worldbook entry to return to its editor.

The timeline is an ST-style message skeleton. It does not claim to reproduce provider-specific API wrappers.

## Find and Replace

The **Find & Replace** tab can search titles, keywords, and content. Select the fields to include and enable **Case-sensitive** only when letter case must match exactly.

**Replace all** changes every match. **Delete matches** removes only the matched text, not the whole entry. Both actions can be undone before saving.

## Undo, Redo, and History

Toolbar Undo and Redo cover up to 80 unsaved worldbook edits in the current Workbench session. Continuous typing in one field is grouped into one step. Saving or restoring clears this in-session stack.

The **History** tab provides durable records:

- **Snapshot** captures the current worldbook draft.
- **New experiment** captures a named baseline.
- **Save result** records the edited result for Diff or Restore.
- **Diff** opens VS Code's native comparison editor.
- **Restore** first protects the current draft, then loads the selected version.

History is stored in `<worldbook>.wbh-history.json`, not in the worldbook.

## Raw JSON

The **JSON** tab edits the complete worldbook document. Choose **Apply JSON** to validate the draft and load it into the structured editor, then choose **Save** to write it to disk.

Applying JSON is undoable. Invalid JSON is not applied. Unknown worldbook fields and the original object/array shape of `entries` are preserved.

The advanced JSON editor under Preview Setup works the same way but changes only the `.wbh.json` preview sidecar.

## Save and Export

- **Save** writes the current worldbook draft to the file you opened and records automatic before/after history.
- **Export JSON** writes a clean worldbook JSON copy to a chosen location.
- **Save Preview Setup** writes only the separate `.wbh.json` file.

## Language

The toolbar language menu offers **Follow VS Code/Cursor**, **English**, and **Simplified Chinese**. Follow mode is the default. Language changes update the open Workbench without discarding edits.

## Troubleshooting

If the right-click command is missing, trust the workspace, run **Developer: Reload Window**, and try the Command Palette command instead.

When testing a local `.vsix`, close existing Workbench tabs after installation, reload the editor window, and reopen the worldbook. Microsoft VS Code normally disables marketplace auto-update for an extension installed manually from VSIX.

Worldbooks, preview setup files, and history are processed locally and are not uploaded by the extension.
