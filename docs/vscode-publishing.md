# VS Code / Cursor Publishing

Worldbook Workbench is published to two extension registries. They use publisher identifiers with different casing, so each release produces two VSIX files from the same source.

## Marketplace Identities

| Registry | Clients | Publisher | Extension ID |
| --- | --- | --- | --- |
| Open VSX | Cursor, VSCodium, Open VSX clients | `meowmico` | `meowmico.worldbook-workbench-vscode` |
| Visual Studio Marketplace | Microsoft Visual Studio Code | `MeowMico` | `MeowMico.worldbook-workbench-vscode` |

Do not edit the source manifest for a release. The packaging helper applies the target publisher temporarily and restores `package.json`, including when packaging fails or is interrupted.

## Release Checklist

1. Increase the extension version in `packages/vscode-extension/package.json`, `packages/core/package.json`, and `packages/webview-ui/package.json`.
2. Update `packages/vscode-extension/CHANGELOG.md`.
3. Run the checks:

   ```bash
   npm run check
   npm test
   npm run vscode:check
   ```

4. Build both packages:

   ```bash
   npm --prefix packages/vscode-extension run package:openvsx
   npm --prefix packages/vscode-extension run package:microsoft
   ```

5. Upload the standard VSIX to [Open VSX](https://open-vsx.org/user-settings/extensions).
6. Upload the `-microsoft.vsix` file to the [Visual Studio Marketplace publisher portal](https://marketplace.visualstudio.com/manage).
7. Wait for both registries to finish verification, then test a marketplace installation in Cursor and Microsoft Visual Studio Code.

Each registry requires a new version number for every update. Keep both stores on the same extension version.

## Output Files

For version `X.Y.Z`, the commands create:

- `worldbook-workbench-vscode-X.Y.Z.vsix` for Open VSX.
- `worldbook-workbench-vscode-X.Y.Z-microsoft.vsix` for Visual Studio Marketplace.

VSIX files are ignored by Git and must not be committed. Access tokens and publisher credentials must never be added to the repository or pasted into issues or chat messages.

## Installation Sources

- [Visual Studio Marketplace listing](https://marketplace.visualstudio.com/items?itemName=MeowMico.worldbook-workbench-vscode)
- [Open VSX listing](https://open-vsx.org/extension/meowmico/worldbook-workbench-vscode)

Users should install from their editor's marketplace to receive automatic updates. A manually installed VSIX has automatic updates disabled by default in Microsoft Visual Studio Code.
