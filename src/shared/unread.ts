export function parseUnreadFromTitle(title: string): number {
  const match = title.trim().match(/^\((\d{1,3}\+?)\)/);
  if (!match) return 0;

  return match[1].endsWith('+') ? Number.parseInt(match[1], 10) : Number(match[1]);
}

export function cleanWhatsAppTitle(title: string): string {
  return title.replace(/^\(\d{1,3}\+?\)\s*/, '').trim() || 'WhatsApp';
}
