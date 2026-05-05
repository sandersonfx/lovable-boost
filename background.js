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
    // Proxy fetch para Lovable API — via Reativazap
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { token, projectId, prompt, proxyUrl } = msg;
                if (!token || !projectId) {
                    sendResponse({ ok: false, error: "Token ou ProjectId não capturado. Acesse o Lovable.dev primeiro." });
                    return;
                }

                // Usa o proxy do Reativazap
                const PROXY_URL = proxyUrl || "https://api.reativazap.com/lovable/proxy";
                
                const resp = await fetch(PROXY_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, projectId, prompt })
                });

                const result = await resp.json();
                
                if (result.ok) {
                    sendResponse({ ok: true, data: result.data });
                } else {
                    sendResponse({ ok: false, error: result.error || `HTTP ${resp.status}` });
                }
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true; // keep channel open for async
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
