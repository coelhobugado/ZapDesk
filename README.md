# ZapDesk

[Read this README in English](./README.en.md)

Cliente desktop alternativo para WhatsApp Web no Windows.

O ZapDesk foi criado para quem usa WhatsApp no computador, mas sofre com o aplicativo oficial travando, consumindo recursos demais ou falhando em momentos importantes. No navegador, o WhatsApp Web funciona, mas fica misturado com outras abas e as notificacoes nem sempre aparecem. O ZapDesk coloca o WhatsApp Web em uma janela propria, com notificacoes nativas, tray icon e atalhos de desktop.

> O ZapDesk nao automatiza mensagens, nao faz disparo em massa, nao envia spam e nao tenta burlar regras do WhatsApp. Ele e apenas um cliente desktop alternativo para uso normal do WhatsApp Web.

## Baixar

Para apenas instalar e usar, baixe o instalador:

[Baixar ZapDesk para Windows (.exe)](https://github.com/coelhobugado/ZapDesk/releases/download/v1.0.6/ZapDesk-1.0.6-Setup.exe)

Opcao portavel, sem instalador:

[Baixar versao portable (.zip)](https://github.com/coelhobugado/ZapDesk/releases/download/v1.0.6/ZapDesk-1.0.6-Portable.zip)

Pagina completa da release:

[ZapDesk 1.0.6 no GitHub Releases](https://github.com/coelhobugado/ZapDesk/releases/tag/v1.0.6)

## Como Usar

1. Baixe o arquivo `ZapDesk-1.0.6-Setup.exe`.
2. Execute o instalador.
3. Abra o ZapDesk.
4. Escaneie o QR Code do WhatsApp Web, se solicitado.
5. Depois disso, a sessao fica salva localmente.

## Principais Recursos

- WhatsApp Web em uma janela dedicada.
- Sessao persistente para evitar QR Code a cada abertura.
- Notificacoes nativas do Windows para novas mensagens.
- Tray icon com abrir, ocultar, recarregar e sair.
- Fechar no X pode minimizar para a bandeja.
- Contador de mensagens nao lidas no titulo, tray e overlay do icone quando suportado.
- Botao flutuante discreto com acoes rapidas.
- Opcao de manter a janela sempre no topo.
- Opcao de iniciar com o Windows.
- Tela de configuracoes local.
- Links externos abrem no navegador padrao.
- Bloqueio de navegacao externa insegura.

## Atalhos

| Atalho | Acao |
| --- | --- |
| `Ctrl+Shift+W` | Mostrar ou ocultar a janela |
| `Ctrl+R` | Recarregar WhatsApp Web |
| `Ctrl+Shift+Q` | Sair totalmente do ZapDesk |

## Por Que Existe

O objetivo do ZapDesk e ser uma alternativa mais estavel e focada para usar WhatsApp Web no Windows:

- o app oficial pode travar ou ficar pesado;
- o WhatsApp Web no navegador fica perdido entre abas;
- notificacoes do navegador podem falhar;
- fechar o navegador pode encerrar o fluxo de uso;
- uma janela dedicada melhora foco, organizacao e acesso rapido.

## Desenvolvimento

Requisitos:

- Node.js 22 ou superior
- npm
- Windows para gerar o instalador `.exe`

Instale as dependencias:

```bash
npm install
```

Rode em desenvolvimento:

```bash
npm run dev
```

Gere o build local:

```bash
npm run build
```

Gere o instalador:

```bash
npm run dist
```

O instalador e gerado em:

```text
release/ZapDesk-1.0.6-Setup.exe
```

## Estrutura

```text
src/main       Processo principal do Electron
src/preload    Ponte segura entre renderer e main
src/renderer   Interface React/Vite
src/shared     Tipos e utilitarios compartilhados
assets         Icone usado em runtime
build          Icone do instalador
```

## Atualizacoes

O `appId` deve permanecer `com.zapdesk.app`. Para novas versoes, altere apenas `version` no `package.json`; assim o instalador substitui a instalacao existente em vez de criar outro aplicativo.

A sessao local do WhatsApp fica nos dados do usuario e nao e removida em atualizacoes.

## Privacidade E Seguranca

O ZapDesk nao possui servidor proprio e nao envia mensagens, contatos ou sessoes para terceiros. A autenticacao e o uso continuam acontecendo pelo WhatsApp Web.

O app usa `contextIsolation: true`, `nodeIntegration: false` e preload controlado para nao expor APIs perigosas ao renderer.

Dados locais, cache e sessao ficam fora do repositorio e sao ignorados pelo Git.

## Sobre Automacoes

Este projeto nao usa `whatsapp-web.js` nesta versao. Existe apenas um ponto de extensao em `src/main/optional/whatsappWebJsAdapter.ts` para uma futura integracao opcional, sem implementar spam, disparo em massa ou qualquer uso abusivo.
