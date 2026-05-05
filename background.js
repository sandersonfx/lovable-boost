console.log("[LovableBoost] Service worker iniciado");

let cachedTemplate = null;

// ── Extension icon click → toggle panel ────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url && tab.url.includes('lovable.dev')) {
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "toggleBoost" });
        } catch (err) {
            console.log("[LovableBoost] Tab not ready:", err.message);
        }
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Store captured chat template from pageHook
    if (msg.action === "saveChatTemplate") {
        cachedTemplate = msg.template;
        console.log("[LovableBoost] Template salvo:", cachedTemplate.url);
        sendResponse({ ok: true });
        return false;
    }

    // Proxy fetch genérico
    if (msg.action === "proxyFetch") {
        (async () => {
            try {
                const opts = {
                    method: msg.method || "GET",
                    headers: msg.headers || {},
                    body: msg.body || null
                };
                const resp = await fetch(msg.url, opts);
                const text = await resp.text();
                let data;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                sendResponse({ ok: resp.ok, status: resp.status, data });
            } catch (err) {
                sendResponse({ ok: false, status: 0, data: { error: err.message } });
            }
        })();
        return true;
    }

    // ── Prompt pro Lovable ──────────────────────────────────────────
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { token, projectId, prompt, chatTemplate } = msg;
                if (!token || !projectId) {
                    sendResponse({ ok: false, error: "Token não capturado." });
                    return;
                }

                const tmpl = chatTemplate || cachedTemplate;

                // URL: capturada do template ou fallback confirmado
                const url = (tmpl && tmpl.url)
                    ? tmpl.url
                    : `https://api.lovable.dev/projects/${projectId}/chat`;

                // Body: capturado do template ou fallback completo
                let body;
                if (tmpl && tmpl.bodyTemplate) {
                    try {
                        const parsed = JSON.parse(tmpl.bodyTemplate);
                        parsed.message = prompt;
                        parsed.id = 'umsg_' + Date.now().toString(36) + Math.random().toString(36).substr(2,9);
                        parsed.ai_message_id = 'aimsg_' + Date.now().toString(36) + Math.random().toString(36).substr(2,9);
                        body = JSON.stringify(parsed);
                    } catch {
                        body = null;
                    }
                }
                if (!body) {
                    // Fallback: mesmo formato do curl real do Lovable
                    body = JSON.stringify({
                        id: 'umsg_' + Date.now().toString(36) + Math.random().toString(36).substr(2,9),
                        message: prompt,
                        files: [],
                        selected_elements: [],
                        chat_only: false,
                        view: "preview",
                        ai_message_id: 'aimsg_' + Date.now().toString(36) + Math.random().toString(36).substr(2,9),
                        thread_id: "main",
                        model: null
                    });
                }

                console.log("[LovableBoost] POST", url);
                console.log("[LovableBoost] Body:", body.substring(0, 200));

                const resp = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                        "Origin": "https://lovable.dev",
                        "Referer": "https://lovable.dev/"
                    },
                    body: body,
                    credentials: "include"
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    sendResponse({ ok: false, error: `HTTP ${resp.status}: ${text.substring(0, 300)}` });
                    return;
                }

                const data = await resp.json();
                console.log("[LovableBoost] ✅ OK");
                sendResponse({ ok: true, data, endpoint: url });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }
});
