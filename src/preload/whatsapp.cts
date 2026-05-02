import { ipcRenderer } from 'electron';

const OPEN_EXTERNAL_CHANNEL = 'shell:open-external-from-webview';
const DEBUG_CHANNEL = 'zapdesk-webview-debug';
const HOST_OPEN_EXTERNAL_CHANNEL = 'zapdesk-open-external';
const INSTALL_FLAG = '__zapdeskWhatsAppLinkBridgeInstalled';
const ATTRIBUTE_CANDIDATES = [
  'href',
  'data-url',
  'data-href',
  'data-link',
  'data-ref',
  'data-plain-text',
  'aria-label',
  'title'
];
const MAP_MEDIA_ATTRIBUTES = ['src', 'data-src'];

type BridgeGlobal = typeof globalThis & {
  [INSTALL_FLAG]?: boolean;
};

function trimCandidate(value: string): string {
  return value
    .trim()
    .replace(/^[<([{"']+/, '')
    .replace(/[>\])}"'.,;!?]+$/, '');
}

function extractCandidate(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = trimCandidate(value);
  if (!trimmed) return null;

  const protocolMatch = trimmed.match(/\b(?:https?:\/\/|mailto:|tel:|geo:|maps:)[^\s<>"']+/i);
  if (protocolMatch) return trimCandidate(protocolMatch[0]);

  const bareDomainMatch = trimmed.match(/\b(?:www\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)[^\s<>"']+/i);
  if (bareDomainMatch) return trimCandidate(bareDomainMatch[0]);

  const coordinateMatch = trimmed.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!coordinateMatch) return null;
  if (!coordinateMatch[1].includes('.') || !coordinateMatch[2].includes('.')) return null;

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return `${latitude},${longitude}`;
}

function isWhatsAppUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, window.location.href);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'web.whatsapp.com';
  } catch {
    return false;
  }
}

function isMapLikeCandidate(value: string): boolean {
  return /maps|googleapis|geo:|localiza|location|-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+/i.test(value);
}

function debugBridge(eventName: string, details: Record<string, unknown>): void {
  const payload = { eventName, details };
  ipcRenderer.send(DEBUG_CHANNEL, payload);
  ipcRenderer.sendToHost(DEBUG_CHANNEL, payload);
}

function describeClickTarget(event: MouseEvent): Record<string, unknown> {
  const target = event.target;
  if (!(target instanceof Element)) return { targetType: typeof target };

  const clickable = target.closest('a,[role="link"],[role="button"],button');
  return {
    tagName: target.tagName,
    clickableTagName: clickable?.tagName ?? null,
    role: target.getAttribute('role') ?? clickable?.getAttribute('role') ?? null,
    hasHref: Boolean(target.closest('a[href]')),
    ariaLabel: target.getAttribute('aria-label') ?? clickable?.getAttribute('aria-label') ?? null,
    title: target.getAttribute('title') ?? clickable?.getAttribute('title') ?? null
  };
}

function findAttributeCandidate(start: Element): string | null {
  let element: Element | null = start;
  let depth = 0;

  while (element && element !== document.body && depth < 8) {
    for (const attribute of ATTRIBUTE_CANDIDATES) {
      const candidate = extractCandidate(element.getAttribute(attribute));
      if (candidate) return candidate;
    }

    for (const attribute of MAP_MEDIA_ATTRIBUTES) {
      const rawValue = element.getAttribute(attribute);
      const candidate = extractCandidate(rawValue);
      if (candidate && isMapLikeCandidate(rawValue ?? candidate)) return candidate;
    }

    const backgroundImage = window.getComputedStyle(element).backgroundImage;
    const styleCandidate = extractCandidate(backgroundImage);
    if (styleCandidate && isMapLikeCandidate(backgroundImage)) return styleCandidate;

    element = element.parentElement;
    depth += 1;
  }

  return null;
}

function findTextCandidate(start: Element): string | null {
  const clickable = start.closest('a,[role="link"],[role="button"],button');
  if (!clickable?.textContent || clickable.textContent.length > 500) return null;

  return extractCandidate(clickable.textContent);
}

function findClickCandidate(event: MouseEvent): string | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest('a[href]');
  if (anchor instanceof HTMLAnchorElement) {
    return extractCandidate(anchor.getAttribute('href')) ?? extractCandidate(anchor.href);
  }

  return findAttributeCandidate(target) ?? findTextCandidate(target);
}

function openExternal(rawUrl: string | null): boolean {
  const candidate = extractCandidate(rawUrl);
  if (!candidate || isWhatsAppUrl(candidate)) return false;

  ipcRenderer.send(OPEN_EXTERNAL_CHANNEL, candidate);
  ipcRenderer.sendToHost(HOST_OPEN_EXTERNAL_CHANNEL, candidate);
  return true;
}

function handleClick(event: MouseEvent): void {
  if (event.defaultPrevented) return;

  const candidate = findClickCandidate(event);
  debugBridge('click', { candidate, target: describeClickTarget(event) });

  if (!openExternal(candidate)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
}

function handleMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!event.data || typeof event.data !== 'object') return;

  const payload = event.data as { type?: unknown; url?: unknown };
  if (payload.type !== 'zapdesk:open-external' || typeof payload.url !== 'string') return;

  openExternal(payload.url);
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal[INSTALL_FLAG]) {
  bridgeGlobal[INSTALL_FLAG] = true;
  document.documentElement.setAttribute('data-zapdesk-link-bridge', 'ready');
  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleClick, true);
  window.addEventListener('message', handleMessage);
  debugBridge('installed', { href: window.location.href });
}
