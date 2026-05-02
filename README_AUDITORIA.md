# Auditoria tecnica do ZapDesk

Este documento registra falhas, riscos e melhorias encontradas no codigo atual do ZapDesk. O objetivo e servir como backlog tecnico para deixar o app mais seguro, previsivel, testavel e pronto para release.

## Escopo analisado

- App Electron + React/Vite para abrir o WhatsApp Web em uma janela desktop.
- Processo principal em `src/main/main.ts`.
- Renderer em `src/renderer/App.tsx` e `src/renderer/components/SettingsPanel.tsx`.
- Preload em `src/preload/index.ts`.
- Regras de origem em `src/shared/allowedOrigins.ts`.
- Build/release em `package.json` e `.github/workflows/build.yml`.

## Validacoes executadas

- `npm run typecheck`: passou.
- `npm audit --omit=dev`: 0 vulnerabilidades em dependencias de producao.
- `npm run lint`: passou.
- `npm test`: passou.
- `npm run build`: passou.

## Correcoes aplicadas nesta rodada

- Validacao de navegacao principal separada da validacao de recursos do WhatsApp.
- Bloqueio de `data:` em navegacao e restricao de `blob:` a origem do WhatsApp.
- Abertura externa centralizada e limitada a protocolos seguros explicitos.
- Permissoes de notificacao, camera/microfone e captura de tela validadas por origem.
- Confirmacao antes de limpar cache/sessao.
- Sandbox ativado no webview. O BrowserWindow voltou para `sandbox: false` porque o preload atual e emitido como ESM e falha em modo sandbox no Electron empacotado.
- Popups removidos do webview e `about:blank` deixou de ser permitido.
- Canais de loading do preload passaram a ser enviados pelo main.
- Loading deixou de sumir apenas porque `document.body` existe.
- Status de update passou a limpar campos antigos ao trocar de estado.
- Atalhos globais passaram a verificar falha de registro.
- Parser de nao lidas movido para funcao testavel e com suporte a `99+`.
- Constantes de URL/particao centralizadas em `src/shared/allowedOrigins.ts`.
- README/README.en atualizados para releases atuais e `npm ci`.
- Workflow de CI/release atualizado para Node 22, `npm ci`, PRs e tags.
- Vitest e ESLint adicionados com testes para origem segura e contador de nao lidas.

## Pendencias que ainda exigem validacao manual

- Medir CPU/memoria com janela aberta, minimizada e no tray.
- Para ativar sandbox no BrowserWindow, primeiro empacotar o preload como CommonJS/bundle separado e validar em instalacao empacotada.
- Testar chamada de audio/video e compartilhamento de tela no WhatsApp Web real.
- Testar update real via GitHub Releases com uma tag publicada.
- Validar acessibilidade com leitor de tela, alem do foco/teclado basico implementado.

## Resumo executivo

O app esta funcional como wrapper do WhatsApp Web, mas ainda nao esta "100%" para release robusta. Os pontos mais importantes sao:

- A politica de navegacao/origem e permissiva demais para um app que renderiza conteudo externo.
- O fluxo de links externos chama `shell.openExternal` com URLs nao validadas em alguns caminhos.
- Permissoes sensiveis, como midia e captura de tela, sao liberadas para qualquer conteudo dentro da particao.
- Existem APIs e constantes duplicadas/incompletas, o que aumenta risco de comportamento divergente.
- O estado de loading, conexao, notificacoes e atualizacao pode mostrar informacao incorreta em cenarios reais.
- A documentacao publica esta desatualizada em relacao a versao e aos artefatos gerados.
- Nao ha testes automatizados para as regras criticas.

## Achados por prioridade

### P0 - Corrigir antes de distribuir publicamente

#### 1. URLs externas podem ser abertas sem validacao suficiente

- Arquivo: `src/main/main.ts:659-676`.
- Problema: quando uma navegacao ou popup nao passa em `isAllowedWhatsAppUrl`, o codigo chama `shell.openExternal(url)` diretamente.
- Impacto: links com protocolos inesperados, arquivos locais, handlers do Windows ou URLs malformadas podem ser encaminhados ao sistema operacional. Em apps Electron isso e um vetor classico de risco.
- Como corrigir:
  - Criar uma funcao unica `openSafeExternalUrl(rawUrl)`.
  - Aceitar apenas `https:` e, se necessario, `http:`/`mailto:`/`tel:` explicitamente.
  - Usar `new URL(rawUrl)` e negar qualquer protocolo fora da lista.
  - Aplicar a mesma funcao no IPC `shell:open-external`, no context menu, no `setWindowOpenHandler` e no `will-navigate`.

