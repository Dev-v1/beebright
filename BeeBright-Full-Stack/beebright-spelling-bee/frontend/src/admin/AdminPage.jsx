import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Gauge,
  ListChecks,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import {
  adminUploadWordPdf,
  deleteAdminWordList,
  getAdminOverview,
  getAdminWordListRequests,
  getAdminWordLists,
  updateAdminWordList,
  updateAdminWordListRequest,
} from "../api.js";

const EMPTY_STATS = {
  saved_user_count: 0,
  custom_list_count: 0,
  published_list_count: 0,
  pending_request_count: 0,
};

export default function AdminPage({ getToken, onBack, onSettings }) {
  const fileRef = useRef(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [lists, setLists] = useState([]);
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadAdminData() {
    const token = await getToken();
    if (!token) throw new Error("Your Clerk session is unavailable.");
    const [overview, wordLists, wordRequests] = await Promise.all([
      getAdminOverview(token),
      getAdminWordLists(token),
      getAdminWordListRequests(token),
    ]);
    setStats(overview);
    setLists(wordLists);
    setRequests(wordRequests);
  }

  useEffect(() => {
    loadAdminData().catch((caught) => setError(caught.message));
  }, []);

  async function run(label, action, success) {
    setBusy(label);
    setNotice("");
    setError("");
    try {
      await action();
      await loadAdminData();
      setNotice(success);
    } catch (caught) {
      setError(caught.message || "The admin action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  function uploadPdf(event) {
    event.preventDefault();
    if (!file) return;
    run("upload", async () => {
      const token = await getToken();
      await adminUploadWordPdf(token, file, title.trim());
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }, "The word list was imported and published for users.");
  }

  function togglePublished(item) {
    run(`list-${item.id}`, async () => {
      const token = await getToken();
      await updateAdminWordList(token, item.id, { published: !item.published });
    }, item.published ? "The word list is now hidden from users." : "The word list is now published.");
  }

  function removeList(item) {
    if (!window.confirm(`Delete “${item.title}” permanently?`)) return;
    run(`list-${item.id}`, async () => {
      const token = await getToken();
      await deleteAdminWordList(token, item.id);
    }, "The custom word list was deleted.");
  }

  function setRequestStatus(item, status) {
    run(`request-${item.id}`, async () => {
      const token = await getToken();
      await updateAdminWordListRequest(token, item.id, status);
    }, `The request was marked ${status}.`);
  }

  return (
    <main className="settings-page admin-page">
      <header className="topbar">
        <button className="brand" onClick={onBack}><span>bee</span>bright</button>
        <button className="outline" onClick={onBack}><ArrowLeft size={15} /> Back to practice</button>
      </header>

      <section className="settings-content with-sidebar">
        <aside className="settings-sidebar">
          <button onClick={onSettings}>Me</button>
          <button className="active"><ShieldCheck size={15} /> Admin</button>
        </aside>

        <div className="settings-main">
          <p className="eyebrow">BEEBRIGHT CONTROL CENTER</p>
          <h1>Admin panel</h1>
          <p className="settings-intro">Publish new practice material, review requests, and manage the shared library.</p>

          {(notice || error) && <div className={`settings-notice ${error ? "error" : ""}`}>{error || notice}</div>}

          <div className="admin-stats">
            <div><Users size={19} /><b>{stats.saved_user_count}</b><span>users with saved progress</span></div>
            <div><ListChecks size={19} /><b>{stats.custom_list_count}</b><span>custom lists</span></div>
            <div><CheckCircle2 size={19} /><b>{stats.published_list_count}</b><span>published lists</span></div>
            <div><Gauge size={19} /><b>{stats.pending_request_count}</b><span>pending requests</span></div>
          </div>

          <article className="admin-section">
            <div className="admin-section-heading"><FileUp size={22} /><div><h2>Import a PDF word list</h2><p>The PDF is parsed once and its words are stored in Neon. The original PDF is not retained.</p></div></div>
            <form className="admin-upload" onSubmit={uploadPdf}>
              <input value={title} maxLength="120" onChange={(event) => setTitle(event.target.value)} placeholder="List title, for example 2025 School Bee" />
              <input ref={fileRef} type="file" accept="application/pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <button className="primary" disabled={Boolean(busy) || !file}><FileUp size={16} /> {busy === "upload" ? "Importing…" : "Import and publish"}</button>
            </form>
          </article>

          <article className="admin-section">
            <div className="admin-section-heading"><ListChecks size={22} /><div><h2>Shared word lists</h2><p>Hide a list without deleting it, or remove it permanently.</p></div></div>
            <div className="admin-list">
              {!lists.length && <p className="empty-state">No custom lists have been imported.</p>}
              {lists.map((item) => (
                <div className="admin-list-row" key={item.id}>
                  <div><strong>{item.title}</strong><span>{item.word_count.toLocaleString()} words · {item.filename}</span></div>
                  <span className={`status-chip ${item.published ? "published" : "hidden"}`}>{item.published ? "Published" : "Hidden"}</span>
                  <button className="outline compact" disabled={Boolean(busy)} onClick={() => togglePublished(item)}>{item.published ? "Hide" : "Publish"}</button>
                  <button className="icon-danger" aria-label={`Delete ${item.title}`} disabled={Boolean(busy)} onClick={() => removeList(item)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </article>

          <article className="admin-section">
            <div className="admin-section-heading"><Users size={22} /><div><h2>User requests</h2><p>Review requests for additional spelling lists and record your decision.</p></div></div>
            <div className="admin-request-list">
              {!requests.length && <p className="empty-state">No users have requested a word list yet.</p>}
              {requests.map((item) => (
                <div className="request-card" key={item.id}>
                  <div className="request-card-top"><strong>{item.title}</strong><span className={`status-chip ${item.status}`}>{item.status}</span></div>
                  <p>{item.details || "No additional details were provided."}</p>
                  <small>Requested {new Date(item.created_at).toLocaleDateString()}</small>
                  <div className="request-actions">
                    <button disabled={Boolean(busy)} onClick={() => setRequestStatus(item, "approved")}>Approve</button>
                    <button disabled={Boolean(busy)} onClick={() => setRequestStatus(item, "declined")}>Decline</button>
                    <button disabled={Boolean(busy)} onClick={() => setRequestStatus(item, "pending")}>Mark pending</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
