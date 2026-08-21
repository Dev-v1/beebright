# Clerk frontend integration

`ClerkApp.jsx` protects the practice site and provides `/sign-in`, `/sign-up`, and `/settings` routes.

`SettingsPage.jsx` uses Clerk's frontend `User` methods for avatar, username, password, account deletion, and logout. It deletes the user's saved Neon progress through Render before deleting the Clerk account.

Only `VITE_CLERK_PUBLISHABLE_KEY` belongs in Vercel. Never put `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, or `DATABASE_URL` in this frontend folder.