#### 2. `data:` e `blob:` sao sempre permitidos

- Arquivo: `src/shared/allowedOrigins.ts:22-28`.
- Problema: `isAllowedWhatsAppUrl` retorna `true` para qualquer `data:` ou `blob:`.
- Impacto: uma navegacao principal para HTML arbitrario em `data:`/`blob:` pode ficar dentro do app, fora do dominio real do WhatsApp, criando risco de phishing, bypass de origem e comportamento dificil de auditar.
- Como corrigir:
  - Separar validacao de recurso/subframe e validacao de navegacao principal.
  - Bloquear `data:` em navegacao principal.
  - Permitir `blob:` apenas quando a origem criadora for `https://web.whatsapp.com` ou quando o uso for comprovadamente necessario.

#### 3. Lista de hosts permitidos e ampla demais para navegacao principal

- Arquivo: `src/shared/allowedOrigins.ts:1-31`.
- Problema: a mesma allowlist aceita `*.whatsapp.com`, `*.whatsapp.net`, `*.facebook.com` e `*.fbcdn.net` para decisoes de navegacao.
- Impacto: o webview pode sair do WhatsApp Web e renderizar outras paginas dentro do shell. O ideal e permitir CDN/subrecursos, mas manter a navegacao principal presa a `web.whatsapp.com`.
- Como corrigir:
  - Criar funcoes separadas:
    - `isAllowedMainFrameUrl(url)`: normalmente apenas `https://web.whatsapp.com/`.
    - `isAllowedResourceUrl(url)`: dominios de CDN/asset realmente usados pelo WhatsApp.
  - Abrir paginas institucionais, Facebook e links externos no navegador padrao.

#### 4. Permissoes sensiveis sao aprovadas sem validar origem

- Arquivo: `src/main/main.ts:263-265`.
- Problema: notificacoes, midia e captura de tela sao liberadas para qualquer conteudo na particao `persist:zapdesk-whatsapp`.
- Impacto: se um popup permitido, `data:` ou origem ampla solicitar camera, microfone ou captura de tela, a permissao pode ser concedida sem decisao do usuario.
- Como corrigir:
  - Validar `webContents.getURL()` ou a origem requisitante.
  - Permitir notificacoes apenas para `web.whatsapp.com`.
  - Pedir confirmacao explicita para `media` e `display-capture`.
  - Registrar log de permissao negada/aprovada.

#### 5. `sandbox: false` reduz isolamento do renderer

- Arquivo: `src/main/main.ts:286-291`.
- Problema: o BrowserWindow usa `contextIsolation: true` e `nodeIntegration: false`, mas desativa o sandbox.
- Impacto: o preload fica com mais privilegios do que o necessario. Se houver XSS no shell local ou bug de isolamento, o dano potencial aumenta.
- Como corrigir:
  - Tentar `sandbox: true` no BrowserWindow.
  - Manter somente APIs minimas no preload.
  - Validar se o `webviewTag` ainda funciona; se nao funcionar, avaliar migracao para `WebContentsView`/`BrowserView`.

### P1 - Falhas logicas e comportamento divergente

#### 6. Popups `about:blank` sao permitidos e escondidos

- Arquivo: `src/main/main.ts:659-662`.
- Problema: `about:blank` e aceito com `show: false`.
- Impacto: uma janela invisivel pode permanecer viva, consumir recurso ou executar conteudo escrito pelo opener.
- Como corrigir:
  - Negar `about:blank` por padrao.
  - Se for necessario para o WhatsApp, criar um fluxo controlado: permitir temporariamente, observar a primeira navegacao real e fechar se nao virar uma URL esperada.

#### 7. `allowpopups` aumenta a superficie de ataque do webview

