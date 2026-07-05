# Worldbook Workbench for VSCode/Cursor

Experimental VSCode/Cursor package for editing SillyTavern worldbook JSON files and previewing ST-style prompt composition.

## Commands

- `Worldbook Workbench: Open Worldbook Workbench`
- `Worldbook Workbench: Import Character Card`
- `Worldbook Workbench: Open Prompt Preview`
- `Worldbook Workbench: Save Scenario`
- `Worldbook Workbench: Export Worldbook JSON`

Preview scenarios are saved next to the worldbook as `<worldbook>.wbh.json`.

## Development

```bash
npm install
npm run check
npx vsce package
```
