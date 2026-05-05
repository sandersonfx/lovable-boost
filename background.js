/**
 * Lovable Boost — Service Worker
 *
 * Serviço minimalista para:
 * - proxyFetch: chamadas CORS-safe para APIs externas
 * - sidePanel: abrir/fechar painel lateral
 * - Clique no ícone da extensão → abre sidepanel
 */

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Abre o sidepanel quando a extensão é instalada
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,
    path: 'sidepanel.html'
  });
});

// Handler de mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'proxyFetch':
      handleProxyFetch(message, sendResponse);
      return true; // keep channel open for async

    case 'openSidePanel':
      chrome.sidePanel.open({ tabId: sender.tab?.id });
      sendResponse({ ok: true });
      break;

    case 'closeSidePanel':
      // sidePanel não tem close API nativa no Chrome
      sendResponse({ ok: false, reason: 'sidePanel close via UI only' });
      break;

    default:
      sendResponse({ ok: false, reason: 'unknown action' });
  }
});

/**
 * Faz proxy de uma requisição HTTP para contornar CORS
 */
async function handleProxyFetch(message, sendResponse) {
  try {
    const { url, options } = message;
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers || {},
      body: options?.body || undefined
    });

    const text = await response.text();
    sendResponse({ ok: true, status: response.status, data: text });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}