- Arquivo: `src/renderer/App.tsx:229-236`.
- Problema: o webview permite popups.
- Impacto: cada popup cria mais `webContents` para proteger, aumenta risco de janela invisivel e complica estado de unread/title.
- Como corrigir:
  - Remover `allowpopups` se o WhatsApp funcionar sem ele.
  - Se for obrigatorio, negar tudo por padrao e abrir links externos no navegador.

#### 8. Eventos `load:started` e `load:finished` existem no preload, mas nao sao enviados

- Arquivos:
  - `src/preload/index.ts:27-29`.
  - `src/renderer/App.tsx:103-114`.
- Problema: o renderer assina `onLoadStarted` e `onLoadFinished`, mas o main process nunca envia esses canais.
- Impacto: API morta/incompleta, falsa expectativa de funcionamento e manutencao mais dificil.
- Como corrigir:
  - Implementar envio no main em `did-start-loading`/`did-finish-load`, ou remover esses canais do preload e do renderer.

#### 9. Loading pode sumir antes do WhatsApp estar realmente pronto

- Arquivo: `src/renderer/App.tsx:143-186`.
- Problema: `dom-ready`, `did-stop-loading`, um fallback de 8 segundos e um probe que checa apenas `document.body` podem chamar `finishLoading()`.
- Impacto: em rede lenta ou falha parcial, o usuario pode ver um webview branco/instavel em vez de uma tela clara de carregamento ou erro.
- Como corrigir:
  - Checar seletor/estado mais confiavel do WhatsApp Web.
  - Manter o botao "Continuar" como escolha do usuario, nao como fallback automatico.
  - Diferenciar "documento carregou" de "WhatsApp esta utilizavel".

#### 10. Estado de conexao nao reflete o estado real do WhatsApp

- Arquivos:
  - `src/renderer/App.tsx:39`.
  - `src/renderer/App.tsx:146-157`.
  - `src/main/main.ts:719-722`.
- Problema: o estado usa `navigator.onLine`, `dom-ready` e navegacao de URL. Isso nao detecta telefone desconectado, WhatsApp reconectando, QR expirado ou falha de sincronizacao.
- Impacto: o banner de conexao pode dizer "online" quando o WhatsApp ainda nao esta pronto.
- Como corrigir:
  - Observar estados reais da UI do WhatsApp com cuidado, sem automatizar mensagens.
  - Separar estados: `network-online`, `whatsapp-loading`, `whatsapp-ready`, `whatsapp-reconnecting`, `qr-required`.

#### 11. Comando de reload pode ser perdido

- Arquivos:
  - `src/main/main.ts:382-384`.
  - `src/renderer/App.tsx:115-118`.
- Problema: `reloadWhatsApp()` apenas envia IPC para o renderer. Se o renderer ainda nao montou, se o webview nao existe, ou se a janela esta recriando, o comando some.
- Impacto: tray/atalho pode nao recarregar quando o usuario espera.
- Como corrigir:
  - Guardar comandos pendentes ate o webview estar pronto.
  - Ou controlar o webview pelo main usando uma referencia de `webContents` mais direta.

#### 12. Limpar cache/sessao e destrutivo e nao pede confirmacao

- Arquivos:
  - `src/main/main.ts:386-393`.
  - `src/renderer/App.tsx:337-343`.
- Problema: o botao limpa storage/cache imediatamente.
- Impacto: o usuario pode perder a sessao local por clique acidental.
- Como corrigir:
  - Mostrar confirmacao modal com aviso claro.
  - Fechar/recarregar o webview somente apos a limpeza terminar.
  - Exibir feedback de sucesso/erro.

#### 13. Status de atualizacao preserva campos antigos

- Arquivos:
  - `src/main/main.ts:230-245`.
  - `src/main/main.ts:401-408`.
  - `src/main/main.ts:444-535`.
- Problema: `setUpdateStatus` faz merge com o estado anterior. Campos como `availableVersion` e `percent` podem continuar aparecendo em estados como `disabled`, `error` ou `not-available`.
- Impacto: UI pode mostrar progresso/versao antiga junto com mensagem nova.
- Como corrigir:
  - Construir um objeto completo por estado.
  - Limpar explicitamente `availableVersion` e `percent` quando nao se aplicarem.

#### 14. Atalhos globais podem falhar silenciosamente

