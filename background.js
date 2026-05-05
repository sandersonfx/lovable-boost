console.log("[LovableBoost] Service worker iniciado");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Proxy fetch para Lovable API
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { token, projectId, prompt } = msg;
                if (!token || !projectId) {
                    sendResponse({ ok: false, error: "Token ou ProjectId não capturado. Acesse o Lovable.dev primeiro." });
                    return;
                }

                const url = `https://api.lovable.dev/v1/projects/${projectId}/prompt`;
                const resp = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ prompt, stream: false })
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    sendResponse({ ok: false, error: `HTTP ${resp.status}: ${text}` });
                    return;
                }

                const data = await resp.json();
                sendResponse({ ok: true, data });
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
