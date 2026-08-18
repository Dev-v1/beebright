// This is the one place the frontend reads your Render backend URL.
// In Vercel, create an environment variable named VITE_API_BASE_URL.
// Example: https://your-beebright-api.onrender.com
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

export function getLevels() {
  return request("/api/levels");
}

export function getPracticeSet(level, offset = 0, randomize = false) {
  const query = new URLSearchParams({
    level,
    offset: String(offset),
    limit: "100",
    randomize: String(randomize),
  });
  return request(`/api/practice?${query}`);
}

export function getDictionary(word) {
  return request(`/api/dictionary/${encodeURIComponent(word)}`);
}

export function uploadWordPdf(file) {
  const body = new FormData();
  body.append("file", file);
  return request("/api/import-pdf", { method: "POST", body });
}

