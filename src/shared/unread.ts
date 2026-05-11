export function parseUnreadFromTitle(title: string): number {
  const match = title.trim().match(/^\(((?:\d{1,5}|\d{1,3}(?:[.,]\d{3})+)\+?)\)/);
  if (!match) return 0;

  const normalizedCount = match[1].replace(/[+.,]/g, '');
  return Number.parseInt(normalizedCount, 10);
}

export function cleanWhatsAppTitle(title: string): string {
  return title.replace(/^\((?:\d{1,5}|\d{1,3}(?:[.,]\d{3})+)\+?\)\s*/, '').trim() || 'WhatsApp';
}
