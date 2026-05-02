# Auditoria Definitiva e Estrutural do ZapDesk

Esta auditoria representa a análise mais profunda, crítica e prática do projeto ZapDesk. O objetivo não é apenas identificar erros óbvios ou falhas de sintaxe, mas sim escrutinar a experiência do usuário (UX), interface (UI), fluxos de uso, arquitetura de software, estabilidade e performance. 

O ZapDesk tem a ambição de ser um wrapper de WhatsApp Web premium, leve e altamente estável. Para que alcance esse status de produto polido e profissional, todos os pontos abaixo devem ser endereçados.

---

## 1. UX/UI e Consistência Geral

### 1.1. Notificações Visuais Distorcidas (Badge Pixelado)
- **Onde está o problema:** `src/main/main.ts` (Funções `drawBadgeText`, `setPixel`, `digitMasks`).
- **O que está errado:** A geração do número da badge (contador de não lidas) não utiliza fontes nativas do sistema ou `<canvas>`. Em vez disso, o app desenha os números pixel a pixel, alterando os buffers manualmente em um mapa de bits _hardcoded_ (`digitMasks`).
- **Por que prejudica:** Sem suporte a *antialiasing*, os números da badge na bandeja do sistema (Tray) ficam grosseiros, borrados ou distorcidos, destruindo a estética "premium" do aplicativo.
- **Impacto:** Alta percepção de produto "amador" ou mal-acabado pelo usuário final.
- **Como corrigir:** Abolir a técnica de manipulação bruta de Buffer. Usar nativamente o método `app.setBadgeCount(count)` (que já resolve no Windows 11+ moderno). Para a imagem da bandeja, se necessário renderizar uma sobreposição, utilizar a API de `<canvas>` (criando via OffscreenCanvas em JS, ou um script gerador de SVG rasterizado por `nativeImage`) para um recorte vetorial e texto limpo.
- **Prioridade:** **Alta**

### 1.2. Toast de Erro (Zumbi) Permanente
- **Onde está o problema:** `src/renderer/App.tsx:377` (`actionError`).
- **O que está errado:** O estado de erro do app (ex: *"Não foi possível salvar as configurações"*) é renderizado em um toast fixo na tela. Não há mecânica de desaparecimento automático (timeout) ou um botão "Fechar (X)".
- **Por que prejudica:** Uma falha transiente de 1 segundo marca a interface com um aviso de erro persistente até que o aplicativo seja reiniciado.
- **Impacto:** Causa confusão crônica. O usuário deduz que a aplicação está quebrada permanentemente, quando muitas vezes era apenas uma falha momentânea de rede ao checar atualizações.
- **Como corrigir:** Criar um auto-descarte (auto-dismiss) usando um `setTimeout` de 5 a 7 segundos para reverter o `actionError` para `null`. Alternativamente, adicionar um botão `[ x ]` no próprio componente do Toast.
- **Prioridade:** **Alta**

### 1.3. Componente Settings Panel Oculto e de Acessibilidade Pobre
- **Onde está o problema:** `src/renderer/components/SettingsPanel.tsx:32`.
- **O que está errado:** Apesar de implementar um `trap` manual de foco usando `Tab`, se o usuário acionar um toast de erro que fica "atrás" do Settings (ou sobreposto por ele), as informações conflitam. Além disso, o botão de fechar usa `ref.current?.focus()`, roubando o foco instantaneamente, o que pode interromper tecnologias assistivas inesperadamente ao abrir.
- **Por que prejudica:** Interação de teclado frágil e tratamento espacial sobreposto não convencional de overlays.
- **Impacto:** Experiência com falhas visuais.
- **Como corrigir:** Utilize as tags nativas `<dialog>` (com `showModal()`) ou componentes de UI de bibliotecas testadas para overlay de configurações, garantindo *focus-trap* e *z-index* corretos, isolando notificações (toast) na camada de z-index mais alta `(9999)`.
- **Prioridade:** **Média**

---

## 2. Funcionalidades Incompletas e Críticas

### 2.1. Falha Silenciosa em Transferência e Download de Arquivos
- **Onde está o problema:** Ausência total de tratamento de `will-download` no `src/main/main.ts`.
- **O que está errado:** O Electron não possui um comportamento integrado e amigável por padrão para exibir o status de downloads provenientes do `<webview>`. Se o usuário baixar uma fatura, boleto ou foto, o arquivo poderá ser salvo escondido na pasta nativa de Downloads ou o processo falhar silenciosamente sem *prompt* (Salvar como).
- **Por que prejudica:** Transferência de arquivos é uma das três principais funções de uso comercial/pessoal do WhatsApp. A ausência de feedback transforma um ato esperado em incerteza: *"Baixou? Onde está o arquivo?"*.
- **Impacto:** Frustração absoluta do usuário, potencialmente quebrando a confiabilidade no ZapDesk em relação ao WhatsApp Desktop oficial.
- **Como corrigir:** Registrar `session.fromPartition(whatsappPartition).on('will-download', ...)` no `main.ts`. Interceptar o objeto de download, emitir via IPC o andamento (0-100%) para o React (`App.tsx`), mostrar um indicador de "Fazendo download de arquivo_X.pdf" e permitir que o usuário escolha a pasta de destino usando `item.setSaveDialogOptions()`.
- **Prioridade:** **Crítica**

