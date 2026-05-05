# Lovable Boost 🚀

Extensão Chrome que turbina o **Lovable.dev** com ferramentas para desenvolvimento mais rápido e produtivo.

## Funcionalidades

- 📋 **Prompt Templates** — Atalhos prontos: Bugs, Refatorar, SEO, UI, Componentes, Review e mais
- 🎤 **Dictation por Voz** — Dite seus prompts com reconhecimento de fala nativo
- 📎 **File Attachment** — Anexe arquivos de contexto (até 5)
- 🌓 **Dark / Light Mode** — Alterna entre temas escuro e claro
- 💾 **Histórico de Prompts** — Seus últimos 50 comandos salvos localmente
- 📐 **Painel Lateral** — Funciona como UI flutuante ou no sidepanel do Chrome
- ✨ **Prompt Optimizer** — Melhore seus prompts automaticamente

## Instalação

1. Baixe ou clone este repositório
2. Vá em `chrome://extensions`
3. Ative **"Modo do desenvolvedor"** (cantos superior direito)
4. Clique **"Carregar sem compactação"**
5. Selecione a pasta `lovable-boost`

Pronto! Acesse qualquer página em `*.lovable.dev` e veja o botão flutuante.

## Como Usar

| Funcionalidade | Como acessar |
|---|---|
| Templates | Clique no botão flutuante → aba "Prompt" → escolha o template |
| Voz | Abra o painel → clique no microfone 🎤 |
| Anexos | Abra o painel → clique em 📎 (até 5 arquivos) |
| Histórico | Abra o painel → aba "Histórico" |
| Tema | Use o toggle 🌙/☀️ no cabeçalho |
| Sidepanel | Clique no ícone da extensão na barra ou no botão 📐 |

## Estrutura

```
lovable-boost/
├── manifest.json        # Configuração da extensão
├── background.js        # Service worker (proxyFetch)
├── content.js           # UI flutuante + lógica principal
├── floating.css         # Estilos completos
├── sidepanel.html       # Painel lateral
├── sidepanel.js         # Lógica do painel lateral
├── icons/               # Ícones SVG
├── README.md
└── LICENSE
```

## Licença

MIT — use, modifique, compartilhe à vontade.

---

Feito com ☕ para a comunidade Lovable.dev