- Arquivo: `src/main/main.ts:540-543`.
- Problema: o retorno de `globalShortcut.register` e ignorado.
- Impacto: se outro app ja usa o atalho, o README promete um recurso que nao funciona.
- Como corrigir:
  - Conferir o retorno booleano.
  - Registrar falha em log.
  - Mostrar aviso em configuracoes ou permitir remapeamento.

#### 15. Contador de nao lidas depende do titulo da pagina

- Arquivo: `src/main/main.ts:546-548` e `src/main/main.ts:684-690`.
- Problema: o parser aceita apenas titulos que comecam com `(\d+)` e o listener e anexado a todo `webContents`, nao somente ao webview principal do WhatsApp.
- Impacto: mudancas no formato do titulo do WhatsApp, popups ou paginas secundarias podem zerar/alterar o contador.
- Como corrigir:
  - Aplicar o listener apenas ao webContents do WhatsApp principal.
  - Tratar formatos como `99+`, espacos e variacoes localizadas.
  - Criar testes unitarios para o parser.

#### 16. Notificacoes podem ser imprecisas

- Arquivo: `src/main/main.ts:557-578`.
- Problema: a notificacao e baseada apenas no aumento do contador de titulo.
- Impacto: sincronizacao inicial, reabertura ou mudancas de titulo podem disparar notificacoes que nao correspondem a uma mensagem nova.
- Como corrigir:
  - Ignorar notificacoes ate o primeiro estado estavel do WhatsApp.
  - Debounce curto para evitar rajadas.
  - Fazer clique na notificacao focar a janela.

#### 17. Iniciar com Windows pode gravar caminho errado em desenvolvimento

- Arquivo: `src/main/main.ts:250-255`.
- Problema: `app.setLoginItemSettings` usa `process.execPath` sempre. Em dev, isso pode apontar para Electron/electronmon, nao para o app instalado.
- Impacto: dev/teste local pode sujar a inicializacao do Windows.
- Como corrigir:
  - Desabilitar `startWithWindows` em dev ou avisar.
  - Aplicar login item apenas quando `app.isPackaged`.

#### 18. Conteudo externo nao tem CSP clara no shell local

- Arquivo: `src/renderer/index.html`.
- Problema: nao ha Content Security Policy declarada para o shell React.
- Impacto: se algum HTML/script inesperado entrar no shell, ha menos defesa em profundidade.
- Como corrigir:
  - Adicionar CSP restritiva para o renderer local.
  - Revisar excecoes necessarias para Vite em desenvolvimento.

### P2 - Manutencao, desempenho e UX

#### 19. `webviewTag` e uma escolha de risco/manutencao

- Arquivo: `src/main/main.ts:291` e `src/renderer/App.tsx:229-237`.
- Problema: `webview` facilita encapsular o WhatsApp, mas amplia complexidade de seguranca e isolamento.
- Impacto: a cada ajuste de popup, permissao, navegacao e loading, o app precisa proteger dois mundos: shell e guest.
- Como corrigir:
  - Avaliar `WebContentsView`/`BrowserView` como alternativa.
  - Se mantiver `webview`, documentar a politica de seguranca e criar testes especificos.

#### 20. `backgroundThrottling: false` pode aumentar CPU/bateria

- Arquivos:
  - `src/main/main.ts:292`.
  - `src/renderer/App.tsx:234`.
- Problema: o app impede throttling em background.
- Impacto: WhatsApp Web pode continuar consumindo CPU quando minimizado/oculto, contrariando o objetivo de ser mais leve que alternativas.
- Como corrigir:
  - Medir CPU/memoria com janela aberta, minimizada e no tray.
  - Tornar isso configuravel ou remover se nao for essencial.

#### 21. Probe de carregamento executa JavaScript periodicamente

- Arquivo: `src/renderer/App.tsx:171-186`.
- Problema: `executeJavaScript` roda a cada 1,2s ate o app considerar carregado.
- Impacto: custo baixo, mas desnecessario se os eventos do webview forem suficientes; tambem pode mascarar loading real.
- Como corrigir:
  - Trocar por sinais mais confiaveis.
  - Encerrar o probe por timeout e registrar falha.

#### 22. Quick menu nao fecha com clique externo ou Escape

