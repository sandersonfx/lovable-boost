(function() {
    'use strict';
    console.log("[LovableBoost] Hook ativo");
    let capturedToken = null;
    let capturedProjectId = null;

    function extractProjectId(url) {
        try {
            const m = String(url).match(/projects\/([0-9a-fA-F-]{36})/i);
            return m ? m[1] : null;
        } catch { return null; }
    }

    function notify(token, projectId) {
        const cleanToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '').trim() : null;
        const pid = projectId || extractProjectId(window.location.href);
        if (cleanToken) capturedToken = cleanToken;
        if (pid) capturedProjectId = pid;
        if (capturedToken) {
            window.postMessage({ type: "lovableTokenFound", token: capturedToken, projectId: capturedProjectId }, "*");
        }
    }

    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        let headers = args[1]?.headers || {};
        if (args[0] instanceof Request) {
            url = args[0].url;
            headers = args[0].headers;
        }
        let auth = null;
        if (headers instanceof Headers) auth = headers.get('Authorization');
        else if (typeof headers === 'object') auth = headers.Authorization || headers.authorization;
        if (auth && auth.startsWith('Bearer ')) notify(auth, extractProjectId(url));
        return origFetch.apply(this, args);
    };

    // Intercept XHR
    const origOpen = XMLHttpRequest.prototype.open;
    const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._lovableUrl = url;
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (name?.toLowerCase() === 'authorization' && value?.startsWith('Bearer ')) {
            notify(value, extractProjectId(this._lovableUrl));
        }
        return origSetHeader.apply(this, arguments);
    };

    // Poll também pra pegar projectId da URL
    setInterval(() => {
        if (capturedToken) notify(capturedToken, null);
    }, 2000);
})();
