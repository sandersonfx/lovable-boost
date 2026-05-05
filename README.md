# ⚡ Lovable Boost

**Use o Lovable.dev diretamente via API — sem interface web.**

Extensão Chrome que captura o token de autenticação do Lovable.dev e permite enviar prompts diretamente para a API, evitando o consumo de créditos da interface web.

## ✨ Funcionalidades

- 🔌 **Proxy API** — Envia prompts direto para `api.lovable.dev`, sem UI
- 🪪 **Captura automática** — Detecta seu Bearer token e Project ID ao acessar o Lovable
- 🎛️ **UI flutuante** — Interface elegante (glassmorphism) acionada pelo botão ⚡
- 📋 **9 templates rápidos** — Mobile, UI/UX, Bug Fix, Auth, Dashboard, Performance, Dark Mode, Forms, Testes
- 🎤 **Voz para texto** — Digite prompts falando (reconhecimento de voz)
- 📜 **Histórico** — Últimos 50 prompts salvos localmente
- 🌗 **Dark/Light mode** — Segue preferência do sistema ou alterna manualmente

## 📦 Instalação

### Via GitHub (desenvolvedor)

1. Clone o repositório:
   ```bash
   git clone https://github.com/sandersonfx/lovable-boost.git
   ```
2. Abra o Chrome em `chrome://extensions/`
3. Ative **Modo do desenvolvedor** (canto superior direito)
4. Clique **Carregar sem compactação** e selecione a pasta `lovable-boost`
5. Acesse [lovable.dev](https://lovable.dev) — o botão ⚡ aparecerá no canto inferior direito

## 🚀 Como usar

1. **Acesse** [lovable.dev](https://lovable.dev) e faça login normalmente
2. **Abra um projeto** — a extensão captura automaticamente o token e Project ID
3. **Clique em ⚡** no canto inferior direito
4. **Digite seu prompt** ou use um template rápido
5. **Clique "Enviar via API"** ou `Ctrl+Enter`
6. A resposta da API aparece imediatamente

### Dica: atalho de teclado
- `Ctrl+Enter` — Envia o prompt direto sem clicar no botão

## 🏗️ Arquitetura

```
pageHook.js (injected) → intercepta fetch/XHR → captura Bearer token
     ↓ envia via window.postMessage
content.js (content script) → recebe token → mostra UI flutuante
     ↓ envia comando + token via chrome.runtime.sendMessage
background.js (service worker) → proxyFetch → chama API Lovable
     ↓ POST para api.lovable.dev com token original
Resposta → volta pra UI
```

## 🔒 Segurança

- O token **nunca** sai do seu navegador
- A comunicação com a API é feita pelo service worker da extensão
- Nenhum dado é enviado para servidores externos
- Tudo fica armazenado localmente no `chrome.storage.local`

## ⚠️ Aviso

Esta extensão é uma ferramenta de **proxy/boost** para uso pessoal. Use com responsabilidade e respeite os termos de serviço do Lovable.dev.

## 📄 Licença

MIT — veja o arquivo [LICENSE](LICENSE) para detalhes.
