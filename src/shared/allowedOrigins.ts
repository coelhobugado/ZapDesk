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

function buildGoogleMapsSearchUrl(query: string): string | null {
  const normalizedQuery = normalizeCoordinateQuery(query);
  if (!normalizedQuery) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedQuery)}`;
}

function trimCandidateUrl(value: string): string {
  return value
    .trim()
    .replace(/^[<([{"']+/, '')
    .replace(/[>\])}"'.,;!?]+$/, '');
}

function extractEmbeddedExternalCandidate(value: string): string | null {
  const protocolMatch = value.match(/\b(?:https?:\/\/|mailto:|tel:|geo:|maps:)[^\s<>"']+/i);
  if (protocolMatch) return trimCandidateUrl(protocolMatch[0]);

  const bareDomainMatch = value.match(/\b(?:www\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)[^\s<>"']+/i);
  if (bareDomainMatch) return trimCandidateUrl(bareDomainMatch[0]);

  return null;
}

function extractCoordinatePair(value: string): string | null {
  const match = value.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  if (!match[1].includes('.') || !match[2].includes('.')) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return `${latitude},${longitude}`;
}

function normalizeGoogleStaticMapUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const isStaticMap =
    (host === 'maps.googleapis.com' || host === 'maps.google.com') && url.pathname.includes('/maps/api/staticmap');
  if (!isStaticMap) return null;

  const center = url.searchParams.get('center');
  if (center) return buildGoogleMapsSearchUrl(center);

  const markerCoordinates = extractCoordinatePair(url.searchParams.getAll('markers').join(' '));
  return markerCoordinates ? buildGoogleMapsSearchUrl(markerCoordinates) : null;
}

export function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function normalizeExternalUrl(rawUrl: string): string | null {
  const trimmed = trimCandidateUrl(rawUrl);
  if (!trimmed) return null;

  const embeddedCandidate = extractEmbeddedExternalCandidate(trimmed);
  if (embeddedCandidate && embeddedCandidate !== trimmed) {
    return normalizeExternalUrl(embeddedCandidate);
  }

  const directUrl = parseUrl(trimmed);
  if (directUrl) {
    const staticMapUrl = normalizeGoogleStaticMapUrl(directUrl);
    if (staticMapUrl) return staticMapUrl;
  }

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

    return buildGoogleMapsSearchUrl(query);
  }

  if (/^maps:/i.test(trimmed)) {
    const query = normalizeCoordinateQuery(trimmed.slice(5));
    if (!query) return null;

    return buildGoogleMapsSearchUrl(query);
  }

  if (/^(www\.|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  const coordinatePair = extractCoordinatePair(trimmed);
  if (coordinatePair) return buildGoogleMapsSearchUrl(coordinatePair);

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
