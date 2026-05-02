export const whatsappHomeUrl = 'https://web.whatsapp.com/';
export const whatsappPartition = 'persist:zapdesk-whatsapp';

const whatsappMainHostname = 'web.whatsapp.com';

const allowedResourceHostnames = new Set([
  'web.whatsapp.com',
  'whatsapp.com',
  'www.whatsapp.com',
  'static.whatsapp.net',
  'mmg.whatsapp.net',
  'media.whatsapp.net',
  'pps.whatsapp.net',
  'pps.whatsapp.com',
  'scontent.whatsapp.net',
  'lookaside.whatsapp.com',
  'facebook.com',
  'www.facebook.com',
  'fbcdn.net'
]);

const allowedResourceSuffixes = ['.whatsapp.net', '.whatsapp.com', '.facebook.com', '.fbcdn.net'];
const safeExternalProtocols = new Set(['https:', 'http:', 'mailto:', 'tel:']);

function normalizeCoordinateQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function normalizeExternalUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const directUrl = parseUrl(trimmed);
  if (directUrl && safeExternalProtocols.has(directUrl.protocol)) {
    return directUrl.toString();
  }

  if (/^geo:/i.test(trimmed)) {
    const payload = trimmed.slice(4).trim();
    if (!payload) return null;

    const [coordinates = '', queryString = ''] = payload.split('?');
    const params = new URLSearchParams(queryString);
    const query = normalizeCoordinateQuery(params.get('q') ?? coordinates);
    if (!query) return null;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  if (/^maps:/i.test(trimmed)) {
    const query = normalizeCoordinateQuery(trimmed.slice(5));
    if (!query) return null;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  if (/^(www\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

export function isAllowedWhatsAppMainFrameUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  if (!url) return false;

  return url.protocol === 'https:' && url.hostname.toLowerCase() === whatsappMainHostname;
}

export function isAllowedWhatsAppResourceUrl(rawUrl: string): boolean {
  const url = parseUrl(rawUrl);
  if (!url) return false;

  if (url.protocol === 'blob:') {
    return url.origin === whatsappHomeUrl.slice(0, -1);
  }

  if (!['https:', 'wss:'].includes(url.protocol)) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return allowedResourceHostnames.has(host) || allowedResourceSuffixes.some((suffix) => host.endsWith(suffix));
}

export function isSafeExternalUrl(rawUrl: string): boolean {
  return normalizeExternalUrl(rawUrl) !== null;
}
