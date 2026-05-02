import { describe, expect, it } from 'vitest';
import {
  isAllowedWhatsAppMainFrameUrl,
  isAllowedWhatsAppResourceUrl,
  isSafeExternalUrl
} from './allowedOrigins';

describe('allowed origins', () => {
  it('allows only WhatsApp Web as a main frame URL', () => {
    expect(isAllowedWhatsAppMainFrameUrl('https://web.whatsapp.com/')).toBe(true);
    expect(isAllowedWhatsAppMainFrameUrl('https://web.whatsapp.com/send?phone=123')).toBe(true);
    expect(isAllowedWhatsAppMainFrameUrl('https://www.whatsapp.com/')).toBe(false);
    expect(isAllowedWhatsAppMainFrameUrl('data:text/html,<h1>fake</h1>')).toBe(false);
    expect(isAllowedWhatsAppMainFrameUrl('blob:https://web.whatsapp.com/id')).toBe(false);
  });

  it('allows WhatsApp resource domains without allowing arbitrary protocols', () => {
    expect(isAllowedWhatsAppResourceUrl('https://static.whatsapp.net/app.js')).toBe(true);
    expect(isAllowedWhatsAppResourceUrl('wss://web.whatsapp.com/ws')).toBe(true);
    expect(isAllowedWhatsAppResourceUrl('https://evil.example/app.js')).toBe(false);
    expect(isAllowedWhatsAppResourceUrl('file:///C:/Windows/system.ini')).toBe(false);
    expect(isAllowedWhatsAppResourceUrl('data:text/html,<h1>fake</h1>')).toBe(false);
  });

  it('allows only explicit safe external protocols', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('mailto:test@example.com')).toBe(true);
    expect(isSafeExternalUrl('tel:+5511999999999')).toBe(true);
    expect(isSafeExternalUrl('file:///C:/Windows/system.ini')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });
});
