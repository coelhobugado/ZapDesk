/**
 * Ponto de extensao futuro para uma integracao opcional com whatsapp-web.js.
 *
 * Intencionalmente nao importamos nem inicializamos whatsapp-web.js agora:
 * o ZapDesk nasce como wrapper seguro do WhatsApp Web, sem disparo em massa,
 * sem automacao abusiva e sem qualquer fluxo que contorne o uso normal do produto.
 */
export type OptionalAutomationModule = {
  enabled: false;
};

export const optionalAutomationModule: OptionalAutomationModule = {
  enabled: false
};
