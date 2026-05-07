# ZapDesk

<p align="center">
  <img src="assets/zapdesk.png" alt="ZapDesk" width="96" height="96" />
</p>

<h3 align="center">WhatsApp Web in a lighter, focused desktop window integrated with Windows.</h3>

<p align="center">
  <a href="https://github.com/coelhobugado/ZapDesk/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/coelhobugado/ZapDesk?label=release&style=for-the-badge"></a>
  <a href="https://github.com/coelhobugado/ZapDesk/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/coelhobugado/ZapDesk/total?style=for-the-badge"></a>
  <a href="https://github.com/coelhobugado/ZapDesk/actions/workflows/build.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/coelhobugado/ZapDesk/build.yml?style=for-the-badge"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=for-the-badge&logo=windows">
</p>

<p align="center">
  <a href="https://github.com/coelhobugado/ZapDesk/releases/latest"><strong>Download for Windows</strong></a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#development">Development</a>
  ·
  <a href="./README.md">README em portugues</a>
</p>

---

## What It Is

ZapDesk is an alternative desktop client for using WhatsApp Web on Windows with more focus, less friction, and native system integrations.

It was built for people who rely on WhatsApp on desktop but do not want customer chats hidden among browser tabs or interrupted by a heavy, unstable official app.

ZapDesk keeps WhatsApp Web in its own window with tray support, native notifications, unread counters, global shortcuts, persistent session storage, spell checking, and automatic updates.

> ZapDesk does not automate messages, does not send bulk messages, does not spam, and does not try to bypass WhatsApp rules. It is only an alternative desktop client for normal WhatsApp Web usage.

## Download

Install the latest version:

[Download ZapDesk for Windows](https://github.com/coelhobugado/ZapDesk/releases/latest)

Full releases page:

[View all published versions](https://github.com/coelhobugado/ZapDesk/releases)

The main installer follows this format:

```text
ZapDesk-<version>-Setup.exe
```

## Who It Is For

- People who use WhatsApp Web every day on Windows.
- Support, sales, service desks, reception teams, and small teams that need quick replies.
- Users who prefer a dedicated window instead of mixing WhatsApp with browser tabs.
- Anyone who wants notifications, tray support, shortcuts, and automatic updates without extra setup.

## Features

| Feature | Benefit |
| --- | --- |
| Dedicated WhatsApp Web window | Keeps WhatsApp separated from the browser and easier to find. |
| Persistent session | Avoids scanning the QR Code every time. |
| Windows tray support | Open, hide, reload, check updates, or quit from the tray icon. |
| Minimize on close | The close button can hide the app to tray instead of quitting. |
| Native notifications | Receive Windows alerts when new messages arrive. |
| Unread counter | Shows unread messages in the title, tray, and native surfaces when supported. |
| Global shortcuts | Show, hide, reload, or quit the app from the keyboard. |
| Always on top | Keep WhatsApp above other windows when you need to monitor chats. |
| Start with Windows | Open ZapDesk automatically after login. |
| Spell checker | Highlight misspelled words and use suggestions from the context menu. |
| Clickable external links | WhatsApp links open in the user's default browser. |
| Dark theme | Optional dark shell for the desktop app. |
| Cache and session cleanup | Reset local WhatsApp Web data when login or cache issues happen. |
| Automatic updates | Installed apps check new versions published through GitHub Releases. |
| Navigation protection | External URLs are validated before leaving the WhatsApp Web environment. |

## How To Use

1. Open the [latest release](https://github.com/coelhobugado/ZapDesk/releases/latest).
2. Download `ZapDesk-<version>-Setup.exe`.
3. Run the installer on Windows.
4. Open ZapDesk.
5. Scan the WhatsApp Web QR Code if requested.
6. Use it normally. Your session stays saved locally.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+W` | Show or hide the window |
| `Ctrl+R` | Reload WhatsApp Web |
| `Ctrl+Shift+Q` | Fully quit ZapDesk |

## Updates

ZapDesk uses GitHub Releases with `electron-updater`.

When a new version is published correctly, installed apps can detect, download, and install the update. Each release must include:

- `ZapDesk-<version>-Setup.exe`
- `ZapDesk-<version>-Setup.exe.blockmap`
- `latest.yml`

The `appId` must remain:

```text
com.zapdesk.app
```

Keeping this identifier stable lets Windows and the updater recognize the app as the same installation between versions.

## Privacy And Security

ZapDesk has no backend server and does not send messages, contacts, chats, or sessions to third parties. Authentication and usage continue to happen through WhatsApp Web.

The project is structured to reduce common Electron risks:

- `contextIsolation` enabled;
- `nodeIntegration` disabled;
- WhatsApp webview in an isolated persistent partition;
- controlled preload;
- origin validation for navigation;
- external links opened through the default browser;
- sensitive permissions requested only for WhatsApp Web;
- local data, cache, and session files kept out of the repository.

## Development

Requirements:

- Node.js 22 or newer
- npm
- Windows to build the `.exe` installer

Install dependencies:

```bash
npm ci
```

Run in development:

```bash
npm run dev
```

Run the main validations:

```bash
npm run lint
npm test
npm run build
```

Create the installer:

```bash
npm run dist
```

The local installer is generated at:

```text
release/ZapDesk-<version>-Setup.exe
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite renderer and Electron main process in development mode. |
| `npm run typecheck` | Validates TypeScript without emitting files. |
| `npm run lint` | Runs ESLint for the project. |
| `npm test` | Runs tests with Vitest. |
| `npm run build` | Builds the renderer and Electron code. |
| `npm run dist` | Creates the Windows installer with electron-builder. |
| `npm run clean` | Removes `dist` and `release`. |

## Project Structure

```text
src/main       Electron main process
src/preload    Safe bridge between renderer and main
src/renderer   React/Vite interface
src/shared     Shared types, settings, and utilities
assets         Runtime icon
build          Installer icon
release        Locally generated installers
```

## Stack

- Electron
- React
- Vite
- TypeScript
- electron-builder
- electron-updater
- electron-store
- Vitest
- ESLint

## Improvement Roadmap

Natural ideas for evolving ZapDesk:

- first-run onboarding screen;
- advanced notification preferences;
- additional visual themes;
- digitally signed installer;
- documentation page with screenshots;
- optional multi-profile support;
- accessibility improvements;
- optional local diagnostics, without message content.

## Contributing

Contributions are welcome when they keep the project simple, safe, and useful.

Before opening a pull request:

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run build`.
4. Clearly describe the problem being solved.
5. Avoid abusive automation, bulk messaging, or anything that violates WhatsApp rules.

## About Automation

This version does not use `whatsapp-web.js`. There is only an extension point at `src/main/optional/whatsappWebJsAdapter.ts` for a possible future optional integration, without implementing spam, bulk sending, or abusive automation.

## Disclaimer

ZapDesk is an independent and unofficial project. WhatsApp and WhatsApp Web belong to their respective owners. Use it while respecting the platform terms.
