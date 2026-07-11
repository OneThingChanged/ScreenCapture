# Releases and automatic updates

All GitHub release titles and release notes for ScreenCapture must be written in English only.

ScreenCapture uses `electron-updater` and GitHub Releases. Installed NSIS builds check for updates using these assets:

- `latest.yml`: version, installer filename, and SHA-512 metadata
- `ScreenCapture-Setup-<version>-x64.exe`: update-capable NSIS installer
- `ScreenCapture-Setup-<version>-x64.exe.blockmap`: differential-download metadata
- `ScreenCapture-Portable-<version>-x64.exe`: standalone portable build; it is not an automatic-update target

`electron-builder` writes the update endpoint to the packaged `app-update.yml`. Do not call `setFeedURL` in the application.

## Release procedure

1. Increase the `version` in `package.json` and synchronize the lockfile.
2. Run validation and create the release build.

```powershell
npm run typecheck
npm run release:build
```

3. Verify these artifacts:

```text
dist/ScreenCapture-Setup-<version>-x64.exe
dist/ScreenCapture-Setup-<version>-x64.exe.blockmap
dist/ScreenCapture-Portable-<version>-x64.exe
dist/latest.yml
```

4. Commit the source, push it, and push a `v<version>` tag.
5. Publish a non-draft, non-prerelease GitHub Release as Latest. Write its title and notes in English only, and attach all four artifacts.

```powershell
gh release create v<version> --latest --title "ScreenCapture v<version>" --notes-file <english-notes-file> `
  dist/ScreenCapture-Setup-<version>-x64.exe `
  dist/ScreenCapture-Setup-<version>-x64.exe.blockmap `
  dist/ScreenCapture-Portable-<version>-x64.exe `
  dist/latest.yml
```

## Requirements and cautions

- Automatic updates work only in installed NSIS builds. Development and portable builds must use the release page for manual updates.
- Publish the release as Latest so update checks can find it.
- Windows Authenticode signing is not configured, so SmartScreen may display a warning. The SHA-512 validation in `latest.yml` is separate from code signing.
- Never replace artifacts for an already published version. Publish every fix with a higher version number.
