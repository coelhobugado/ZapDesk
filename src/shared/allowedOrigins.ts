const allowedHostnames = new Set([
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

const allowedSuffixes = ['.whatsapp.net', '.whatsapp.com', '.facebook.com', '.fbcdn.net'];

export function isAllowedWhatsAppUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!['https:', 'wss:', 'blob:', 'data:'].includes(url.protocol)) {
      return false;
    }

    if (url.protocol === 'blob:' || url.protocol === 'data:') {
      return true;
    }

    const host = url.hostname.toLowerCase();
    return allowedHostnames.has(host) || allowedSuffixes.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}
