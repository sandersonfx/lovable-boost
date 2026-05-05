(function() {
    'use strict';

    // ── Inject pageHook ──────────────────────────────────────────────
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('pageHook.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    let currentToken = null;
    let currentProjectId = null;
    let promptHistory = [];
    let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // ── Load stored data ─────────────────────────────────────────────
    chrome.storage.local.get(['lovableToken', 'lovableProjectId', 'lovablePromptHistory', 'lovableDarkMode'], (res) => {
        if (res.lovableToken) currentToken = res.lovableToken;
        if (res.lovableProjectId) currentProjectId = res.lovableProjectId;
        if (res.lovablePromptHistory) promptHistory = res.lovablePromptHistory;
        if (res.lovableDarkMode !== undefined) isDarkMode = res.lovableDarkMode;
        updateUI();
    });

    // ── Listen for token from pageHook ───────────────────────────────
    window.addEventListener('message', (event) => {
        if (event.data.type === 'lovableTokenFound') {
            const { token, projectId } = event.data;
            if (token) {
                currentToken = token;
                chrome.storage.local.set({ lovableToken: token });
            }
            if (projectId) {
                currentProjectId = projectId;
                chrome.storage.local.set({ lovableProjectId: projectId });
            }
            updateUI();
        }
    });

    // ── Templates ───────────────────────────────────────────────────
    const PROMPT_TEMPLATES = [
        { label: '📱 Responsivo Mobile', template: 'Make the entire interface fully responsive for mobile devices. Use proper breakpoints, touch-friendly targets, and a mobile-first approach.' },
        { label: '🎨 Melhorar UI/UX', template: 'Improve the overall UI/UX design: better spacing, typography, color contrast, micro-interactions, and visual hierarchy. Make it look more polished and professional.' },
        { label: '🐛 Fix Bug', template: 'Fix the following bug:\n\n'} ,
        { label: '🔐 Adicionar Auth', template: 'Add authentication flow with email/password and OAuth providers (Google, GitHub). Include protected routes, session management, and a login/register UI.' },
        { label: '📊 Dashboard', template: 'Create a dashboard page with charts, metrics cards, and data tables. Include filtering, date range picker, and export options.' },
        { label: '🚀 Performance', template: 'Optimize performance: lazy loading, code splitting, image optimization, caching strategy, and reduce bundle size. Add performance monitoring.' },
        { label: '🌗 Dark Mode', template: 'Implement a dark mode toggle with CSS custom properties. Persist the preference, handle system preference, and ensure all components have dark variants.' },
        { label: '📝 Form + Validação', template: 'Create a form with validation using react-hook-form/zod. Include real-time validation, error messages, loading states, and submission feedback.' },
        { label: '🧪 Testes', template: 'Add comprehensive tests: unit tests with Vitest, integration tests, and E2E tests with Playwright. Cover edge cases and error states.' },
    ];

    // ── Build UI ────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'lovable-boost-container';
    container.innerHTML = `
        <div id="lovable-boost-toggle" title="Lovable Boost API">⚡</div>
        <div id="lovable-boost-panel" class="${isDarkMode ? 'dark' : 'light'}">
            <div class="lb-header">
                <h3>⚡ Lovable Boost</h3>
                <div class="lb-header-actions">
                    <button id="lb-theme-toggle" title="Toggle tema">${isDarkMode ? '☀️' : '🌙'}</button>
                    <button id="lb-clear-btn" title="Limpar histórico">🗑️</button>
                    <button id="lb-close-btn" title="Fechar">✕</button>
                </div>
            </div>
            <div id="lb-status" class="lb-status lb-status-waiting">🔴 Aguardando token...</div>
            <div id="lb-project-info" class="lb-project-info" style="display:none;"></div>
            <div class="lb-input-area">
                <textarea id="lb-prompt-input" placeholder="Digite seu prompt para o Lovable..." rows="4"></textarea>
                <div class="lb-input-actions">
                    <button id="lb-voice-btn" title="Digitar por voz">🎤</button>
                    <button id="lb-send-btn" class="lb-btn-primary">Enviar via API 🚀</button>
                </div>
            </div>
            <div id="lb-templates" class="lb-templates">
                <div class="lb-templates-header">Templates rápidos</div>
                <div class="lb-templates-grid"></div>
            </div>
            <div id="lb-loading" style="display:none;" class="lb-loading">
                <div class="lb-spinner"></div>
                <span>Enviando para Lovable API...</span>
            </div>
            <div id="lb-result" class="lb-result" style="display:none;"></div>
            <div id="lb-history" class="lb-history" style="display:none;">
                <div class="lb-history-header">Histórico</div>
                <div id="lb-history-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // ── Render templates ─────────────────────────────────────────────
    const templatesGrid = container.querySelector('.lb-templates-grid');
    PROMPT_TEMPLATES.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'lb-template-btn';
        btn.textContent = t.label;
        btn.title = t.template;
        btn.addEventListener('click', () => {
            const input = document.getElementById('lb-prompt-input');
            if (input) {
                if (t.label === '🐛 Fix Bug') {
                    input.value = t.template;
                } else {
                    input.value = t.template;
                }
                input.focus();
            }
        });
        templatesGrid.appendChild(btn);
    });

    // ── DOM refs ────────────────────────────────────────────────────
    const panel = document.getElementById('lovable-boost-panel');
    const toggle = document.getElementById('lovable-boost-toggle');
    const statusEl = document.getElementById('lb-status');
    const projectInfo = document.getElementById('lb-project-info');
    const promptInput = document.getElementById('lb-prompt-input');
    const sendBtn = document.getElementById('lb-send-btn');
    const voiceBtn = document.getElementById('lb-voice-btn');
    const loadingEl = document.getElementById('lb-loading');
    const resultEl = document.getElementById('lb-result');
    const historyEl = document.getElementById('lb-history');
    const historyList = document.getElementById('lb-history-list');
    const closeBtn = document.getElementById('lb-close-btn');
    const clearBtn = document.getElementById('lb-clear-btn');
    const themeToggle = document.getElementById('lb-theme-toggle');

    // ── Toggle panel ─────────────────────────────────────────────────
    toggle.addEventListener('click', () => {
        panel.classList.toggle('lb-open');
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('lb-open');
    });

    // ── Theme toggle ─────────────────────────────────────────────────
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        panel.classList.remove('dark', 'light');
        panel.classList.add(isDarkMode ? 'dark' : 'light');
        themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
        chrome.storage.local.set({ lovableDarkMode: isDarkMode });
    });

    // ── Update UI state ─────────────────────────────────────────────
    function updateUI() {
        if (currentToken && currentProjectId) {
            statusEl.className = 'lb-status lb-status-active';
            statusEl.innerHTML = `🟢 Token capturado: <code>${currentProjectId.substring(0, 8)}...</code>`;
            projectInfo.style.display = 'block';
            projectInfo.innerHTML = `📁 Projeto: <code>${currentProjectId}</code>`;
            sendBtn.disabled = false;
        } else if (currentToken) {
            statusEl.className = 'lb-status lb-status-partial';
            statusEl.innerHTML = '🟡 Token capturado, aguardando Project ID...';
            projectInfo.style.display = 'none';
            sendBtn.disabled = true;
        } else {
            statusEl.className = 'lb-status lb-status-waiting';
            statusEl.innerHTML = '🔴 Aguardando token...';
            projectInfo.style.display = 'none';
            sendBtn.disabled = true;
        }
        renderHistory();
    }

    // ── Send prompt ─────────────────────────────────────────────────
    async function sendPrompt() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        if (!currentToken || !currentProjectId) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<div class="lb-result-error">⚠️ Token ou Project ID não disponível. Acesse o Lovable.dev primeiro.</div>';
            return;
        }

        loadingEl.style.display = 'flex';
        resultEl.style.display = 'none';
        sendBtn.disabled = true;

        chrome.runtime.sendMessage({
            action: "lovablePrompt",
            token: currentToken,
            projectId: currentProjectId,
            prompt: prompt
        }, (response) => {
            loadingEl.style.display = 'none';
            sendBtn.disabled = false;

            if (chrome.runtime.lastError) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<div class="lb-result-error">⚠️ Erro: ${chrome.runtime.lastError.message}</div>`;
                return;
            }

            if (!response || !response.ok) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<div class="lb-result-error">⚠️ ${response?.error || 'Erro desconhecido'}</div>`;
                return;
            }

            const data = response.data;
            const output = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);

            resultEl.style.display = 'block';
            resultEl.innerHTML = `
                <div class="lb-result-success">✅ Resposta recebida!</div>
                <pre class="lb-result-content">${escapeHtml(output.substring(0, 5000))}</pre>
                ${output.length > 5000 ? '<div class="lb-result-truncated">... (truncado, veja o console completo)</div>' : ''}
            `;

            // Save to history
            const entry = {
                prompt: prompt.substring(0, 200),
                timestamp: new Date().toISOString(),
                status: 'ok'
            };
            promptHistory.unshift(entry);
            if (promptHistory.length > 50) promptHistory = promptHistory.slice(0, 50);
            chrome.storage.local.set({ lovablePromptHistory: promptHistory });
            renderHistory();
        });
    }

    sendBtn.addEventListener('click', sendPrompt);

    // ── Ctrl+Enter to send ──────────────────────────────────────────
    promptInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            sendPrompt();
        }
    });

    // ── Voice input ─────────────────────────────────────────────────
    let recognition = null;
    let isListening = false;

    voiceBtn.addEventListener('click', () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Reconhecimento de voz não disponível neste navegador. Use Chrome.');
            return;
        }

        if (isListening) {
            if (recognition) recognition.stop();
            voiceBtn.textContent = '🎤';
            voiceBtn.classList.remove('lb-listening');
            isListening = false;
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            promptInput.value = (promptInput.value + ' ' + transcript).trim();
            promptInput.scrollTop = promptInput.scrollHeight;
        };

        recognition.onerror = () => {
            voiceBtn.textContent = '🎤';
            voiceBtn.classList.remove('lb-listening');
            isListening = false;
        };

        recognition.onend = () => {
            voiceBtn.textContent = '🎤';
            voiceBtn.classList.remove('lb-listening');
            isListening = false;
        };

        recognition.start();
        voiceBtn.textContent = '⏹️';
        voiceBtn.classList.add('lb-listening');
        isListening = true;
    });

    // ── Render history ──────────────────────────────────────────────
    function renderHistory() {
        if (!historyList) return;
        if (promptHistory.length === 0) {
            historyEl.style.display = 'none';
            return;
        }
        historyEl.style.display = 'block';
        historyList.innerHTML = promptHistory.slice(0, 10).map((entry, i) => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleString('pt-BR');
            const icon = entry.status === 'ok' ? '✅' : '❌';
            return `<div class="lb-history-item" data-idx="${i}">
                <span class="lb-history-icon">${icon}</span>
                <span class="lb-history-text">${escapeHtml(entry.prompt)}</span>
                <span class="lb-history-time">${timeStr}</span>
            </div>`;
        }).join('');
    }

    // ── Clear history ───────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        promptHistory = [];
        chrome.storage.local.set({ lovablePromptHistory: [] });
        renderHistory();
    });

    // ── Escape HTML ─────────────────────────────────────────────────
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ── Initial render ──────────────────────────────────────────────
    updateUI();

    // ── Side panel on extension icon click ──────────────────────────
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "toggleBoost") {
            panel.classList.toggle('lb-open');
        }
    });

    console.log('[LovableBoost] Content script loaded');
})();
