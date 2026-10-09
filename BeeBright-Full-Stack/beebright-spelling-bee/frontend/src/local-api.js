// Offline bridge for the native window or the loopback browser server.
let bridge;
function desktopBridge() {
  if (!bridge) bridge = new Promise((resolve, reject) => {
    const token = document.querySelector('meta[name="beebright-local-web"]')?.content;
    if (token) {
      const call = async (operation, payload) => {
        const response = await fetch('/__beebright/bridge', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BeeBright-Token': token },
          body: JSON.stringify({ operation, ...payload }), cache: 'no-store',
          signal: AbortSignal.timeout(operation === 'speak' ? 65000 : 15000),
        });
        const result = await response.json();
        if (!response.ok || result?.error) throw new Error(result.error || 'Local request failed.');
        return result;
      };
      resolve({
        request: (path, method, payload) => call('request', { path, method, payload }),
        settings: (value) => call('settings', { value }),
        speak: (word) => call('speak', { word }),
      });
    } else if (window.pywebview?.api) resolve(window.pywebview.api);
    else {
      const timeout = window.setTimeout(() => reject(new Error('The local practice bridge did not start. Close BeeBright and run beebright update.')), 10000);
      window.addEventListener('pywebviewready', () => { window.clearTimeout(timeout); resolve(window.pywebview.api); }, { once: true });
    }
  });
  return bridge;
}
export async function desktopRequest(path, options = {}) {
  const api = await desktopBridge();
  const result = await api.request(path, options.method || 'GET', options.body ? JSON.parse(options.body) : null);
  if (result?.error) throw new Error(result.error);
  return result;
}
export async function desktopSpeak(word) {
  const api = await desktopBridge();
  return api.speak(word);
}
export async function desktopSettings(value) {
  const api = await desktopBridge();
  return api.settings(value || null);
}
