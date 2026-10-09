import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Moon, Sun, Trash2 } from 'lucide-react';
import App from './App.jsx';
import { desktopSettings } from './local-api.js';
import { deleteSavedProgress } from './api.js';
import './styles.css';

const getLocalToken = async () => 'local-device';
function LocalApp() {
  const [settings, setSettings] = useState(false);
  const [profileId, setProfileId] = useState('default');
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [startupError, setStartupError] = useState('');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    desktopSettings().then((value) => { setTheme(value.theme || 'light'); setProfileId(value.profileId || 'default'); setReady(true); })
      .catch((error) => setStartupError(error.message || 'Could not connect to local practice.'));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  async function changeTheme(value) {
    setTheme(value);
    await desktopSettings({ theme: value });
  }
  async function clearProgress() {
    if (!window.confirm('Clear the saved practice on this laptop?')) return;
    await deleteSavedProgress('local-device');
    localStorage.removeItem('beebright-session-v2:local-device:' + profileId);
    setGeneration((value) => value + 1);
    setNotice('Your local practice was cleared.');
  }
  if (!ready) return <main className="configuration-page"><div><span className="bee-mark">🐝</span><h1>{startupError ? "Could not open your spelling studio" : "Opening your spelling studio…"}</h1>{startupError && <><p role="alert">{startupError}</p><p>Close BeeBright, run beebright update in your terminal, then open it again.</p><button className="primary" onClick={() => window.location.reload()}>Try again</button></>}</div></main>;
  return <>
    <div hidden={settings}><App key={generation} userId={"local-device:" + profileId} getToken={getLocalToken} isAdmin={false} localMode inactive={settings} onOpenSettings={() => setSettings(true)} /></div>
    {settings && <main className="settings-page">
      <header className="topbar"><button className="brand" onClick={() => setSettings(false)}><span>bee</span>bright</button><button className="outline" onClick={() => setSettings(false)}><ArrowLeft size={15} /> Back to practice</button></header>
      <section className="settings-content"><div className="settings-main"><p className="eyebrow">APPEARANCE & LOCAL PRACTICE</p><h1>Settings</h1><p className="settings-intro">Choose how your spelling studio looks. Progress stays on this laptop.</p>
        {notice && <div className="settings-notice">{notice}</div>}
        <div className="settings-grid">
          <article className="settings-card"><div className="settings-icon"><Sun size={19} /></div><div><h2>Appearance</h2><p>Switch between light and dark mode.</p></div><div className="theme-switch" role="group" aria-label="App theme"><button className={theme === 'light' ? 'selected' : ''} onClick={() => changeTheme('light')}><Sun size={16} /> Light</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => changeTheme('dark')}><Moon size={16} /> Dark</button></div></article>
          <article className="settings-card danger-card"><div className="settings-icon"><Trash2 size={19} /></div><div><h2>Saved practice</h2><p>Clear your saved session on this laptop.</p></div><button className="danger-button" onClick={clearProgress}><Trash2 size={15} /> Clear saved practice</button></article>
        </div>
      </div></section>
    </main>}
  </>;
}
createRoot(document.getElementById('root')).render(<LocalApp />);
