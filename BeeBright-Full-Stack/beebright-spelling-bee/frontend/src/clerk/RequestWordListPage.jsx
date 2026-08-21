import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Send } from "lucide-react";

import { getMyWordListRequests, submitWordListRequest } from "../api.js";

export default function RequestWordListPage({ getToken, onBack }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadRequests() {
    const token = await getToken();
    if (token) setRequests(await getMyWordListRequests(token));
  }

  useEffect(() => {
    loadRequests().catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const token = await getToken();
      await submitWordListRequest(token, { title: title.trim(), details: details.trim() });
      setTitle("");
      setDetails("");
      setNotice("Your request was sent to the BeeBright administrator.");
      await loadRequests();
    } catch (caught) {
      setError(caught.message || "Your request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="settings-page request-page">
      <header className="topbar">
        <button className="brand" onClick={onBack}><span>bee</span>bright</button>
        <button className="outline" onClick={onBack}><ArrowLeft size={15} /> Back to practice</button>
      </header>
      <section className="request-content">
        <p className="eyebrow">EXPAND THE PRACTICE LIBRARY</p>
        <h1>Request a word list</h1>
        <p className="settings-intro">Tell the administrator which spelling list you would like added. Only the administrator can upload and publish PDFs.</p>
        {(notice || error) && <div className={`settings-notice ${error ? "error" : ""}`}>{error || notice}</div>}

        <div className="request-layout">
          <form className="request-form" onSubmit={submit}>
            <div className="settings-icon"><ClipboardList size={19} /></div>
            <h2>New request</h2>
            <label>Word-list name<input value={title} minLength="2" maxLength="120" required onChange={(event) => setTitle(event.target.value)} placeholder="For example, 2025 classroom list" /></label>
            <label>Details<textarea value={details} maxLength="1000" onChange={(event) => setDetails(event.target.value)} placeholder="Tell the administrator where the list comes from or which level you need." /></label>
            <button className="primary" disabled={busy}><Send size={15} /> {busy ? "Sending…" : "Send request"}</button>
          </form>

          <aside className="request-history">
            <h2>Your requests</h2>
            {!requests.length && <p className="empty-state">You have not submitted any requests.</p>}
            {requests.map((item) => <div key={item.id}><strong>{item.title}</strong><span className={`status-chip ${item.status}`}>{item.status}</span><p>{item.details}</p></div>)}
          </aside>
        </div>
      </section>
    </main>
  );
}
