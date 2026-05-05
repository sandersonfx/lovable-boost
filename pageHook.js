(function() {
    'use strict';
    console.log("[LovableBoost] Hook ativo — capturando chamadas da API");
    let capturedToken = null;
    let capturedProjectId = null;

    // Armazena o template da última chamada de chat
    let lastChatCall = null; // { url, method, headers, bodyTemplate }

    function extractProjectId(url) {
        try {
            const m = String(url).match(/projects\/([0-9a-fA-F-]{36})/i);
            return m ? m[1] : null;
        } catch { return null; }
    }

    function isChatCall(url, body) {
        // Detecta chamadas de chat/mensagem
        const chatPatterns = [/\/chat/, /\/message/, /\/prompt/, /\/completions/, /\/command/];
        if (!url) return false;
        return chatPatterns.some(p => p.test(url));
    }

    function bodyToString(body) {
        if (!body) return null;
        if (typeof body === 'string') return body;
        try { return JSON.stringify(body); } catch { return null; }
    }

    function notify(token, projectId, apiUrl, method, body) {
        const cleanToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '').trim() : null;
        const pid = projectId || extractProjectId(window.location.href);
        if (cleanToken) capturedToken = cleanToken;
        if (pid) capturedProjectId = pid;

        // Captura template da chamada de chat
        if (apiUrl && method === 'POST' && isChatCall(apiUrl, body)) {
            const bodyStr = bodyToString(body);
            lastChatCall = { url: apiUrl, method, bodyTemplate: bodyStr };
            console.log('%c[LovableBoost] ✅ Template de chamada capturado!', 'color:#34d399;font-weight:bold');
            console.log('[LovableBoost]   URL:', method, apiUrl);
            console.log('[LovableBoost]   Body:', bodyStr ? bodyStr.substring(0, 200) : 'null');
            
            window.postMessage({
                type: "lovableChatTemplate",
                url: apiUrl,
                method: method,
                bodyTemplate: bodyStr
            }, "*");
        }

        if (capturedToken) {
            window.postMessage({ 
                type: "lovableTokenFound", 
                token: capturedToken, 
                projectId: capturedProjectId
            }, "*");
        }
    }

    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        let opts = args[1] || {};
        let headers = opts.headers || {};
        let body = opts.body || null;
        let method = opts.method || 'GET';
        if (args[0] instanceof Request) {
            url = args[0].url;
            headers = args[0].headers;
            method = args[0].method;
        }
        let auth = null;
        if (headers instanceof Headers) auth = headers.get('Authorization');
        else if (typeof headers === 'object') auth = headers.Authorization || headers.authorization;
        if (auth && auth.startsWith('Bearer ')) notify(auth, extractProjectId(url), url, method, body);
        return origFetch.apply(this, args);
    };

    // Intercept XHR
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._lovableUrl = url;
        this._lovableMethod = method;
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (name?.toLowerCase() === 'authorization' && value?.startsWith('Bearer ')) {
            notify(value, extractProjectId(this._lovableUrl), this._lovableUrl, this._lovableMethod, null);
        }
        return origSetHeader.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._lovableUrl && (this._lovableUrl.includes('chat') || this._lovableUrl.includes('message') || this._lovableUrl.includes('prompt'))) {
            const auth = capturedToken;
            if (auth) notify(auth, extractProjectId(this._lovableUrl), this._lovableUrl, this._lovableMethod, body);
        }
        return origSend.call(this, body);
    };

    setInterval(() => {
        if (capturedToken) notify(capturedToken, null, null, null, null);
    }, 2000);
})();
