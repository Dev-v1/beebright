import { useEffect, useState } from "react";
import { ClerkLoaded, ClerkLoading, SignIn, SignUp, useAuth } from "@clerk/react";

import App from "../App.jsx";
import AdminPage from "../admin/AdminPage.jsx";
import { getAccess } from "../api.js";
import RequestWordListPage from "./RequestWordListPage.jsx";
import SettingsPage from "./SettingsPage.jsx";

const THEME_KEY = "beebright-theme-v1";

function useBrowserPath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath) {
    if (window.location.pathname !== nextPath) window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return [path, navigate];
}

function RoutedApp() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [path, navigate] = useBrowserPath();
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLoaded, setAccessLoaded] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsAdmin(false);
      setAccessLoaded(Boolean(isLoaded));
      return;
    }
    let cancelled = false;
    setAccessLoaded(false);
    getToken()
      .then((token) => token && getAccess(token))
      .then((result) => {
        if (!cancelled) setIsAdmin(Boolean(result?.is_admin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setAccessLoaded(true);
      });
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn, userId]);

  if (!isLoaded) return <main className="auth-loading">Preparing your spelling studio…</main>;

  if (!isSignedIn) {
    // The public BeeBright URL is the sign-up entry point. Clerk restores an
    // existing session before this branch runs, so returning users still go
    // directly to their practice dashboard without seeing an auth form.
    const signingUp = path === "/" || path.startsWith("/sign-up");
    return (
      <main className="auth-page">
        <button className="brand auth-brand" onClick={() => navigate("/")}><span>bee</span>bright</button>
        <div className="auth-copy">
          <span className="bee-mark">🐝</span>
          <p className="eyebrow">YOUR PERSONAL SPELLING STUDIO</p>
          <h1>{signingUp ? "Create your practice account." : "Welcome back, speller."}</h1>
          <p>Your place, score, and streak are saved securely so you can continue later.</p>
        </div>
        <div className="clerk-card">
          {signingUp ? (
            <SignUp routing="virtual" signInUrl="/sign-in" fallbackRedirectUrl="/" />
          ) : (
            <SignIn routing="virtual" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
          )}
        </div>
      </main>
    );
  }

  if (path === "/settings") {
    return <SettingsPage theme={theme} setTheme={setTheme} getToken={getToken} isAdmin={isAdmin} onAdmin={() => navigate("/admin")} onBack={() => navigate("/")} />;
  }

  if (path === "/request-word-list") {
    return <RequestWordListPage getToken={getToken} onBack={() => navigate("/")} />;
  }

  if (path === "/admin") {
    if (!accessLoaded) return <main className="auth-loading">Checking administrator access…</main>;
    if (!isAdmin) {
      return <main className="configuration-page"><div><h1>Administrator access required.</h1><p>This area is only available to the configured BeeBright administrator.</p><button className="primary" onClick={() => navigate("/")}>Back to BeeBright</button></div></main>;
    }
    return <AdminPage getToken={getToken} onBack={() => navigate("/")} onSettings={() => navigate("/settings")} />;
  }

  if (path !== "/") window.history.replaceState({}, "", "/");

  return (
    <App
      userId={userId}
      getToken={getToken}
      theme={theme}
      isAdmin={isAdmin}
      onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      onRequestList={() => navigate("/request-word-list")}
      onOpenSettings={() => navigate("/settings")}
    />
  );
}

export default function ClerkApp() {
  return (
    <>
      <ClerkLoading><main className="auth-loading">Loading BeeBright…</main></ClerkLoading>
      <ClerkLoaded><RoutedApp /></ClerkLoaded>
    </>
  );
}
