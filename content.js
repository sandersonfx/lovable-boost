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
    let chatTemplate = null;

    // ── Load stored data ─────────────────────────────────────────────
    chrome.storage.local.get(['lovableToken', 'lovableProjectId', 'lovablePromptHistory', 'lovableDarkMode'], (res) => {
        if (res.lovableToken) currentToken = res.lovableToken;
        if (res.lovableProjectId) currentProjectId = res.lovableProjectId;
        if (res.lovablePromptHistory) promptHistory = res.lovablePromptHistory;
        if (res.lovableDarkMode !== undefined) isDarkMode = res.lovableDarkMode;
        updateUI();
    });

    // ── Listen for token & template from pageHook ────────────────────
    window.addEventListener('message', (event) => {
        if (event.data.type === 'lovableTokenFound') {
            const { token, projectId } = event.data;
            if (token) { currentToken = token; chrome.storage.local.set({ lovableToken: token }); }
            if (projectId) { currentProjectId = projectId; chrome.storage.local.set({ lovableProjectId: projectId }); }
            updateUI();
            const panel = document.getElementById('lovable-boost-panel');
            if (panel && currentToken && currentProjectId) panel.classList.add('lb-open');
        }
        if (event.data.type === 'lovableChatTemplate') {
            chatTemplate = { url: event.data.url, method: event.data.method, bodyTemplate: event.data.bodyTemplate };
            console.log('[LovableBoost] Template:', chatTemplate.url);
            updateUI();
        }
    });

    // ── Templates ────────────────────────────────────────────────────
    const PROMPT_TEMPLATES = [
        { label: '🐛 Fix Bug', template: 'Fix the following bug:\n\n' },
        { label: '🎨 UI/UX', template: 'Improve the UI/UX: better spacing, typography, color contrast, micro-interactions, and visual hierarchy.' },
        { label: '🚀 Performance', template: 'Optimize performance: lazy loading, code splitting, image optimization, caching.' },
        { label: '📱 Responsivo', template: 'Make the interface fully responsive for mobile with proper breakpoints and touch-friendly targets.' },
        { label: '📊 Dashboard', template: 'Create a dashboard with charts, metrics cards, data tables, filtering, and export options.' },
        { label: '🔐 Auth', template: 'Add authentication with email/password and OAuth (Google, GitHub). Protected routes and session management.' },
        { label: '🧪 Testes', template: 'Add comprehensive tests: unit tests, integration tests, E2E tests with Playwright.' },
        { label: '🌗 Dark Mode', template: 'Implement dark mode toggle with CSS custom properties, persist preference.' },
        { label: '📝 Form', template: 'Create a form with validation, error messages, loading states, and submission feedback.' },
    ];

    // ── Build UI ─────────────────────────────────────────────────────
    const container = document.createElement('div');
    container.id = 'lovable-boost-container';
    container.innerHTML = `
        <div id="lovable-boost-toggle" title="Lovable Boost API">⚡ Lovable Boost</div>
        <div id="lovable-boost-panel" class="${isDarkMode ? 'dark' : 'light'}">
            <div class="lb-header">
                <h3>⚡ Lovable Boost</h3>
                <div class="lb-header-actions">
                    <button id="lb-theme-toggle" title="Toggle tema">${isDarkMode ? '☀️' : '🌙'}</button>
                    <button id="lb-clear-btn" title="Limpar">🗑️</button>
                    <button id="lb-close-btn" title="Fechar">✕</button>
                </div>
            </div>
            <div id="lb-status" class="lb-status lb-status-waiting">🔴 Aguardando token...</div>
            <div id="lb-project-info" class="lb-project-info" style="display:none;"></div>
            <div class="lb-input-area">
                <textarea id="lb-prompt-input" placeholder="Digite seu prompt..." rows="4"></textarea>
                <div class="lb-input-actions">
                    <button id="lb-voice-btn" title="Voz">🎤</button>
                    <button id="lb-send-btn" class="lb-btn-primary">Enviar via API 🚀</button>
                </div>
            </div>
            <div id="lb-templates" class="lb-templates">
                <div class="lb-templates-header">Templates</div>
                <div class="lb-templates-grid"></div>
            </div>
            <div id="lb-loading" style="display:none;" class="lb-loading">
                <div class="lb-spinner"></div><span>Enviando...</span>
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
        btn.className = 'lb-template-btn'; btn.textContent = t.label; btn.title = t.template;
        btn.addEventListener('click', () => {
            const input = document.getElementById('lb-prompt-input');
            if (input) { input.value = t.template; input.focus(); }
        });
        templatesGrid.appendChild(btn);
    });

    // ── DOM refs ─────────────────────────────────────────────────────
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

    toggle.addEventListener('click', () => panel.classList.toggle('lb-open'));
    closeBtn.addEventListener('click', () => panel.classList.remove('lb-open'));

    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        panel.classList.remove('dark', 'light');
        panel.classList.add(isDarkMode ? 'dark' : 'light');
        themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
        chrome.storage.local.set({ lovableDarkMode: isDarkMode });
    });

    // ── Update UI ────────────────────────────────────────────────────
    function updateUI() {
        if (currentToken && currentProjectId) {
            statusEl.className = 'lb-status lb-status-active';
            statusEl.innerHTML = chatTemplate ? '🟢 Pronto' : '🟢 Pronto (fallback)';
            projectInfo.style.display = 'block';
            projectInfo.innerHTML = `📁 <code>${currentProjectId.substring(0,8)}...</code>`;
            sendBtn.disabled = false;
        } else if (currentToken) {
            statusEl.className = 'lb-status lb-status-partial';
            statusEl.innerHTML = '🟡 Aguardando Project ID...';
            projectInfo.style.display = 'none';
            sendBtn.disabled = true;
        } else {
            statusEl.className = 'lb-status lb-status-waiting';
            statusEl.innerHTML = '🔴 Abra o Lovable.dev';
            projectInfo.style.display = 'none';
            sendBtn.disabled = true;
        }
        renderHistory();
    }

    // ── ULID generator (formato que o Lovable usa nos IDs) ───────────
    function ulid() {
        const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
        let ts = Date.now().toString(36).toUpperCase();
        let rnd = '';
        for (let i = 0; i < 16; i++) rnd += ENC[Math.floor(Math.random() * ENC.length)];
        return (ts + rnd).substring(0, 26).toLowerCase();
    }
        const prompt = promptInput.value.trim();
        if (!prompt || !currentToken || !currentProjectId) return;

        loadingEl.style.display = 'flex'; resultEl.style.display = 'none'; sendBtn.disabled = true;

        const url = `https://api.lovable.dev/projects/${currentProjectId}/chat`;
        let body;
        if (chatTemplate?.bodyTemplate) {
            try {
                const p = JSON.parse(chatTemplate.bodyTemplate);
                p.message = prompt;
                p.id = 'umsg_' + ulid();
                p.ai_message_id = 'aimsg_' + ulid();
                body = JSON.stringify(p);
            } catch { body = null; }
        }
        if (!body) {
            body = JSON.stringify({
                id: 'umsg_' + ulid(),
                message: prompt, files: [], selected_elements: [],
                chat_only: false, view: "preview",
                ai_message_id: 'aimsg_' + ulid(),
                thread_id: "main", model: null
            });
        }

        chrome.runtime.sendMessage({
            action: "lovablePrompt",
            url, body, token: currentToken, projectId: currentProjectId
        }, (response) => {
            loadingEl.style.display = 'none'; sendBtn.disabled = false;
            if (chrome.runtime.lastError) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<div class="lb-result-error">⚠️ ${chrome.runtime.lastError.message}</div>`;
                return;
            }
            if (!response || !response.ok) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<div class="lb-result-error">⚠️ ${response?.error || 'Erro'}</div>`;
                promptHistory.unshift({ prompt: prompt.substring(0, 200), timestamp: new Date().toISOString(), status: 'error' });
            } else {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<div class="lb-result-success">✅ OK</div><div style="font-size:11px;color:#888">📍 ${url}</div><pre class="lb-result-content">${escapeHtml(JSON.stringify(response.data, null, 2).substring(0, 5000))}</pre>`;
                promptHistory.unshift({ prompt: prompt.substring(0, 200), timestamp: new Date().toISOString(), status: 'ok' });
            }
            if (promptHistory.length > 50) promptHistory = promptHistory.slice(0, 50);
            chrome.storage.local.set({ lovablePromptHistory: promptHistory });
            renderHistory();
        });
    }

    sendBtn.addEventListener('click', sendPrompt);
    promptInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendPrompt(); }
    });

    // ── Voice ────────────────────────────────────────────────────────
    let recognition = null, isListening = false;
    voiceBtn.addEventListener('click', () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert('Voz não disponível.'); return; }
        if (isListening) { recognition?.stop(); voiceBtn.textContent = '🎤'; voiceBtn.classList.remove('lb-listening'); isListening = false; return; }
        recognition = new SR(); recognition.lang = 'pt-BR'; recognition.interimResults = true;
        recognition.onresult = (e) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; promptInput.value = (promptInput.value + ' ' + t).trim(); };
        recognition.onerror = recognition.onend = () => { voiceBtn.textContent = '🎤'; voiceBtn.classList.remove('lb-listening'); isListening = false; };
        recognition.start(); voiceBtn.textContent = '⏹️'; voiceBtn.classList.add('lb-listening'); isListening = true;
    });

    // ── History ──────────────────────────────────────────────────────
    function renderHistory() {
        if (!historyList) return;
        if (promptHistory.length === 0) { historyEl.style.display = 'none'; return; }
        historyEl.style.display = 'block';
        historyList.innerHTML = promptHistory.slice(0, 10).map((e, i) => {
            const d = new Date(e.timestamp);
            return `<div class="lb-history-item"><span>${e.status === 'ok' ? '✅' : '❌'}</span><span>${escapeHtml(e.prompt)}</span><span>${d.toLocaleString('pt-BR')}</span></div>`;
        }).join('');
    }
    clearBtn.addEventListener('click', () => { promptHistory = []; chrome.storage.local.set({ lovablePromptHistory: [] }); renderHistory(); });

    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ── Side panel on icon click ─────────────────────────────────────
    chrome.runtime.onMessage.addListener((msg) => { if (msg.action === "toggleBoost") panel.classList.toggle('lb-open'); });

    updateUI();
    console.log('[LovableBoost] Content script loaded');
})();