### 2.2. Abertura de Links e Popups Falhando (Ausência de allowpopups)
- **Onde está o problema:** `src/renderer/App.tsx:266` (Tag `<webview>`).
- **O que está errado:** A propriedade `allowpopups` não está declarada no Webview.
- **Por que prejudica:** O WhatsApp Web frequentemente utiliza scripts `window.open` e popups internos (como chamadas de voz e alguns formatos de links complexos ou anexos).
- **Impacto:** Vários tipos de links e ações do WhatsApp falharão, e o clique do usuário causará "nenhuma ação", criando o efeito de botão quebrado.
- **Como corrigir:** Adicionar o atributo `<webview allowpopups="true" />` e continuar capturando e filtrando esse tráfego de janela (bloqueando sites e abrindo via `shell.openExternal()`) no evento `setWindowOpenHandler` em `main.ts`.
- **Prioridade:** **Alta**

---

## 3. Fluxos de Usuário e Estabilidade

### 3.1. "Continuar para o WhatsApp" Forçado (Falso Ready)
- **Onde está o problema:** `src/renderer/App.tsx:71` (`slowLoad` timeout de 7 segundos).
- **O que está errado:** Se o WebView não reporta que carregou após 7 segundos, o app muda o estado e oferece um botão "Continuar para o WhatsApp". Quando pressionado, ele simplesmente injeta o iframe falho na frente do usuário, sem a garantia que a interface existirá.
- **Por que prejudica:** O usuário é levado para uma tela cinza, quebrada ou não interativa, delegando o gerenciamento do erro de aplicação para ele mesmo de uma forma confusa.
- **Impacto:** Impressão de produto improvisado; em vez de resolver o carregamento, passa a falha adiante.
- **Como corrigir:** Substituir o estado "Continuar" por "O Carregamento Demorou. Recarregar Conexão". O fluxo ideal seria tentar fazer o recarregamento automático (`retry`) 1 ou 2 vezes invisivelmente. Se ainda não responder, apenas mostrar os botões de tentar novamente ou reiniciar sessão, nunca a página vazia.
- **Prioridade:** **Média**

### 3.2. Sincronização Duplicada entre `main` e `renderer` (Loading Race Conditions)
- **Onde está o problema:** `src/main/main.ts` e `src/renderer/App.tsx`.
- **O que está errado:** Como apontado na auditoria básica original, o estado da aplicação é disputado. O `main.ts` emite `load:finished`, e o `App.tsx` também inspeciona o DOM com timeouts iterativos (`interactiveProbe`) a cada 1,2s.
- **Por que prejudica:** Se o WhatsApp fizer testes A/B mudando suas classes HTML (ex: ocultar `[data-testid="chat-list"]`), a *probe* falha infinitamente, resultando num script consumindo processamento (memory leak progressivo) constantemente enquanto a sessão já estava online na visão do Electron (`did-finish-load`).
- **Impacto:** Lentidão contínua do cliente e desperdício brutal de bateria (polling loop).
- **Como corrigir:** Remover totalmente o `setInterval` injetando Javascript em `App.tsx`. Usar um mecanismo robusto: injetar um arquivo de *preload* real na webview `<webview preload="path/to/whatsapp-observer.js">` que usa `MutationObserver` (passivo e performático) para detectar a tela inicial, emitindo uma notificação de "APP_READY" para o host via `ipcMessage`. 
- **Prioridade:** **Crítica**

---

## 4. Performance e Arquitetura

### 4.1. Interceptação Excessiva de Rede (Gargalo de IPC)
- **Onde está o problema:** `src/main/main.ts:311` (`whatsappSession.webRequest.onBeforeSendHeaders`).
- **O que está errado:** A função que injeta `DNT` e customiza o `User-Agent` intercepta **todas** as requisições HTTP, WebSocket e recursos de mídia sem um filtro (`urls`). O WhatsApp dispara milhares de requests pequenas em sua API. 
- **Por que prejudica:** Obriga o Electron a comunicar o thread do processo nativo com o JS principal centenas de vezes por segundo, pausando as transmissões. 
- **Impacto:** Lentidão geral para envio/recebimento, consumo gigante de CPU, UI podendo travar.
- **Como corrigir:** Não usar `onBeforeSendHeaders` globalmente. O próprio `whatsappSession.setUserAgent(desktopChromeUserAgent)` é mais que suficiente e é feito em C++ nativamente. Se a interceptação for vital, limite explicitamente as URLs: `{ urls: ['https://web.whatsapp.com/*'] }`.
- **Prioridade:** **Crítica**

