# ZapDesk

<p align="center">
  <img src="assets/zapdesk.png" alt="ZapDesk" width="96" height="96" />
</p>

<h3 align="center">WhatsApp Web em uma janela desktop mais leve, focada e integrada ao Windows.</h3>

<p align="center">
  <a href="https://github.com/coelhobugado/ZapDesk/releases/latest"><img alt="Versao mais recente" src="https://img.shields.io/github/v/release/coelhobugado/ZapDesk?label=versao&style=for-the-badge"></a>
  <a href="https://github.com/coelhobugado/ZapDesk/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/coelhobugado/ZapDesk/total?style=for-the-badge"></a>
  <a href="https://github.com/coelhobugado/ZapDesk/actions/workflows/build.yml"><img alt="Build" src="https://img.shields.io/github/actions/workflow/status/coelhobugado/ZapDesk/build.yml?style=for-the-badge"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=for-the-badge&logo=windows">
</p>

<p align="center">
  <a href="https://github.com/coelhobugado/ZapDesk/releases/latest"><strong>Baixar para Windows</strong></a>
  ·
  <a href="#recursos">Recursos</a>
  ·
  <a href="#desenvolvimento">Desenvolvimento</a>
  ·
  <a href="./README.en.md">English README</a>
</p>

---

## O Que E

ZapDesk e um cliente desktop alternativo para usar o WhatsApp Web no Windows com mais foco, menos friccao e integracoes nativas do sistema.

Ele nasceu para quem depende do WhatsApp no computador, mas nao quer deixar o atendimento perdido em uma aba do navegador, nem sofrer com o aplicativo oficial travando, pesando ou falhando em momentos importantes.

Com o ZapDesk, o WhatsApp Web fica em uma janela propria, com icone na bandeja, notificacoes nativas, contador de mensagens, atalhos globais, sessao persistente, multi-contas, respostas rapidas, agendamentos locais, corretor ortografico e atualizacoes automaticas.

> ZapDesk nao faz disparo em massa, nao envia spam e nao tenta burlar regras do WhatsApp. Recursos como respostas rapidas e agendamentos locais foram pensados para produtividade individual e uso responsavel do WhatsApp Web.

## Baixar

Instale a versao mais recente:

