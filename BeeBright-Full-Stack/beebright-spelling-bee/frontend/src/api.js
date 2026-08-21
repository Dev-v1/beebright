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
  if (response.status === 204) return null;
  return response.json();
}

function authorizedOptions(token, options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

export function getLevels() {
  return request("/api/levels");
}

export function getAccess(token) {
  return request("/api/access", authorizedOptions(token));
}

export function getWordLists() {
  return request("/api/word-lists");
}

export function getPracticeSet(level, offset = 0, randomize = false, wordListId = "champions-2024") {
  const query = new URLSearchParams({
    word_list_id: wordListId,
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

export function adminUploadWordPdf(token, file, title) {
  const body = new FormData();
  body.append("title", title);
  body.append("file", file);
  return request("/api/admin/word-lists/import", authorizedOptions(token, { method: "POST", body }));
}

export function getAdminOverview(token) {
  return request("/api/admin/overview", authorizedOptions(token));
}

export function getAdminWordLists(token) {
  return request("/api/admin/word-lists", authorizedOptions(token));
}

export function updateAdminWordList(token, wordListId, changes) {
  return request(`/api/admin/word-lists/${encodeURIComponent(wordListId)}`, authorizedOptions(token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }));
}

export function deleteAdminWordList(token, wordListId) {
  return request(`/api/admin/word-lists/${encodeURIComponent(wordListId)}`, authorizedOptions(token, {
    method: "DELETE",
  }));
}

export function submitWordListRequest(token, payload) {
  return request("/api/word-list-requests", authorizedOptions(token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export function getMyWordListRequests(token) {
  return request("/api/word-list-requests/mine", authorizedOptions(token));
}

export function getAdminWordListRequests(token) {
  return request("/api/admin/word-list-requests", authorizedOptions(token));
}

export function updateAdminWordListRequest(token, requestId, status) {
  return request(`/api/admin/word-list-requests/${encodeURIComponent(requestId)}`, authorizedOptions(token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }));
}

export function getSavedProgress(token) {
  return request("/api/progress", authorizedOptions(token));
}

export function saveProgress(token, session) {
  return request("/api/progress", authorizedOptions(token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session }),
  }));
}

export function deleteSavedProgress(token) {
  return request("/api/progress", authorizedOptions(token, { method: "DELETE" }));
}
