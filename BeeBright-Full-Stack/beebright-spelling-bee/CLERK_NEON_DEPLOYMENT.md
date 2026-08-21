# BeeBright deployment guide: Clerk + Neon + Render + Vercel

This guide uses the existing production URLs:

```text
Frontend: https://beebright.vercel.app
Backend:  https://beebright-api.onrender.com
```

The finished request flow is:

```text
Browser on Vercel
  -> Clerk signs the user in and issues a short-lived session token
  -> Render verifies the Clerk token with CLERK_JWT_KEY
  -> Render reads/writes that user's progress in Neon Postgres
```

The browser never receives the Neon password, Clerk JWT verification key, or Merriam-Webster key.

## 1. Push these updated files to GitHub

Your repository is `https://github.com/Dev-v1/beebright` and the deployed app is nested inside it. Run these commands from the repository root, not from the frontend folder:

```bash
git status
git add BeeBright-Full-Stack/beebright-spelling-bee
git commit -m "Add Clerk accounts Neon progress and spelling distractors"
git push origin main
```

Before committing, confirm that no `.env` file appears in `git status`. Only `.env.example` files should be committed.

## 2. Create the free Neon database

1. Open `https://console.neon.tech` and create an account.
2. Select **New project**.
3. Name it `beebright`.
4. Choose a region close to your Render service.
5. Open the project and select **Connect**.
6. Enable **Connection pooling**. The host should contain `-pooler`.
7. Copy the complete Postgres connection string. It resembles:

```text
postgresql://USER:PASSWORD@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Do not put this value in Vercel or GitHub. The FastAPI startup code automatically creates the `practice_progress` table, so you do not need to run SQL manually.

Neon's current Free plan includes 0.5 GB storage. BeeBright stores one compact JSON progress record per Clerk user, so this design leaves substantial room for a practice site.

## 3. Create and configure Clerk

1. Open `https://dashboard.clerk.com` and select **Create application**.
2. Name the application `BeeBright`.
3. Enable **Email address** and **Password** sign-in.
4. Create the application.
5. Open **User & authentication** in the Clerk dashboard.
6. Enable **Username** in the user model.
7. Allow users to change their username.
8. Enable **Allow users to delete their account**.
9. Save the changes.

### Copy the three Clerk values

Open **API keys** in the same Clerk instance.

1. Copy the **Publishable key**. It begins with `pk_test_` for a development instance or `pk_live_` for a production instance.
2. Select **Show JWT public key**, choose **PEM Public Key**, and copy the complete value, including:

```text
-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
```

3. Copy the Clerk **Frontend API URL**. In a development instance it resembles:

```text
https://verb-noun-12.clerk.accounts.dev
```

That Frontend API URL becomes `CLERK_ISSUER_URL` on Render.

All three values must come from the same Clerk instance. Mixing a development publishable key with a production JWT key will cause `401` errors.

### Development versus production Clerk instances

For an immediate test on `beebright.vercel.app`, you can use the development instance and its `pk_test_` key. Clerk documents that development instances are capped at 100 users.

For a public production launch, activate Clerk's Production environment. Clerk requires an associated production domain. If Clerk does not allow the shared `vercel.app` provider domain for the feature you select, connect a domain you own to Vercel, add it to Clerk, and change Render's `FRONTEND_URL` to that final domain. Clerk's current Hobby tier is free for up to 50,000 monthly retained users.

## 4. Update the Render backend

Open Render, select `beebright-api`, and open **Environment**.

Add or update these exact variables:

```text
FRONTEND_URL=https://beebright.vercel.app
DATABASE_URL=YOUR_NEON_POOLED_CONNECTION_STRING
CLERK_ISSUER_URL=YOUR_CLERK_FRONTEND_API_URL
CLERK_JWT_KEY=YOUR_COMPLETE_PEM_PUBLIC_KEY
MERRIAM_WEBSTER_API_KEY=YOUR_MERRIAM_WEBSTER_KEY
```

Important rules:

- Do not add a trailing slash to `FRONTEND_URL` or `CLERK_ISSUER_URL`.
- Paste `CLERK_JWT_KEY` as a multiline value when Render allows it. The code also accepts literal `\n` characters.
- Use the pooled Neon connection string containing `-pooler` and `sslmode=require`.
- Do not add `VITE_CLERK_PUBLISHABLE_KEY` to Render.
- No `CLERK_SECRET_KEY` is required by this implementation.

Confirm Render's service settings:

```text
Root Directory: BeeBright-Full-Stack/beebright-spelling-bee/backend
Build Command:  pip install -r requirements.txt
Start Command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check:   /api/health
```

Select **Save Changes** and wait for a successful deployment. Then open:

```text
https://beebright-api.onrender.com/api/health
```

The JSON should include:

```json
{
  "status": "ok",
  "clerk_configured": true,
  "database_configured": true
}
```

The first start also creates the Neon table.

## 5. Update the Vercel frontend

Open the Vercel project `beebright`, then open **Settings -> Environment Variables**.

Add or update:

