/**
 * Lovable Boost — Side Panel Script
 *
 * Versão simplificada da UI flutuante para o painel lateral do Chrome.
 * Mesmo conjunto de funcionalidades: templates, voz, anexos, histórico.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'lovable_boost_history';
  const MAX_HISTORY = 50;

  const TEMPLATES = [
    { id: 'bugs',      icon: '🐛', label: 'Bugs',        prompt: 'Identifique e resolva todos os bugs neste código. Liste cada bug encontrado com linha e solução.' },
    { id: 'refactor',  icon: '🔧', label: 'Refatorar',   prompt: 'Refatore este código seguindo princípios SOLID e boas práticas.' },
    { id: 'errors',    icon: '🚨', label: 'Erros',       prompt: 'Analise este código e me ajude a corrigir os erros.' },
    { id: 'optimize',  icon: '⚡', label: 'Otimizar',    prompt: 'Otimize este código para melhor performance.' },
    { id: 'comments',  icon: '📝', label: 'Comentários', prompt: 'Adicione comentários descritivos em português neste código.' },
    { id: 'seo',       icon: '🔍', label: 'SEO',         prompt: 'Melhore o SEO deste componente/site.' },
    { id: 'ui',        icon: '🎨', label: 'UI',          prompt: 'Melhore a UI deste componente.' },
    { id: 'components',icon: '🧩', label: 'Componentes', prompt: 'Refatore para componentes reutilizáveis.' },
    { id: 'review',    icon: '👀', label: 'Review',      prompt: 'Faça um code review completo deste código.' }
  ];

  const dom = {};
  let history = [];
  let files = [];
  let recognition = null;
  let recording = false;

  // === Storage ===
  function loadHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        history = r[STORAGE_KEY] || [];
        resolve();
      });
    });
  }

  function saveHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: history }, resolve);
    });
  }

  function addToHistory(text) {
    history.unshift({ text, timestamp: Date.now(), id: crypto.randomUUID() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  // === Helpers ===
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // === Templates ===
  function renderTemplates() {
    const container = dom.templatesContainer;
    container.innerHTML = TEMPLATES.map((t) =>
      `<button class="template-btn" data-prompt="${escapeHtml(t.prompt)}">
        <span>${t.icon}</span> ${t.label}
      </button>`
    ).join('');

    container.querySelectorAll('.template-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.textarea.value = btn.dataset.prompt;
      });
    });
  }

  // === Fala ===
  function initSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { dom.micBtn.style.display = 'none'; return; }

    recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let t = dom.textarea.value;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += ' ' + e.results[i][0].transcript;
      }
      dom.textarea.value = t.trim();
    };

    recognition.onend = () => {
      recording = false;
      dom.micBtn.classList.remove('recording');
      dom.micBtn.textContent = '🎤';
    };

    recognition.onerror = () => {
      recording = false;
      dom.micBtn.classList.remove('recording');
      dom.micBtn.textContent = '🎤';
    };

    dom.micBtn.addEventListener('click', () => {
      if (recording) { recognition.stop(); return; }
      recording = true;
      dom.micBtn.classList.add('recording');
      dom.micBtn.textContent = '🔴';
      try { recognition.start(); } catch (_) {}
    });
  }

  // === Arquivos ===
  function initFileAttachment() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '*/*';
    input.style.display = 'none';

    input.addEventListener('change', (e) => {
      const remaining = 5 - files.length;
      Array.from(e.target.files).slice(0, remaining).forEach((f) => files.push(f));
      renderFileList();
      e.target.value = '';
    });

    dom.fileBtn.addEventListener('click', () => input.click());
    document.body.appendChild(input);
  }

  function renderFileList() {
    dom.fileList.innerHTML = files.map((f, i) =>
      `<div class="file-chip">
        <span>${escapeHtml(f.name)}</span>
        <button data-index="${i}">&times;</button>
      </div>`
    ).join('');

    dom.fileList.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        files.splice(parseInt(btn.dataset.index, 10), 1);
        renderFileList();
      });
    });
  }

  // === Enviar ===
  function send() {
    const text = dom.textarea.value.trim();
    if (!text) return;

    // Envia mensagem para a aba ativa do lovable.dev
    chrome.tabs.query({ url: 'https://*.lovable.dev/*' }, (tabs) => {
      if (tabs.length === 0) {
        dom.textarea.value = '';
        addToHistory(text);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'lovableBoost_insert',
        text: text,
        files: files.map((f) => f.name)
      });

      // Se o content script não responder, tenta fallback via scripting
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (prompt) => {
          const ta = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
          if (ta) {
            ta.value = prompt;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
          }
        },
        args: [text]
      }).catch(() => {});

      dom.textarea.value = '';
      files = [];
      renderFileList();
      addToHistory(text);
    });
  }

  // === Histórico ===
  function renderHistory() {
    const list = dom.historyList;
    const empty = dom.historyEmpty;

    if (history.length === 0) {
      empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = history.map((h) =>
      `<div class="history-item" data-id="${h.id}">
        ${escapeHtml(h.text.length > 80 ? h.text.slice(0, 80) + '...' : h.text)}
        <div style="font-size:10px;color:var(--text-secondary);margin-top:2px;">${new Date(h.timestamp).toLocaleString('pt-BR')}</div>
      </div>`
    ).join('');

    list.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', () => {
        const entry = history.find((h) => h.id === item.dataset.id);
        if (entry) dom.textarea.value = entry.text;
      });
    });
  }

  // === Init ===
  async function init() {
    dom.templatesContainer = document.getElementById('sp-templates');
    dom.textarea = document.getElementById('sp-text');
    dom.micBtn = document.getElementById('sp-mic');
    dom.fileBtn = document.getElementById('sp-file');
    dom.fileList = document.getElementById('sp-file-list');
    dom.sendBtn = document.getElementById('sp-send');
    dom.historyList = document.getElementById('sp-history-list');
    dom.historyEmpty = document.getElementById('sp-history-empty');

    await loadHistory();

    renderTemplates();
    renderHistory();
    initSpeech();
    initFileAttachment();

    dom.sendBtn.addEventListener('click', send);

    dom.textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); send(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
