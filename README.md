# ZapDesk

[Read this README in English](./README.en.md)

ZapDesk e um cliente desktop para Windows feito com Electron, TypeScript, React e Vite. Ele carrega o WhatsApp Web em uma janela propria e adiciona recursos de desktop que o navegador e o app oficial nem sempre entregam bem.

O projeto nasceu de uma necessidade pratica: o aplicativo oficial do WhatsApp para Windows pode travar, consumir recursos demais ou falhar em momentos importantes. Ja o WhatsApp Web no navegador funciona, mas fica perdido entre varias abas, as notificacoes podem falhar e a experiencia nao parece um aplicativo dedicado. O ZapDesk tenta resolver esse espaco: um wrapper leve, estavel e focado em uso pessoal.

> O ZapDesk nao automatiza mensagens, nao faz disparo em massa, nao envia spam e nao tenta burlar regras do WhatsApp. Ele e apenas um cliente desktop alternativo para uso normal do WhatsApp Web.

## Recursos

- WhatsApp Web em janela dedicada.
- Sessao persistente para evitar QR Code a cada abertura.
- Tray icon no Windows com opcoes rapidas.
- Fechar no X pode minimizar para a bandeja.
- Notificacoes nativas do Windows para novas mensagens.
- Contador de mensagens nao lidas no titulo, tray e overlay do icone quando suportado.
- Botao flutuante discreto com acoes rapidas.
- Atalhos globais:
  - `Ctrl+Shift+W`: mostrar/ocultar janela
  - `Ctrl+R`: recarregar WhatsApp
  - `Ctrl+Shift+Q`: sair totalmente
- Opcao de manter a janela sempre no topo.
- Opcao de iniciar com o Windows.
- Tela de configuracoes local.
- Bloqueio de navegacao externa insegura.
- Links externos abrem no navegador padrao.
- Preload seguro com `contextIsolation: true` e `nodeIntegration: false`.

## Download

Baixe a versao mais recente pela pagina de Releases do GitHub.

Arquivos publicados:

- `ZapDesk-1.0.5-Setup.exe`: instalador para Windows.
- `ZapDesk-1.0.5-Portable.zip`: versao portavel/descompactada.

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
release/ZapDesk-1.0.5-Setup.exe
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

## Sobre automacoes

Este projeto nao usa `whatsapp-web.js` nesta versao. Existe apenas um ponto de extensao em `src/main/optional/whatsappWebJsAdapter.ts` para uma futura integracao opcional, sem implementar spam, disparo em massa ou qualquer uso abusivo.

## Privacidade

O ZapDesk nao possui servidor proprio e nao envia mensagens, contatos ou sessoes para terceiros. A autenticacao e o uso continuam acontecendo pelo WhatsApp Web.

Dados locais, cache e sessao ficam fora do repositorio e sao ignorados pelo Git.
