import { describe, expect, it } from 'vitest';
import { cleanWhatsAppTitle, parseUnreadFromTitle } from './unread';

describe('unread title parsing', () => {
  it('parses numeric unread counts from WhatsApp titles', () => {
    expect(parseUnreadFromTitle('(1) WhatsApp')).toBe(1);
    expect(parseUnreadFromTitle('(42) WhatsApp')).toBe(42);
    expect(parseUnreadFromTitle('(99+) WhatsApp')).toBe(99);
  });

  it('returns zero for titles without a leading unread count', () => {
    expect(parseUnreadFromTitle('WhatsApp')).toBe(0);
    expect(parseUnreadFromTitle('ZapDesk - WhatsApp')).toBe(0);
    expect(parseUnreadFromTitle('Mensagem (2)')).toBe(0);
  });

  it('removes the unread prefix from the window title', () => {
    expect(cleanWhatsAppTitle('(12) WhatsApp')).toBe('WhatsApp');
    expect(cleanWhatsAppTitle('(99+) WhatsApp')).toBe('WhatsApp');
    expect(cleanWhatsAppTitle('')).toBe('WhatsApp');
  });
});
