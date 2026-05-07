import { ipcRenderer } from 'electron';

const OPEN_EXTERNAL_CHANNEL = 'shell:open-external-from-webview';
const INSTALL_FLAG = '__zapdeskWhatsAppLinkBridgeInstalled';

type BridgeGlobal = typeof globalThis & {
  [INSTALL_FLAG]?: boolean;
};

function isWhatsAppClickToChatUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, window.location.href);
    const host = url.hostname.toLowerCase();
    return host === 'wa.me' || host === 'api.whatsapp.com';
  } catch {
    return false;
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.getAttribute('target') !== '_blank') return;
  if (isWhatsAppClickToChatUrl(anchor.href)) return;

  event.preventDefault();
  ipcRenderer.send(OPEN_EXTERNAL_CHANNEL, anchor.href);
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal[INSTALL_FLAG]) {
  bridgeGlobal[INSTALL_FLAG] = true;
  document.addEventListener('click', handleClick, true);
}
