import { useEffect, useState } from "react";
import { ClerkLoaded, ClerkLoading, SignIn, SignUp, useAuth } from "@clerk/react";

import App from "../App.jsx";
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  if (!isLoaded) return <main className="auth-loading">Preparing your spelling studio…</main>;

  if (!isSignedIn) {
    const signingUp = path.startsWith("/sign-up");
    return (
      <main className="auth-page">
        <button className="brand auth-brand" onClick={() => navigate("/sign-in")}><span>bee</span>bright</button>
        <div className="auth-copy">
          <span className="bee-mark">🐝</span>
          <p className="eyebrow">YOUR PERSONAL SPELLING STUDIO</p>
          <h1>{signingUp ? "Create your practice account." : "Welcome back, speller."}</h1>
          <p>Your place, score, and streak are saved securely so you can continue later.</p>
        </div>
        <div className="clerk-card">
          {signingUp ? (
            <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/" />
          ) : (
            <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
          )}
        </div>
      </main>
    );
  }

  if (path === "/settings") {
    return <SettingsPage theme={theme} setTheme={setTheme} getToken={getToken} onBack={() => navigate("/")} />;
  }

  if (path !== "/") window.history.replaceState({}, "", "/");

  return (
    <App
      userId={userId}
      getToken={getToken}
      theme={theme}
      onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
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
