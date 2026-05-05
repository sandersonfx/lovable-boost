console.log("[LovableBoost] Service worker iniciado");

let cachedTemplate = null; // { url, method, bodyKeys } da última chamada de chat

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
        console.log("[LovableBoost] Template salvo:", cachedTemplate);
        sendResponse({ ok: true });
        return false;
    }

    // Proxy fetch (genérico — uploads, etc)
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

    // Chamada pro Lovable — usando o mesmo template que a UI normal usa
    if (msg.action === "lovablePrompt") {
        (async () => {
            try {
                const { token, projectId, prompt, chatTemplate } = msg;
                if (!token || !projectId) {
                    sendResponse({ ok: false, error: "Token não capturado. Acesse o Lovable.dev primeiro." });
                    return;
                }

                // Usa o template capturado pelo pageHook (da chamada real do Lovable)
                const tmpl = chatTemplate || cachedTemplate;
                if (!tmpl || !tmpl.url) {
                    sendResponse({ ok: false, error: "Template não capturado. Mande UMA mensagem no chat normal do Lovable primeiro (abre o chat e digita qualquer coisa). Depois volta e usa o painel." });
                    return;
                }

                // Substitui as variáveis no template
                let url = tmpl.url;
                if (url.includes(':projectId')) url = url.replace(':projectId', projectId);
                // Se o template tiver o projectId real, mantém

                let body = tmpl.bodyTemplate || '{}';
                try {
                    const parsed = JSON.parse(body);
                    // Tenta substituir a mensagem mantendo a estrutura original
                    if (parsed.message !== undefined) parsed.message = prompt;
                    else if (parsed.prompt !== undefined) parsed.prompt = prompt;
                    else if (parsed.content !== undefined) parsed.content = prompt;
                    else parsed.mensagem = prompt;
                    body = JSON.stringify(parsed);
                } catch {
                    body = JSON.stringify({ message: prompt });
                }

                console.log("[LovableBoost] Enviando:", tmpl.method, url);
                console.log("[LovableBoost] Body:", body.substring(0, 200));

                const resp = await fetch(url, {
                    method: tmpl.method || "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: body
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    sendResponse({ ok: false, error: `HTTP ${resp.status}: ${text.substring(0, 300)}` });
                    return;
                }

                const data = await resp.json();
                console.log("[LovableBoost] ✅ Resposta recebida");
                sendResponse({ ok: true, data, endpoint: url });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }
});
