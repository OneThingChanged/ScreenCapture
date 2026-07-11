# Architecture

ScreenCapture is an Electron application with a React renderer and TypeScript across all process boundaries.

## Process layout

```text
Electron main process
├─ Persistent main BrowserWindow
│  └─ React workspace: Capture / Manage / Edit
├─ Region overlay BrowserWindow
├─ Window picker BrowserWindow
├─ Hidden recording BrowserWindow
├─ Windows tray integration
├─ Global shortcut registration
└─ Capture, storage, media, ffmpeg, and updater services
```

The preload layer exposes a context-isolated API. Renderers do not receive direct Node.js or Electron access.

## Main workspace

`src/renderer/app` owns the persistent tab interface. Navigation changes React state instead of destroying and recreating the application window. Region selection and window selection remain separate transient windows because they must appear above other desktop content.

## Capture flow

1. A capture card or global shortcut calls the main action handler.
2. The cursor position is sampled immediately and mapped to an Electron `Display`.
3. The main window is excluded from capture with content protection.
4. `desktopCapturer` sources are matched by `display_id`, Windows source index, or source order.
5. Region and window modes open their transient selector.
6. The result is saved, copied, and/or sent to the editor according to the stored compatibility setting.

The display mapping logic is centralized in `src/main/displays.ts` so screenshot and recording paths use the same fallback behavior.

## Recording flow

Recording resolves a screen or window source in the main process, then sends the source id, FPS, and optional crop rectangle to a hidden recording renderer. The renderer uses `MediaRecorder`. The main process stores the WebM buffer and invokes the bundled ffmpeg binary for MP4 or GIF output.

## Media management

The main process owns filesystem access. A restricted `sc-media://` protocol serves approved local media to the renderer, enabling in-app video playback without exposing arbitrary filesystem URLs. Images can also be returned as data URLs for editing.

## Tray and lifecycle

The `closeToTray` setting controls the main window close event. When enabled, ScreenCapture hides the main window, keeps global shortcuts active, and recreates the Tray object to ensure Windows receives a fresh notification-area registration. When disabled, closing the main window quits the process.

## Updates

Installed NSIS builds use `electron-updater` with GitHub Releases. `latest.yml`, the installer, and its blockmap provide automatic-update metadata. Portable builds use the GitHub release page for manual updates.