- Arquivo: `src/renderer/App.tsx:239-293`.
- Problema: o menu rapido abre/fecha pelo botao, mas nao ha comportamento padrao de menu.
- Impacto: UX e acessibilidade piores.
- Como corrigir:
  - Fechar ao clicar fora.
  - Fechar com `Escape`.
  - Gerenciar foco.

#### 23. Settings dialog nao tem focus trap/atalhos de teclado

- Arquivo: `src/renderer/components/SettingsPanel.tsx`.
- Problema: `role="dialog"` existe, mas faltam foco inicial, focus trap e Escape para fechar.
- Impacto: acessibilidade incompleta para teclado/leitores de tela.
- Como corrigir:
  - Focar o botao fechar ou primeiro controle ao abrir.
  - Prender foco dentro do modal.
  - Implementar `Escape` para fechar.

#### 24. Promises do renderer nao tratam erro

- Arquivo: `src/renderer/App.tsx`.
- Problema: chamadas como `getSettings`, `updateSettings`, `clearSession`, `openExternal` e `installUpdate` nao mostram erro ao usuario.
- Impacto: falhas de IPC, permissao ou runtime ficam invisiveis.
- Como corrigir:
  - Adicionar `try/catch` nos fluxos de UI.
  - Mostrar toast/status discreto.
  - Logar erros no main.

#### 25. Constantes de URL/particao estao duplicadas

- Arquivos:
  - `src/main/main.ts:36`.
  - `src/main/main.ts:260`.
  - `src/main/main.ts:387`.
  - `src/main/session.ts:1-2`.
  - `src/renderer/App.tsx:21`.
  - `src/renderer/App.tsx:233`.
- Problema: `https://web.whatsapp.com/` e `persist:zapdesk-whatsapp` aparecem em varios lugares, enquanto `src/main/session.ts` define constantes que nao sao usadas.
- Impacto: risco de drift e bugs em alteracoes futuras.
- Como corrigir:
  - Mover constantes realmente compartilhadas para `src/shared`.
  - Importar em main e renderer.
  - Remover `src/main/session.ts` se nao for usado.

#### 26. Codigo morto/imports sem uso

- Arquivo: `src/main/main.ts:20` e `src/main/main.ts:75`.
- Problema: `fs` e `lastShortcutIconLabel` sobraram de uma implementacao removida.
- Impacto: ruido no codigo e risco de confundir manutencao.
- Como corrigir:
  - Remover itens sem uso.
  - Ativar `noUnusedLocals` e `noUnusedParameters` no TypeScript.

#### 27. User-Agent hardcoded pode envelhecer

- Arquivo: `src/shared/browserProfile.ts`.
- Problema: o UA fixa Chrome `120.0.0.0`, enquanto o Electron usado e mais novo.
- Impacto: o WhatsApp Web pode passar a tratar o cliente como antigo ou suspeito.
- Como corrigir:
  - Gerar UA a partir da versao real do Chromium quando possivel.
  - Criar rotina de atualizacao/teste por release.

#### 28. README publico esta desatualizado

- Arquivos:
  - `package.json:3`.
  - `README.md:15-27`.
  - `README.md:98-101`.
- Problema: o pacote esta em `1.0.13`, mas o README aponta downloads e paths de `1.0.6`.
- Impacto: usuario baixa release antiga e instrucoes nao batem com o build local.
- Como corrigir:
  - Atualizar links para a versao corrente publicada.
  - Ou trocar links fixos por link para a pagina de releases.
  - Automatizar parte da documentacao de release.

#### 29. README promete portable, mas o build atual so configura NSIS

- Arquivos:
  - `README.md:17-19`.
  - `package.json:64-67`.
- Problema: a documentacao anuncia `.zip` portable, mas `package.json` define alvo Windows `nsis`.
- Impacto: expectativa errada para usuario/release.
- Como corrigir:
  - Adicionar alvo `portable`/`zip` no `electron-builder`, ou remover essa promessa do README.

#### 30. Workflow de release precisa ser endurecido

- Arquivo: `.github/workflows/build.yml`.
- Problemas:
  - O arquivo aparece como novo no working tree, ainda nao rastreado pelo Git.
  - Usa `npm install` em vez de `npm ci`.
  - Usa Node 20 enquanto o README pede Node 22+.
  - Comentarios aparecem com encoding quebrado nos textos em portugues.
  - So roda em tag, nao valida pull requests.
