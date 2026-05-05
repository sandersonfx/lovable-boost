console.log("[LovableBoost] Service worker iniciado");

// ── Extension icon click → toggle panel ────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
    // Only works on lovable.dev pages
    if (tab.url && tab.url.includes('lovable.dev')) {
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "toggleBoost" });
        } catch (err) {
            console.log("[LovableBoost] Tab not ready for messaging:", err.message);
        }
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Chamada direta pra Lovable API (service worker = sem CORS)
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { token, projectId, prompt } = msg;
                if (!token || !projectId) {
                    sendResponse({ ok: false, error: "Token ou ProjectId não capturado. Acesse o Lovable.dev primeiro." });
                    return;
                }

                // Tenta os endpoints conhecidos do Lovable em ordem
                const endpoints = [
                    `https://api.lovable.dev/v1/projects/${projectId}/chat`,
                    `https://api.lovable.dev/v1/projects/${projectId}/completions`,
                    `https://api.lovable.dev/api/projects/${projectId}/chat`,
                    `https://lovable.dev/api/projects/${projectId}/chat`,
                ];

                let lastError = null;
                for (const url of endpoints) {
                    try {
                        console.log("[LovableBoost] Tentando:", url);
                        const resp = await fetch(url, {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({ message: prompt, prompt: prompt, stream: false })
                        });

                        if (resp.ok) {
                            const data = await resp.json();
                            console.log("[LovableBoost] ✅ Sucesso com:", url);
                            sendResponse({ ok: true, data, endpoint: url });
                            return;
                        }
                        lastError = `HTTP ${resp.status}: ${(await resp.text()).substring(0, 200)}`;
                    } catch (e) {
                        lastError = e.message;
                    }
                }
                
                sendResponse({ ok: false, error: `Nenhum endpoint funcionou. Último erro: ${lastError}` });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
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
});
