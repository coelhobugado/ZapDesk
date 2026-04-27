# ZapDesk

ZapDesk is a Windows desktop client built with Electron, TypeScript, React, and Vite. It loads WhatsApp Web inside its own desktop window and adds practical desktop features that the browser and the official Windows app do not always handle well.

The project was created for a simple reason: the official WhatsApp app for Windows can freeze, feel heavy, or fail at inconvenient times. WhatsApp Web works, but it gets lost among browser tabs and notifications are not always reliable. ZapDesk aims to fill that gap with a stable, focused desktop wrapper for personal use.

> ZapDesk does not automate messages, does not send bulk messages, does not spam, and does not try to bypass WhatsApp rules. It is only an alternative desktop client for normal WhatsApp Web usage.

## Features

- WhatsApp Web in a dedicated desktop window.
- Persistent session, so you do not need to scan the QR Code every time.
- Windows tray icon with quick actions.
- Close button can minimize the app to tray.
- Native Windows notifications for new messages.
- Unread counter in the window title, tray, and taskbar icon overlay when supported.
- Discreet floating quick-action button.
- Global shortcuts:
  - `Ctrl+Shift+W`: show/hide window
  - `Ctrl+R`: reload WhatsApp
  - `Ctrl+Shift+Q`: fully quit the app
- Optional always-on-top mode.
- Optional start with Windows.
- Local settings screen.
- External navigation protection.
- External links open in the default browser.
- Secure preload with `contextIsolation: true` and `nodeIntegration: false`.

## Download

Download the latest version from GitHub Releases.

Published files:

- `ZapDesk-1.0.5-Setup.exe`: Windows installer.
- `ZapDesk-1.0.5-Portable.zip`: portable/unpacked version.

## Development

Requirements:

- Node.js 22 or newer
- npm
- Windows to build the `.exe` installer

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Create a local build:

```bash
npm run build
```

Create the installer:

```bash
npm run dist
```

The installer is generated at:

```text
release/ZapDesk-1.0.5-Setup.exe
```

## Structure

```text
src/main       Electron main process
src/preload    Safe bridge between renderer and main
src/renderer   React/Vite interface
src/shared     Shared types and utilities
assets         Runtime icon
build          Installer icon
```

## Updates

The `appId` should remain `com.zapdesk.app`. For new versions, change only `version` in `package.json`; this allows the installer to replace the existing installation instead of creating a separate app.

The local WhatsApp session is stored in the user's app data and is not removed during updates.

## About automation

This version does not use `whatsapp-web.js`. There is only an extension point at `src/main/optional/whatsappWebJsAdapter.ts` for a possible future optional integration, without implementing spam, bulk sending, or abusive automation.

## Privacy

ZapDesk has no backend server and does not send messages, contacts, or sessions to third parties. Authentication and usage continue to happen through WhatsApp Web.

Local data, cache, and session files are kept out of the repository and ignored by Git.