- Impacto: releases menos reprodutiveis e falhas podem chegar tarde.
- Como corrigir:
  - Usar `npm ci`.
  - Padronizar versao de Node entre README, workflow e `engines`.
  - Adicionar workflow de PR com `npm run typecheck` e build.
  - Corrigir encoding para UTF-8.

#### 31. Falta suite de testes automatizados

- Arquivos: `package.json` e `src`.
- Problema: nao ha script `test`, framework de teste ou arquivos `*.test.*`.
- Impacto: regras criticas de seguranca e estado podem quebrar sem aviso.
- Como corrigir:
  - Adicionar Vitest para funcoes puras.
  - Testar `isAllowedWhatsAppUrl`, parser de unread e reducer/status de update.
  - Adicionar testes de smoke para renderer.
  - Criar checklist manual para Electron/Windows enquanto nao houver E2E completo.

#### 32. Falta lint/formatacao obrigatoria

- Arquivo: `package.json`.
- Problema: nao ha ESLint/Prettier ou scripts equivalentes.
- Impacto: codigo morto, imports sobrando e inconsistencias passam despercebidos.
- Como corrigir:
  - Adicionar `lint`.
  - Ativar regras para imports nao usados, promises nao tratadas e seguranca basica de Electron.

#### 33. Estados e acoes sensiveis nao tem telemetria/log local

- Arquivos: `src/main/main.ts` e renderer.
- Problema: falhas de update, atalhos, permissoes, limpeza de sessao e abertura externa nao sao registradas de forma persistente.
- Impacto: fica dificil diagnosticar problemas no app instalado.
- Como corrigir:
  - Adicionar log local rotativo em `userData/logs`.
  - Evitar dados pessoais/conteudo de mensagens.
  - Expor "copiar diagnostico" nas configuracoes.

## Gargalos de desempenho a medir

1. CPU/memoria com WhatsApp aberto, minimizado e no tray, principalmente por causa de `backgroundThrottling: false`.
2. Custo de inicializacao do Electron + WhatsApp Web ate primeiro estado utilizavel.
3. Consumo de memoria apos muitos popups/links, especialmente por `about:blank` escondido.
4. Impacto do cache persistente depois de dias de uso sem limpeza.
5. Tamanho do instalador e tempo de update diferencial.

## Plano recomendado para chegar a 100%

1. Fechar os P0 de seguranca: URL externa segura, allowlist separada por contexto, permissoes por origem e sandbox.
2. Corrigir fluxo de popups, loading, reload e limpeza de sessao.
3. Ajustar atualizacoes, atalhos globais e contador de nao lidas.
4. Atualizar README/README.en e alinhar release real com `package.json`.
5. Adicionar testes unitarios para funcoes puras e CI com `npm ci`, typecheck e build.
6. Adicionar lint e remover codigo morto/duplicacao.
7. Medir desempenho com app aberto, oculto e no tray; decidir se `backgroundThrottling: false` e realmente necessario.
8. Fazer checklist manual de release no Windows: instalacao limpa, update, tray, notificacoes, limpar sessao, start with Windows e atalhos.

## Checklist minimo de testes manuais

- Primeira abertura com QR Code.
- Reabertura mantendo sessao.
- Fechar no X com `minimizeToTray` ligado e desligado.
- Tray: abrir, ocultar, recarregar, limpar sessao e sair.
- Atalhos globais registrados e funcionando.
- Notificacao de nova mensagem e clique focando a janela.
- Link externo abrindo no navegador padrao.
- Link suspeito/protocolo nao HTTP sendo bloqueado.
- Modo offline, reconexao e falha de DNS.
- Update: sem versao nova, com erro de rede e com update baixado.
- Instalacao por cima de versao anterior preservando dados.
- Desinstalacao sem remover dados quando `deleteAppDataOnUninstall` estiver `false`.

## Observacoes finais

O projeto ja tem uma base enxuta e compilavel. A maior parte do trabalho restante nao e "feature nova"; e endurecimento de seguranca, confiabilidade e release. O ponto mais urgente e separar claramente o que pode rodar dentro do app do que deve sempre sair para o navegador padrao.
