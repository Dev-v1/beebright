# Clerk frontend integration

`ClerkApp.jsx` protects the practice site and provides `/sign-in`, `/sign-up`, `/settings`, `/request-word-list`, and `/admin` routes.

`SettingsPage.jsx` uses Clerk's frontend `User` methods for avatar, username, password, account deletion, and logout. It deletes the user's saved Neon progress through Render before deleting the Clerk account.

`/admin` is displayed only after Render confirms that the signed-in Clerk user ID is present in `ADMIN_CLERK_USER_IDS`. Every admin API route performs the same server-side check, so changing frontend code cannot grant administrator access.

Only `VITE_CLERK_PUBLISHABLE_KEY` belongs in Vercel. Never put `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, or `DATABASE_URL` in this frontend folder.
