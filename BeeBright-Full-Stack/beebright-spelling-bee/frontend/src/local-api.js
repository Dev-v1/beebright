// Desktop bridge only. No Clerk, Render, Neon, or remote fetch calls.
let bridge;
function desktopBridge() {
  if (!bridge) bridge = new Promise((resolve) => {
    if (window.pywebview?.api) resolve(window.pywebview.api);
    else window.addEventListener('pywebviewready', () => resolve(window.pywebview.api), { once: true });
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
