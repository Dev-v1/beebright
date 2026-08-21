import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";

import ClerkApp from "./clerk/ClerkApp.jsx";
import "./styles.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingClerkConfiguration() {
  return (
    <main className="configuration-page">
      <div>
        <span className="bee-mark">🐝</span>
        <h1>BeeBright needs its Clerk key.</h1>
        <p>Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> in Vercel, then redeploy the frontend.</p>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
        afterSignOutUrl="/sign-in"
      >
        <ClerkApp />
      </ClerkProvider>
    ) : (
      <MissingClerkConfiguration />
    )}
  </StrictMode>,
);