### 4.2. Renderizações Redundantes com Reatividade Baseada em Propriedades (`unreadVisuals`)
- **Onde está o problema:** `src/main/main.ts:649` (`updateUnreadVisuals`).
- **O que está errado:** O sistema gera ícones novos de Tray e Overlay chamando o flash da janela não apenas quando chegam mensagens novas, mas cada vez que o usuário minimiza, fecha, oculta ou foca a janela (chamando seguidas vezes `flashFrame(true)` sem controle de estado derivado real de novidade).
- **Por que prejudica:** O sistema operacional precisa refazer a pintura dos menus e o Windows Flash Icon brilha de forma não semântica, criando ruído mental na UX.
- **Impacto:** O App torna-se invasivo e irritante, e a memória volátil flutua desnecessariamente com a alocação de novos ícones repetidos.
- **Como corrigir:** Aplicar memoização (`useMemo` em React / cache direto no Node). Um estado de leitura só dispara transições visuais reais (Tray / Overlay / Flash) se o contador mudou `if (newCount !== previousCount)`.
- **Prioridade:** **Alta**

---

## 5. Responsividade e Design

### 5.1. Código Morto e Janela Bloqueada em Multitarefa
- **Onde está o problema:** `src/main/main.ts:320` e `src/renderer/styles/app.css:587`.
- **O que está errado:** A janela principal possui `minWidth: 900`. Porém, em `app.css`, o Design prevê uma media query `@media (max-width: 760px)` para ajustar botões em telas pequenas.
- **Por que prejudica:** A janela do Electron fisicamente nunca chegará a 760px, inutilizando o CSS responsivo.
- **Impacto:** Se o usuário possui um monitor pequeno e tenta usar o ZapDesk dividido (Split Screen do Windows), a interface não cederá e ficará travada ou ocupando muito espaço indevidamente. O WhatsApp Web se ajusta incrivelmente bem até 600px.
- **Como corrigir:** Diminuir `minWidth` no `main.ts` para um valor como `500` ou `600`, permitindo que o usuário use o app em janelas mais compactas paralelamente enquanto trabalha (que é o benefício de ter um app desktop), tirando proveito da media-query existente.
- **Prioridade:** **Média**

---

## 6. Segurança

### 6.1. Exposição do User-Agent (Vazamento Identificador / Bloqueio do Meta)
- **Onde está o problema:** `src/shared/browserProfile.ts:1-3`.
- **O que está errado:** O User-Agent atual simula o Chrome `120.0.0.0` fixado estatisticamente em todo o aplicativo. O Electron subjacente já deve estar usando o Chromium 124+ ou mais.
- **Por que prejudica:** A API antispam do Facebook/WhatsApp pode detectar a discrepância de assinaturas de hardware do Chromium 124 combinada com um `User-Agent` do Chrome 120, identificando o software como bot, wrapper ou gerando o banimento da sessão.
- **Impacto:** Queda da estabilidade e possível desconexão por parte da aplicação.
- **Como corrigir:** Capturar dinamicamente o `User-Agent` nativo de inicialização, `session.defaultSession.getUserAgent()`, e então polir a string apenas retirando a tag do `Electron` do nome.
- **Prioridade:** **Alta**

---

## 7. Recomendações Finais e Próximos Passos (Plano de Ação)

1. **Remoção Imediata do Gargalo de Rede:** Excluir o `webRequest.onBeforeSendHeaders` no arquivo principal ou adicionar filtros restritos apenas à navegação principal.
2. **Implantação do Sistema de Downloads:** Fazer a ponte funcional para a criação de pastas ou *prompts* de downloads para anexos (PDF/Imagens).
3. **Refatoração da Lógica de Prontidão (Ready State):** O fim do _polling_ JS, adoção de WebWorkers/MutationObservers na Webview para captar de forma inteligente quando o DOM do WhatsApp realmente carregou sem gastar ciclos iterativos de processamento.
4. **Resolução Definitiva dos Ícones de Notificação:** Abandonar o `digitMasks` manipulado e recorrer a `app.setBadgeCount` + Ícones SVG.
5. **Auto-Cura da Interface:** Timeout para Toasts (`actionError`), redução do tamanho mínimo de tela para apoiar uso produtivo lateral (Split View) e inserção do `allowpopups`.

> **Conclusão:** A auditoria revelou que as bases do aplicativo são saudáveis e o *boilerplate* é moderno (React/Vite + Electron). No entanto, algumas escolhas para evitar os bloqueios do WhatsApp (manipulação pesada de eventos no Main e Heurísticas iterativas no Renderer) geraram efeitos colaterais substanciais em consumo de memória, uso de CPU e UX bruta de notificação. Focar na eliminação dessas camadas excessivas fará do ZapDesk de fato o "client premium" e ultra-rápido pretendido.
