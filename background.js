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

    // ── Prompt pro Lovable (background = sem CORS) ──────────────────
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { url, body, token } = msg;
                if (!url || !body || !token) {
                    sendResponse({ ok: false, error: "Dados incompletos" });
                    return;
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
                    body
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    console.log("[LovableBoost] ❌", resp.status, text.substring(0, 200));
                    sendResponse({ ok: false, error: `HTTP ${resp.status}: ${text.substring(0, 300)}` });
                    return;
                }

                const data = await resp.json();
                console.log("[LovableBoost] ✅ OK");
                sendResponse({ ok: true, data });
            } catch (err) {
                console.log("[LovableBoost] ❌", err.message);
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }
});
