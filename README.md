# ScreenCapture

[한국어](docs/README.ko.md)

ScreenCapture is a Windows desktop app for screenshots, screen recording, media management, and lightweight editing. It is built with Electron, React, and TypeScript.

## Features

- Persistent dark-themed workspace with Capture, Manage, and Edit tabs
- Region, window, and full-screen screenshots
- Region, window, and full-screen recording with mixed Windows system audio and default microphone input to MP4
- Six configurable global shortcuts, including modifier-key combinations
- High-DPI image editor with accurate cursor-aligned annotations, object selection, resizing, and `Ctrl+Z` undo
- Image annotation tools: pen, arrow, rectangle, ellipse, text, mosaic, color, and stroke width
- Image import, clipboard copy, and Save As support
- Media library with image previews, video playback, scrolling, search, rename, delete, and Reveal in File Explorer
- Frame editor with keyboard navigation, deleted-frame `Ctrl+Z` undo, and GIF/MP4 export
- Video compression
- Optional tray mode: keep the app running in the tray or quit immediately when the main window closes
- Update checks through GitHub Releases

## Default shortcuts

| Action | Shortcut |
| --- | --- |
| Capture region | `Ctrl+Shift+1` |
| Capture window | `Ctrl+Shift+2` |
| Capture full screen | `Ctrl+Shift+3` |
| Record region | `Ctrl+Shift+4` |
| Record window | `Ctrl+Shift+5` |
| Record full screen | `Ctrl+Shift+R` |

Shortcuts can be changed in Settings. Press **Change**, then enter the complete key combination you want to use.

Captured files are stored in `Pictures\ScreenCapture` by default.

## Documentation

- [Documentation index](docs/README.md)
- [Korean user guide](docs/USER_GUIDE.ko.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Release and update procedure](docs/RELEASE.md)

## Development

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

## Packaging

```powershell
npm run pack            # Unpacked application
npm run pack:installer  # NSIS installer
npm run release:build   # NSIS installer, portable build, blockmap, and latest.yml
```

`electron-builder` may require permission to create symbolic links while extracting its Windows signing tools. Enable Windows Developer Mode or run the terminal as an administrator if packaging fails at that step. `npm run pack` does not require code signing.

See [docs/RELEASE.md](docs/RELEASE.md) for the release and auto-update procedure.

## Project structure

```text
src/
  main/          Electron main process, capture, recording, tray, shortcuts, IPC, storage
  preload/       Context-isolated renderer API
  renderer/app/  React workspace for Capture, Manage, and Edit
  renderer/      Capture overlays and the hidden recording renderer
  shared/        Shared IPC and data types
resources/       Application icons and icon generation scripts
scripts/         Packaging scripts
```

## Regenerating icons

```powershell
npm run icon
```
