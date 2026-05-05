/**
 * Lovable Boost — Content Script
 *
 * Injeta uma UI flutuante no Lovable.dev com:
 * - Prompt Templates
 * - Prompt Optimizer
 * - Speech-to-Text
 * - Dark/Light Mode
 * - File Attachment
 * - Histórico de Prompts
 * - Abas (Prompt / Histórico)
 * - Side Panel
 *
 * Tudo local, sem dependências externas, sem back-end.
 */

(function () {
  'use strict';

  // ================================================================
  // CONSTANTES
  // ================================================================

  const STORAGE_KEY = 'lovable_boost_history';
  const MAX_HISTORY = 50;

  /** Templates disponíveis */
  const TEMPLATES = [
    { id: 'bugs',      icon: '🐛', label: 'Bugs',        prompt: 'Identifique e resolva todos os bugs neste código. Liste cada bug encontrado com linha e solução.' },
    { id: 'refactor',  icon: '🔧', label: 'Refatorar',   prompt: 'Refatore este código seguindo princípios SOLID e boas práticas. Mantenha a mesma funcionalidade mas melhore legibilidade, manutenibilidade e performance.' },
    { id: 'errors',    icon: '🚨', label: 'Erros',       prompt: 'Analise este código e me ajude a corrigir os erros. Mostre o erro, a causa e a correção aplicada.' },
    { id: 'optimize',  icon: '⚡', label: 'Otimizar',    prompt: 'Otimize este código para melhor performance. Considere complexidade algorítmica, cache, lazy loading e boas práticas de performance.' },
    { id: 'comments',  icon: '📝', label: 'Comentários', prompt: 'Adicione comentários descritivos em português neste código. Explique lógica, parâmetros e retornos de cada função.' },
    { id: 'seo',       icon: '🔍', label: 'SEO',         prompt: 'Melhore o SEO deste componente/site. Inclua meta tags, structured data, headings hierarchy, alt text e performance.' },
    { id: 'ui',        icon: '🎨', label: 'UI',          prompt: 'Melhore a UI deste componente. Aplique boas práticas de design, acessibilidade (WCAG), responsividade e micro-interações.' },
    { id: 'components',icon: '🧩', label: 'Componentes', prompt: 'Refatore este código para componentes reutilizáveis e desacoplados. Aplique pattern composition com props bem definidas.' },
    { id: 'review',    icon: '👀', label: 'Review',      prompt: 'Faça um code review completo deste código. Aponte problemas de segurança, performance, manutenibilidade e sugira melhorias.' }
  ];

  /** Níveis do Prompt Optimizer */
  const OPTIMIZER_LEVELS = [
    { value: 'none',     label: 'Sem otimização' },
    { value: 'detailed', label: '➕ Mais detalhes' },
    { value: 'context',  label: '📋 Adicionar contexto' },
    { value: 'precise',  label: '🎯 Mais preciso' },
    { value: 'creative', label: '💡 Mais criativo' }
  ];

  /** Prefixos para cada nível de otimização */
  const OPTIMIZER_PREFIXES = {
    detailed:  'Seja extremamente detalhado e específico na resposta. Inclua exemplos práticos, código e explicações passo a passo.\n\n',
    context:   'Considere o contexto completo do projeto. Explique trade-offs, alternativas viáveis e impacto em outras partes do sistema.\n\n',
    precise:   'Seja direto e objetivo. Responda apenas o que foi perguntado, sem divagações. Prefira respostas curtas e acionáveis.\n\n',
    creative:  'Pense fora da caixa. Sugira abordagens criativas e inovadoras, mesmo que não convencionais. Considere múltiplas perspectivas.\n\n'
  };

  // ================================================================
  // ESTADO DA APLICAÇÃO
  // ================================================================

  const state = {
    visible: false,
    theme: 'dark',
    recording: false,
    files: [],
    history: [],
    activeTab: 'prompt',
    recognition: null,
    template: ''
  };

  let dom = {};

  // ================================================================
  // STORAGE (chrome.storage.local)
  // ================================================================

  /** Carrega histórico do chrome.storage.local */
  async function loadHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        state.history = result[STORAGE_KEY] || [];
        resolve();
      });
    });
  }

  /** Salva histórico no chrome.storage.local */
  async function saveHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: state.history }, resolve);
    });
  }

  /** Carrega o tema salvo */
  async function loadTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get('lovable_boost_theme', (result) => {
        state.theme = result.lovable_boost_theme || 'dark';
        resolve();
      });
    });
  }

  /** Salva o tema */
  async function saveTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'lovable_boost_theme': state.theme }, resolve);
    });
  }

  // ================================================================
  // TOAST (notificações temporárias)
  // ================================================================

  function showToast(message) {
    const existing = document.querySelector('.lb-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'lb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // ================================================================
  // ENCONTRAR TEXTAREA DO LOVABLE.DEV
  // ================================================================

  function findTextarea() {
    return document.querySelector('textarea') ||
           document.querySelector('[contenteditable="true"]') ||
           document.querySelector('.ProseMirror');
  }

  /** Insere texto no textarea do Lovable */
  function insertIntoTextarea(text) {
    const el = findTextarea();
    if (!el) {
      showToast('⚠️ Textarea não encontrado na página');
      return false;
    }

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable || el.classList.contains('ProseMirror')) {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  // ================================================================
  // HISTÓRICO
  // ================================================================

  function addToHistory(prompt) {
    const entry = {
      text: prompt,
      timestamp: Date.now(),
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
    };
    state.history.unshift(entry);
    if (state.history.length > MAX_HISTORY) {
      state.history = state.history.slice(0, MAX_HISTORY);
    }
    saveHistory();
    updateHistoryBadge();
  }

  function updateHistoryBadge() {
    const badge = dom.historyBadge;
    if (badge) {
      const count = state.history.length;
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
  }

  function renderHistory() {
    const list = dom.historyList;
    if (!list) return;

    if (state.history.length === 0) {
      list.innerHTML = '<div class="lb-history-empty">Nenhum prompt salvo ainda</div>';
      return;
    }

    list.innerHTML = state.history.map((entry) => {
      const preview = entry.text.length > 80
        ? entry.text.slice(0, 80) + '...'
        : entry.text;
      const time = new Date(entry.timestamp).toLocaleString('pt-BR');
      return `<div class="lb-history-item" data-id="${entry.id}">
        <div>${escapeHtml(preview)}</div>
        <div style="font-size:10px;color:var(--lb-text-secondary);margin-top:4px;">${time}</div>
      </div>`;
    }).join('');

    // Click para reusar prompt
    list.querySelectorAll('.lb-history-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const entry = state.history.find((e) => e.id === id);
        if (entry) {
          dom.textInput.value = entry.text;
          switchTab('prompt');
          showToast('✅ Prompt carregado do histórico');
        }
      });
    });
  }

  // ================================================================
  // UTILITÁRIOS
  // ================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ================================================================
  // ABA DE TEMPLATES / PROMPT
  // ================================================================

  function renderTemplates() {
    const container = dom.templatesContainer;
    container.innerHTML = TEMPLATES.map((t) => `
      <button class="lb-template-btn" data-template="${t.id}">
        <span class="lb-template-icon">${t.icon}</span>
        ${t.label}
      </button>
    `).join('');

    container.querySelectorAll('.lb-template-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.template;
        const template = TEMPLATES.find((t) => t.id === id);
        if (template) {
          dom.textInput.value = template.prompt;
          state.template = template.prompt;
          showToast(`📋 Template "${template.label}" aplicado`);
        }
      });
    });
  }

  function renderOptimizer() {
    const select = dom.optimizerSelect;
    select.innerHTML = OPTIMIZER_LEVELS.map((l) =>
      `<option value="${l.value}">${l.label}</option>`
    ).join('');
  }

  // ================================================================
  // SPEECH-TO-TEXT
  // ================================================================

  function initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      dom.micBtn.style.display = 'none';
      return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.lang = 'pt-BR';
    state.recognition.continuous = false;
    state.recognition.interimResults = true;

    state.recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      dom.textInput.value = (dom.textInput.value + ' ' + transcript).trim();
    };

    state.recognition.onend = () => {
      state.recording = false;
      dom.micBtn.classList.remove('lb-recording');
      dom.micBtn.textContent = '🎤';
      dom.statusBar.textContent = '✅ Dictação concluída';
    };

    state.recognition.onerror = (event) => {
      state.recording = false;
      dom.micBtn.classList.remove('lb-recording');
      dom.micBtn.textContent = '🎤';
      dom.statusBar.textContent = `❌ Erro: ${event.error}`;
    };

    dom.micBtn.addEventListener('click', toggleRecording);
  }

  function toggleRecording() {
    if (!state.recognition) return;

    if (state.recording) {
      state.recognition.stop();
      return;
    }

    try {
      state.recording = true;
      dom.micBtn.classList.add('lb-recording');
      dom.micBtn.textContent = '🔴';
      dom.statusBar.textContent = '🎤 Gravando... fale agora';
      state.recognition.start();
    } catch (e) {
      showToast('❌ Erro ao iniciar gravação');
    }
  }

  // ================================================================
  // FILE ATTACHMENT
  // ================================================================

  function initFileAttachment() {
    dom.fileInput = document.createElement('input');
    dom.fileInput.type = 'file';
    dom.fileInput.multiple = true;
    dom.fileInput.accept = '*/*';
    dom.fileInput.style.display = 'none';

    dom.fileInput.addEventListener('change', (e) => {
      const newFiles = Array.from(e.target.files);
      const remaining = 5 - state.files.length;

      if (newFiles.length > remaining) {
        showToast(`⚠️ Máximo de 5 arquivos. ${remaining} restantes.`);
        newFiles.splice(remaining);
      }

      newFiles.forEach((file) => {
        state.files.push(file);
      });

      renderFileList();
      e.target.value = '';
    });

    dom.fileBtn.addEventListener('click', () => {
      dom.fileInput.click();
    });

    dom.fileArea.appendChild(dom.fileInput);
  }

  function renderFileList() {
    const list = dom.fileList;
    list.innerHTML = state.files.map((file, index) => `
      <div class="lb-file-chip">
        <span>${escapeHtml(file.name)}</span>
        <button data-index="${index}" title="Remover">&times;</button>
      </div>
    `).join('');

    list.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        state.files.splice(index, 1);
        renderFileList();
      });
    });
  }

  // ================================================================
  // ENVIAR PROMPT
  // ================================================================

  function sendPrompt() {
    const raw = dom.textInput.value.trim();
    if (!raw) {
      showToast('⚠️ Digite ou selecione um prompt primeiro');
      return;
    }

    // Aplica otimização se selecionada
    const level = dom.optimizerSelect.value;
    let prompt = raw;
    if (level !== 'none' && OPTIMIZER_PREFIXES[level]) {
      prompt = OPTIMIZER_PREFIXES[level] + prompt;
    }

    // Adiciona conteúdo dos arquivos anexados (apenas nomes como contexto)
    if (state.files.length > 0) {
      const fileContext = '\n\n---\nArquivos anexados como contexto:\n' +
        state.files.map((f) => `- ${f.name}`).join('\n') +
        '\n---';
      prompt += fileContext;
    }

    // Insere no textarea do Lovable
    const inserted = insertIntoTextarea(prompt);

    if (inserted) {
      addToHistory(raw);
      showToast('✅ Prompt inserido no editor');

      // Limpa o campo e arquivos
      dom.textInput.value = '';
      state.files = [];
      renderFileList();
      state.template = '';
    }
  }

  // ================================================================
  // TABS
  // ================================================================

  function switchTab(tab) {
    state.activeTab = tab;
    dom.tabs.forEach((t) => t.classList.remove('active'));
    dom.promptTab.classList.toggle('active', tab === 'prompt');
    dom.historyTab.classList.toggle('active', tab === 'history');

    dom.promptPane.style.display = tab === 'prompt' ? 'block' : 'none';
    dom.historyPane.style.display = tab === 'history' ? 'block' : 'none';

    if (tab === 'history') renderHistory();
  }

  // ================================================================
  // THEME TOGGLE
  // ================================================================

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveTheme();
  }

  function applyTheme() {
    if (state.theme === 'light') {
      dom.panel.classList.add('lb-light');
      dom.themeBtn.textContent = '🌙';
    } else {
      dom.panel.classList.remove('lb-light');
      dom.themeBtn.textContent = '☀️';
    }
  }

  // ================================================================
  // DRAG (arrastar o painel)
  // ================================================================

  function initDrag() {
    let isDragging = false;
    let startX, startY, origX, origY;

    dom.header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.lb-header-actions')) return;
      isDragging = true;
      const rect = dom.panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origX = rect.left;
      origY = rect.top;
      dom.panel.style.position = 'fixed';
      dom.panel.style.top = origY + 'px';
      dom.panel.style.left = origX + 'px';
      dom.panel.style.right = 'auto';
      dom.panel.style.bottom = 'auto';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      dom.panel.style.left = (origX + e.clientX - startX) + 'px';
      dom.panel.style.top = (origY + e.clientY - startY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ================================================================
  // SIDE PANEL
  // ================================================================

  function openSidePanel() {
    chrome.runtime.sendMessage({ action: 'openSidePanel' });
    showToast('📐 Painel lateral aberto');
  }

  // ================================================================
  // CONSTRUÇÃO DA UI
  // ================================================================

  function buildUI() {
    const panel = document.createElement('div');
    panel.id = 'lovable-boost';
    panel.innerHTML = `
      <!-- Header -->
      <div class="lb-header">
        <div class="lb-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#7C3AED" stroke="#7C3AED"/>
            <path d="M7 8h10M7 12h8M7 16h6" stroke="#fff" stroke-width="1.5"/>
          </svg>
          Lovable Boost
        </div>
        <div class="lb-header-actions">
          <button class="lb-btn" id="lb-sidepanel-btn" title="Abrir no painel lateral">📐</button>
          <button class="lb-btn" id="lb-theme-btn" title="Alternar tema">☀️</button>
          <button class="lb-btn" id="lb-close-btn" title="Fechar">&times;</button>
        </div>
      </div>

      <!-- Abas -->
      <div class="lb-tabs">
        <button class="lb-tab active" data-tab="prompt">
          Prompt
        </button>
        <button class="lb-tab" data-tab="history">
          Histórico
          <span class="lb-tab-badge" id="lb-history-badge" style="display:none">0</span>
        </button>
      </div>

      <!-- Conteúdo -->
      <div class="lb-content">
        <!-- Pane: Prompt -->
        <div id="lb-pane-prompt">
          <div class="lb-templates" id="lb-templates"></div>

          <div class="lb-optimizer">
            <select id="lb-optimizer-select"></select>
            <button class="lb-mic-btn" id="lb-mic-btn" title="Dictação por voz">🎤</button>
          </div>

          <div class="lb-input-area" style="margin-top:8px">
            <textarea class="lb-text-input" id="lb-text-input" placeholder="Digite seu prompt aqui..." rows="3"></textarea>
          </div>

          <div class="lb-file-area" id="lb-file-area">
            <button class="lb-file-btn" id="lb-file-btn">📎 Anexar arquivos</button>
            <div class="lb-file-list" id="lb-file-list"></div>
          </div>

          <button class="lb-send-btn" id="lb-send-btn">🚀 Enviar para o Lovable</button>
        </div>

        <!-- Pane: Histórico -->
        <div id="lb-pane-history" style="display:none">
          <div class="lb-history-list" id="lb-history-list">
            <div class="lb-history-empty">Nenhum prompt salvo ainda</div>
          </div>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="lb-status" id="lb-status">⚡ Lovable Boost ativo</div>

      <div class="lb-resize-handle"></div>
    `;

    document.body.appendChild(panel);

    // === Referências DOM ===
    dom.panel = panel;
    dom.header = panel.querySelector('.lb-header');
    dom.themeBtn = panel.querySelector('#lb-theme-btn');
    dom.closeBtn = panel.querySelector('#lb-close-btn');
    dom.sidepanelBtn = panel.querySelector('#lb-sidepanel-btn');
    dom.templatesContainer = panel.querySelector('#lb-templates');
    dom.optimizerSelect = panel.querySelector('#lb-optimizer-select');
    dom.textInput = panel.querySelector('#lb-text-input');
    dom.micBtn = panel.querySelector('#lb-mic-btn');
    dom.fileBtn = panel.querySelector('#lb-file-btn');
    dom.fileArea = panel.querySelector('#lb-file-area');
    dom.fileList = panel.querySelector('#lb-file-list');
    dom.sendBtn = panel.querySelector('#lb-send-btn');
    dom.historyList = panel.querySelector('#lb-history-list');
    dom.historyBadge = panel.querySelector('#lb-history-badge');
    dom.statusBar = panel.querySelector('#lb-status');
    dom.promptTab = panel.querySelector('[data-tab="prompt"]');
    dom.historyTab = panel.querySelector('[data-tab="history"]');
    dom.promptPane = panel.querySelector('#lb-pane-prompt');
    dom.historyPane = panel.querySelector('#lb-pane-history');
    dom.tabs = panel.querySelectorAll('.lb-tab');

    // === Aplica tema inicial ===
    applyTheme();

    // === Eventos ===
    dom.closeBtn.addEventListener('click', hide);
    dom.themeBtn.addEventListener('click', toggleTheme);
    dom.sidepanelBtn.addEventListener('click', openSidePanel);

    dom.sendBtn.addEventListener('click', sendPrompt);

    dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Ctrl+Enter para enviar
    dom.textInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendPrompt();
      }
    });
  }

  // ================================================================
  // TOGGLE BUTTON (flutuante)
  // ================================================================

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'lovable-boost-toggle';
    btn.textContent = '🚀';
    btn.title = 'Abrir Lovable Boost';
    document.body.appendChild(btn);
    dom.toggleBtn = btn;

    btn.addEventListener('click', toggle);
  }

  function toggle() {
    if (state.visible) {
      hide();
    } else {
      show();
    }
  }

  function show() {
    state.visible = true;
    dom.panel.classList.add('lb-visible');
    dom.toggleBtn.textContent = '✕';
    dom.toggleBtn.title = 'Fechar Lovable Boost';
    dom.statusBar.textContent = '⚡ Lovable Boost ativo';
    renderHistory();
  }

  function hide() {
    state.visible = false;
    dom.panel.classList.remove('lb-visible');
    dom.toggleBtn.textContent = '🚀';
    dom.toggleBtn.title = 'Abrir Lovable Boost';
    dom.statusBar.textContent = 'Boost oculto. Clique 🚀 para reabrir.';
  }

  // ================================================================
  // TEAR DOWN (limpeza)
  // ================================================================

  function destroy() {
    if (state.recognition) {
      try { state.recognition.abort(); } catch (_) {}
    }
    if (dom.panel) dom.panel.remove();
    if (dom.toggleBtn) dom.toggleBtn.remove();
  }

  // ================================================================
  // INICIALIZAÇÃO
  // ================================================================

  async function init() {
    try {
      await Promise.all([loadHistory(), loadTheme()]);
      buildUI();
      createToggleButton();
      renderTemplates();
      renderOptimizer();
      initSpeech();
      initFileAttachment();
      initDrag();
      updateHistoryBadge();
    } catch (err) {
      console.error('[Lovable Boost] Erro na inicialização:', err);
    }
  }

  // Aguarda o DOM ficar pronto e inicia
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