[Baixar ZapDesk para Windows](https://github.com/coelhobugado/ZapDesk/releases/latest)

Pagina completa de releases:

[Ver todas as versoes publicadas](https://github.com/coelhobugado/ZapDesk/releases)

O instalador principal segue o formato:

```text
ZapDesk-<versao>-Setup.exe
```

## Para Quem Serve

- Pessoas que usam WhatsApp Web todos os dias no Windows.
- Atendentes, vendedores, suporte, recepcao e times pequenos que precisam responder rapido.
- Quem prefere uma janela dedicada em vez de misturar o WhatsApp com abas do navegador.
- Quem quer notificacoes, bandeja do sistema, atalhos e atualizacao automatica sem complicacao.

## Recursos

| Recurso | Beneficio |
| --- | --- |
| Janela dedicada para WhatsApp Web | Mantem o WhatsApp separado do navegador e mais facil de encontrar. |
| Sessao persistente | Evita escanear QR Code a cada abertura. |
| Multi-contas isoladas | Crie contas separadas, cada uma com sua propria sessao persistente. |
| Respostas rapidas | Cadastre snippets e insira textos frequentes no chat atual. |
| Agendamento local de mensagens | Programe mensagens para contatos informados por telefone, usando a sessao da conta selecionada. |
| Bandeja do Windows | Abra, oculte, recarregue, verifique atualizacoes ou saia pelo tray icon. |
| Minimizar ao fechar | O botao X pode esconder o app na bandeja em vez de encerrar. |
| Notificacoes nativas | Receba alertas do Windows quando houver novas mensagens. |
| Contador de nao lidas | Mostra quantidade de mensagens no titulo, tray e recursos nativos quando suportado. |
| Atalhos globais | Mostre, oculte, recarregue ou encerre o app pelo teclado. |
| Sempre no topo | Mantenha o WhatsApp acima das outras janelas quando precisar acompanhar conversas. |
| Iniciar com Windows | Abra o ZapDesk automaticamente ao entrar no sistema. |
| Corretor ortografico | Marque palavras incorretas e use sugestoes pelo menu de contexto. |
| Links externos clicaveis | Links do WhatsApp abrem no navegador padrao do usuario. |
| Tema escuro | Shell do aplicativo com visual escuro opcional. |
| Limpeza de cache e sessao | Recomece a sessao local quando precisar corrigir login ou cache. |
| Atualizacoes automaticas | O app instalado verifica novas versoes publicadas no GitHub Releases. |
| Protecao de navegacao | URLs externas sao validadas antes de sair do ambiente do WhatsApp Web. |
| Atalho rapido via `/` no chat | Digite `/` no chat do WhatsApp para escolher e autocompletar snippets cadastrados. |
| Indicador de status de conexao | Exibe bolinhas coloridas ao lado das contas para monitorar o status de login de cada uma. |
| Modo compacto | Opcao para ocultar a barra de contas lateral e focar 100% no chat ativo. |

## Como Usar

1. Acesse a [ultima release](https://github.com/coelhobugado/ZapDesk/releases/latest).
2. Baixe o instalador `ZapDesk-<versao>-Setup.exe`.
3. Execute o instalador no Windows.
4. Abra o ZapDesk.
5. Escaneie o QR Code do WhatsApp Web, se solicitado.
6. Use normalmente. A sessao fica salva localmente.

Para usar mais de uma conta, clique no botao `+` na barra lateral e escaneie o QR Code da nova sessao. Para abrir respostas rapidas e agendamentos, use o menu de tres pontos e selecione `Ferramentas`.

## Atalhos

| Atalho | Acao |
| --- | --- |
| `Ctrl+Shift+W` | Mostrar ou ocultar a janela |
| `Ctrl+R` | Recarregar WhatsApp Web |
| `Ctrl+Shift+Q` | Sair totalmente do ZapDesk |

## Atualizacoes

O ZapDesk usa GitHub Releases com `electron-updater`.

Quando uma nova versao e publicada corretamente, o app instalado consegue detectar, baixar e instalar a atualizacao pelo proprio ZapDesk. O usuario pode verificar manualmente em `Configuracoes > Verificar atualizacoes` ou pelo menu da bandeja em `Verificar atualizacoes`.

Para isso, cada release precisa conter:

- `ZapDesk-<versao>-Setup.exe`
- `ZapDesk-<versao>-Setup.exe.blockmap`
- `latest.yml`

O `appId` deve permanecer:

```text
com.zapdesk.app
```

Manter esse identificador garante que o Windows e o atualizador reconhecam o aplicativo como a mesma instalacao entre versoes.

Para publicar uma versao que atualize o app instalado, aumente `version` em `package.json`, rode `npm run dist` no Windows e publique os tres artefatos acima em uma GitHub Release marcada como release final, nao draft.

## Privacidade E Seguranca

ZapDesk nao possui servidor proprio e nao envia mensagens, contatos, conversas ou sessoes para terceiros. A autenticacao e o uso continuam acontecendo pelo WhatsApp Web.

O projeto foi estruturado para reduzir riscos comuns em apps Electron:

- `contextIsolation` habilitado;
- `nodeIntegration` desabilitado;
- webview do WhatsApp em particao persistente isolada;
- preload controlado;
- validacao de origem para navegacao;
- abertura de links externos via navegador padrao;
- permissoes sensiveis solicitadas apenas para o WhatsApp Web;
- dados locais, cache e sessao fora do repositorio.

## Desenvolvimento

Requisitos:

- Node.js 22 ou superior
- npm
- Windows para gerar o instalador `.exe`

Instale as dependencias:

```bash
npm ci
```

Rode em desenvolvimento:

```bash
npm run dev
```

Rode as validacoes principais:

```bash
npm run lint
npm test
npm run build
```

Gere o instalador:

```bash
npm run dist
```

O instalador local sera gerado em:

```text
release/ZapDesk-<version>-Setup.exe
```

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Abre renderer Vite e processo principal Electron em modo desenvolvimento. |
| `npm run typecheck` | Valida TypeScript sem emitir arquivos. |
| `npm run lint` | Executa ESLint no projeto. |
| `npm test` | Roda os testes com Vitest. |
| `npm run build` | Gera build do renderer e do Electron. |
| `npm run dist` | Cria o instalador Windows com electron-builder. |
| `npm run clean` | Remove `dist` e `release`. |

## Estrutura Do Projeto

```text
src/main       Processo principal do Electron
src/preload    Ponte segura entre renderer e main
src/renderer   Interface React/Vite
src/shared     Tipos, configuracoes e utilitarios compartilhados
assets         Icone usado em runtime
build          Icone usado no instalador
release        Instaladores gerados localmente
```

## Stack

- Electron
- React
- Vite
- TypeScript
- electron-builder
- electron-updater
- electron-store
- Vitest
- ESLint

## Roadmap De Melhorias

Ideias naturais para evoluir o ZapDesk:

- tela de onboarding para primeira instalacao;
- preferencias avancadas de notificacao;
- temas visuais adicionais;
- instalador assinado digitalmente;
- pagina de documentacao com capturas de tela;
- melhorias de acessibilidade;
- telemetria local opcional apenas para diagnostico, sem conteudo de mensagens.

## Contribuindo

Contribuicoes sao bem-vindas quando ajudam o projeto a continuar simples, seguro e util.

Antes de abrir um pull request:

1. Rode `npm run lint`.
2. Rode `npm test`.
3. Rode `npm run build`.
4. Descreva claramente o problema resolvido.
5. Evite recursos de automacao abusiva, disparo em massa ou qualquer coisa que viole regras do WhatsApp.

## Sobre Automacoes E Uso Responsavel

Este projeto nao usa `whatsapp-web.js` nesta versao. Existe apenas um ponto de extensao em `src/main/optional/whatsappWebJsAdapter.ts` para uma futura integracao opcional.

Os agendamentos atuais usam o proprio WhatsApp Web local do usuario. Eles nao sao uma fila em servidor, nao fazem disparo em massa e podem falhar se o WhatsApp Web mudar a interface, se a conta estiver desconectada ou se o computador estiver offline.

## Aviso

ZapDesk e um projeto independente e nao oficial. WhatsApp e WhatsApp Web pertencem aos seus respectivos proprietarios. Use respeitando os termos da plataforma.
