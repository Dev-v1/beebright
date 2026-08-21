import { useRef, useState } from "react";
import { useClerk, useReverification, useUser } from "@clerk/react";
import {
  ArrowLeft,
  Camera,
  KeyRound,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";

import { deleteSavedProgress } from "../api.js";

function clerkError(error) {
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || "That change could not be saved.";
}

export default function SettingsPage({ theme, setTheme, getToken, isAdmin, onAdmin, onBack }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const avatarRef = useRef(null);
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const updatePassword = useReverification((details) => user.updatePassword(details));
  const deleteAccount = useReverification(() => user.delete());

  async function run(label, action, success) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
      return true;
    } catch (caught) {
      setError(clerkError(caught));
      return false;
    } finally {
      setBusy("");
    }
  }

  function changeAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    run("avatar", () => user.setProfileImage({ file }), "Your avatar was updated.");
    event.target.value = "";
  }

  function saveUsername(event) {
    event.preventDefault();
    run("username", () => user.update({ username: username.trim() }), "Your username was updated.");
  }

  async function savePassword(event) {
    event.preventDefault();
    const updated = await run(
      "password",
      () => updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true }),
      "Your password was updated.",
    );
    if (updated) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  async function confirmDelete() {
    if (!window.confirm("Delete your BeeBright account and saved practice data permanently?")) return;
    await run("delete", async () => {
      const token = await getToken();
      if (token) await deleteSavedProgress(token);
      await deleteAccount();
      await signOut({ redirectUrl: "/sign-in" });
    });
  }

  return (
    <main className="settings-page">
      <header className="topbar">
        <button className="brand" onClick={onBack}><span>bee</span>bright</button>
        <button className="outline" onClick={onBack}><ArrowLeft size={15} /> Back to practice</button>
      </header>

      <section className={`settings-content ${isAdmin ? "with-sidebar" : ""}`}>
        {isAdmin && <aside className="settings-sidebar"><button className="active">Me</button><button onClick={onAdmin}><ShieldCheck size={15} /> Admin</button></aside>}
        <div className="settings-main">
          <p className="eyebrow">ACCOUNT & APPEARANCE</p>
          <h1>Settings</h1>
          <p className="settings-intro">Update your BeeBright account and choose how your spelling studio looks.</p>

          {(notice || error) && <div className={`settings-notice ${error ? "error" : ""}`}>{error || notice}</div>}

          <div className="settings-grid">
          <article className="settings-card avatar-card">
            <div className="settings-icon"><Camera size={19} /></div>
            <div><h2>Avatar</h2><p>Choose the picture shown with your account.</p></div>
            <img src={user?.imageUrl} alt="Your current avatar" />
            <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={changeAvatar} hidden />
            <button className="outline" disabled={Boolean(busy)} onClick={() => avatarRef.current?.click()}>{busy === "avatar" ? "Uploading…" : "Change avatar"}</button>
          </article>

          <article className="settings-card">
            <div className="settings-icon"><Sun size={19} /></div>
            <div><h2>Appearance</h2><p>Switch between light and dark mode.</p></div>
            <div className="theme-switch" role="group" aria-label="Website theme">
              <button className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}><Sun size={16} /> Light</button>
              <button className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}><Moon size={16} /> Dark</button>
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-icon"><UserRound size={19} /></div>
            <div><h2>Username</h2><p>Change the name attached to your account.</p></div>
            <form onSubmit={saveUsername}>
              <input value={username} minLength="4" maxLength="64" onChange={(event) => setUsername(event.target.value)} placeholder="Your username" required />
              <button className="primary" disabled={Boolean(busy)}><Save size={15} /> {busy === "username" ? "Saving…" : "Save username"}</button>
            </form>
          </article>

          <article className="settings-card">
            <div className="settings-icon"><KeyRound size={19} /></div>
            <div><h2>Password</h2><p>Use at least eight characters for your new password.</p></div>
            {user?.passwordEnabled ? (
              <form onSubmit={savePassword}>
                <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" required />
                <input type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" required />
                <button className="primary" disabled={Boolean(busy)}><KeyRound size={15} /> {busy === "password" ? "Updating…" : "Update password"}</button>
              </form>
            ) : <p className="settings-help">This account uses a social sign-in. Manage its password with that provider.</p>}
          </article>

          <article className="settings-card">
            <div className="settings-icon"><LogOut size={19} /></div>
            <div><h2>Log out</h2><p>Your progress is saved before you leave.</p></div>
            <button className="outline" onClick={() => signOut({ redirectUrl: "/sign-in" })}><LogOut size={15} /> Log out</button>
          </article>

          <article className="settings-card danger-card">
            <div className="settings-icon"><Trash2 size={19} /></div>
            <div><h2>Delete account</h2><p>Permanently removes your Clerk account and saved Neon progress.</p></div>
            <button className="danger-button" disabled={Boolean(busy)} onClick={confirmDelete}><Trash2 size={15} /> {busy === "delete" ? "Deleting…" : "Delete account"}</button>
          </article>
          </div>
        </div>
      </section>
    </main>
  );
}