```text
VITE_API_BASE_URL=https://beebright-api.onrender.com
VITE_CLERK_PUBLISHABLE_KEY=YOUR_CLERK_PUBLISHABLE_KEY
```

These are browser-safe public configuration values. Do not add `DATABASE_URL`, `CLERK_JWT_KEY`, `CLERK_SECRET_KEY`, or `MERRIAM_WEBSTER_API_KEY` to Vercel.

Confirm Vercel's project settings:

```text
Framework Preset: Vite
Root Directory: BeeBright-Full-Stack/beebright-spelling-bee/frontend
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Apply both variables to **Production**. Apply them to **Preview** only if the preview origin is also intentionally allowed by Render and Clerk.

Vite inserts environment variables during the build. After adding or changing a `VITE_` variable, open **Deployments**, select the newest deployment, and choose **Redeploy**. Updating the variable without redeploying is not enough.

The included `vercel.json` rewrites all routes to `index.html`, so these direct links work after deployment:

```text
https://beebright.vercel.app/sign-in
https://beebright.vercel.app/sign-up
https://beebright.vercel.app/settings
```

## 6. Complete end-to-end test

Use an incognito/private browser window for a clean test.

1. Open `https://beebright.vercel.app/sign-up`.
2. Create an account and complete any Clerk verification step.
3. Confirm that the BeeBright home page appears.
4. Select a yellow level button.
5. Choose **Multiple Choice** and start the set.
6. Confirm each question has exactly four unique spellings: one correct and three wrong.
7. Answer several questions.
8. Close the tab.
9. Reopen `https://beebright.vercel.app` and sign in with the same account.
10. Select **Resume where I left off**.
11. Confirm the question number, score, and streak were restored.
12. Open **Settings** in the top-right corner.
13. Test the avatar, light/dark mode, username, password, and logout controls.

For a cross-device test, sign into the same account in another browser or device. The Resume button should use the Neon record rather than the first browser's local storage.

## 7. Troubleshooting

### `Backend is not connected yet. Check VITE_API_BASE_URL.`

Confirm:

```text
Vercel VITE_API_BASE_URL=https://beebright-api.onrender.com
Render FRONTEND_URL=https://beebright.vercel.app
```

Then redeploy Vercel and Render. Do not use trailing slashes.

### Sign-in page says the publishable key is invalid

Copy `VITE_CLERK_PUBLISHABLE_KEY` again from Clerk **API keys**, save it in Vercel, and redeploy Vercel.

### Practice works but progress requests return `401`

The common causes are:

- `CLERK_JWT_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` came from different Clerk instances.
- `CLERK_ISSUER_URL` is not the Frontend API URL for that instance.
- `FRONTEND_URL` does not exactly match `https://beebright.vercel.app`.
- The JWT PEM lost its beginning, ending, or line breaks.

### Resume works in one browser but not another

Open Render logs and look for database errors. Confirm `DATABASE_URL` is the pooled Neon connection string and includes `sslmode=require`. Open Neon and confirm the project is active.

### Username cannot be changed

In Clerk, open **User & authentication**, enable Username, and allow users to update it.

### Delete account is rejected

In Clerk, enable the permission that allows users to delete their own accounts. The app deletes the Neon progress record before asking Clerk to delete the identity.

### `/settings` returns a Vercel 404

Confirm the Vercel Root Directory points to the `frontend` directory and that `frontend/vercel.json` was included in the deployment. Redeploy.

### Render says the backend root directory does not exist

Use the complete repository-relative path:

```text
BeeBright-Full-Stack/beebright-spelling-bee/backend
```

Do not use only `backend` for the existing GitHub repository layout.

## 8. Free-tier and small-instance design

- **Render Free:** Render currently lists 512 MB RAM and 0.1 CPU for the free web service. BeeBright loads only the 72 KB word file and roughly 272 KB distractor file, uses a bounded dictionary cache, and opens short database connections instead of holding a large connection pool.
- **Vercel:** the frontend is a static Vite deployment. It does not use Vercel Functions or server memory. The tested production bundle is about 310 KB JavaScript before gzip and about 91 KB after gzip.
- **Neon Free:** the current free allowance includes 0.5 GB storage. One progress row is stored per user and replaced as the user advances.
- **Clerk Hobby:** Clerk currently advertises a free Hobby tier for up to 50,000 monthly retained users. Development instances are capped at 100 users.

Free Render and Neon resources can wake from an idle state, so the first request after inactivity may be slower. The browser keeps a per-user local fallback and automatically retries normal progress saves as the user continues.

## 9. Local development

Backend `.env`:

```text
MERRIAM_WEBSTER_API_KEY=your_key
FRONTEND_URL=http://localhost:5173
DATABASE_URL=your_neon_pooled_connection_string
CLERK_ISSUER_URL=your_clerk_frontend_api_url
CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\nYOUR_KEY\n-----END PUBLIC KEY-----"
```

Frontend `.env`:

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

Run the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On Windows PowerShell, activate the virtual environment with:

```powershell
.\.venv\Scripts\Activate.ps1
```

Run the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.
