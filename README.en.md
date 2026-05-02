# ZapDesk

[Ler este README em portugues](./README.md)

Alternative desktop client for WhatsApp Web on Windows.

ZapDesk was created for people who use WhatsApp on desktop but deal with the official Windows app freezing, feeling heavy, or failing at inconvenient times. WhatsApp Web works in the browser, but it gets mixed with other tabs and notifications are not always reliable. ZapDesk puts WhatsApp Web in its own window, with native notifications, tray icon support, and desktop shortcuts.

> ZapDesk does not automate messages, does not send bulk messages, does not spam, and does not try to bypass WhatsApp rules. It is only an alternative desktop client for normal WhatsApp Web usage.

## Download

If you only want to install and use it, download the latest installer:

[Download ZapDesk for Windows](https://github.com/coelhobugado/ZapDesk/releases/latest)

Full releases page:

[ZapDesk on GitHub Releases](https://github.com/coelhobugado/ZapDesk/releases)

## How To Use

1. Download the latest installer from the releases page.
2. Run the installer.
3. Open ZapDesk.
4. Scan the WhatsApp Web QR Code if requested.
5. After that, your session remains saved locally.

## Main Features

- WhatsApp Web in a dedicated desktop window.
- Persistent session, so you do not need to scan the QR Code every time.
- Native Windows notifications for new messages.
- Tray icon with open, hide, reload, and quit actions.
- Close button can minimize the app to tray.
- Unread counter in the title, tray, and taskbar icon overlay when supported.
- Discreet floating quick-action button.
- Optional always-on-top mode.
- Optional start with Windows.
- Local settings screen.
- External links open in the default browser.
- External navigation protection.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+W` | Show or hide the window |
| `Ctrl+R` | Reload WhatsApp Web |
| `Ctrl+Shift+Q` | Fully quit ZapDesk |

## Why It Exists

ZapDesk aims to be a more stable and focused way to use WhatsApp Web on Windows:

- the official app can freeze or feel heavy;
- WhatsApp Web in the browser gets lost among tabs;
- browser notifications can fail;
- closing the browser can interrupt your workflow;
- a dedicated window improves focus, organization, and quick access.

## Development

Requirements:

- Node.js 22 or newer
- npm
- Windows to build the `.exe` installer

Install dependencies:

```bash
npm ci
```

Run in development mode:

```bash
npm run dev
```

Create a local build:

```bash
npm run build
```

Run validations:

```bash
npm run lint
npm test
```

Create the installer:

```bash
npm run dist
```

The installer is generated at:

```text
release/ZapDesk-<version>-Setup.exe
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

## Privacy And Security

ZapDesk has no backend server and does not send messages, contacts, or sessions to third parties. Authentication and usage continue to happen through WhatsApp Web.

The app uses `contextIsolation: true`, `nodeIntegration: false`, sandboxing, a controlled preload, and external URL validation so dangerous APIs are not exposed to the renderer.

Local data, cache, and session files are kept out of the repository and ignored by Git.

## About Automation

This version does not use `whatsapp-web.js`. There is only an extension point at `src/main/optional/whatsappWebJsAdapter.ts` for a possible future optional integration, without implementing spam, bulk sending, or abusive automation.
