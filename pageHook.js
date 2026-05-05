(function() {
    'use strict';
    console.log("[LovableBoost] Hook ativo");
    let capturedToken = null;
    let capturedProjectId = null;
    let capturedEndpoints = [];

    function extractProjectId(url) {
        try {
            const m = String(url).match(/projects\/([0-9a-fA-F-]{36})/i);
            return m ? m[1] : null;
        } catch { return null; }
    }

    function notify(token, projectId, apiUrl, method, body) {
        const cleanToken = typeof token === 'string' ? token.replace(/^Bearer\s+/i, '').trim() : null;
        const pid = projectId || extractProjectId(window.location.href);
        if (cleanToken) capturedToken = cleanToken;
        if (pid) capturedProjectId = pid;

        // 🔍 Captura endpoints da API do Lovable
        if (apiUrl && (apiUrl.includes('api.lovable') || apiUrl.includes('/api/') || apiUrl.includes('/v1/'))) {
            const key = method + ' ' + apiUrl.replace(/\?.*$/, '').replace(/\/\d+/g, '/:id').replace(/projects\/[^/]+/g, 'projects/:projectId');
            if (!capturedEndpoints.includes(key)) {
                capturedEndpoints.push(key);
                console.log('%c[LovableBoost] 🔍 Endpoint detectado: %c' + method + ' ' + apiUrl, 'color:#f97316;font-weight:bold', 'color:#f97316');
            }
        }

        if (capturedToken) {
            window.postMessage({ 
                type: "lovableTokenFound", 
                token: capturedToken, 
                projectId: capturedProjectId,
                endpoints: capturedEndpoints
            }, "*");
        }
    }

    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = function(...args) {
        let url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        let headers = args[1]?.headers || {};
        let body = null;
        if (args[0] instanceof Request) {
            url = args[0].url;
            headers = args[0].headers;
        }
        if (args[1]?.body) body = args[1].body;
        let auth = null;
        if (headers instanceof Headers) auth = headers.get('Authorization');
        else if (typeof headers === 'object') auth = headers.Authorization || headers.authorization;
        if (auth && auth.startsWith('Bearer ')) notify(auth, extractProjectId(url), url, args[1]?.method || 'GET', body);
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
        return origSend.call(this, body);
    };

    // Poll também pra pegar projectId da URL
    setInterval(() => {
        if (capturedToken) notify(capturedToken, null, null, null, null);
    }, 2000);
})();
