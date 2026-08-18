# BeeBright Spelling Bee Practice

BeeBright is a full-stack spelling-bee practice website built from the 2024 *Words of the Champions* PDF supplied with this project.

The project is intentionally split into two deployable applications:

- `frontend/` - React + Vite. Deploy this folder to Vercel.
- `backend/` - FastAPI + Python. Deploy this folder to Render.

The included generated word data contains the three difficulty sections found in the supplied PDF: One Bee, Two Bee, and Three Bee. The parser extracts 3,997 primary practice entries. The source guide describes the resource as 4,000 words; alternate/preferred spellings in the PDF are kept with their primary practice entry rather than treated as separate quiz questions.

## Features

- Flash Cards: definition and sentence first, then double-click or press Enter to reveal the word.
- Fill in the Blank: type the missing word from a Merriam-Webster example sentence.
- Multiple Choice: hear the word, choose one of four spellings, then see immediate feedback.
- Type the Word: hear the word and type the complete spelling.
- Merriam-Webster controls for pronunciation, definition, word origin, and example sentence.
- One Bee, Two Bee, and Three Bee levels from the supplied 2024 PDF.
- Exactly 100 questions per normal practice set.
- Next-set support so the next 100 words can be practiced after finishing a set.
- Compact correct-answer and current-streak display.
- Wrong answers show your answer and the correct spelling side by side.
- Browser resume: current set, question number, score, and streak are saved in `localStorage`.
- PDF import: a user can upload the same Scripps-format PDF or a simple word-list PDF and practice it for that browser session.
- Responsive layout for desktop, tablet, and phone.

## Project directory

```text
beebright-spelling-bee/
|
|-- README.md
|-- .gitignore
|-- render.yaml                  # optional Render Blueprint configuration
|
|-- frontend/                    # deploy THIS folder to Vercel
|   |-- .env.example
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- vercel.json
|   |-- vite.config.js
|   `-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- api.js               # Render API URL is read here
|       `-- styles.css
|
`-- backend/                     # deploy THIS folder to Render
    |-- .env.example
    |-- requirements.txt
    |-- app/
    |   |-- __init__.py
    |   |-- config.py
    |   |-- main.py              # FastAPI routes
    |   |-- models.py
    |   `-- services/
    |       |-- __init__.py
    |       |-- merriam_webster.py
    |       `-- pdf_parser.py
    |-- data/
    |   `-- words.json           # generated from the supplied 2024 PDF
    |-- scripts/
    |   `-- build_word_data.py   # regenerate words.json from a future PDF
    `-- tests/
        `-- test_api.py
```

## The two places you will add URLs/keys

You do not need to edit application code when you deploy.

### 1. Vercel: tell the frontend where Render is

Create this Vercel environment variable:

```text
VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

For local development, copy `frontend/.env.example` to `frontend/.env` and keep:

```text
VITE_API_BASE_URL=http://localhost:8000
```

`frontend/src/api.js` is the single code location that reads this value.

### 2. Render: add Merriam-Webster and the Vercel URL

Create these Render environment variables:

```text
MERRIAM_WEBSTER_API_KEY=YOUR_REAL_MERRIAM_WEBSTER_KEY
FRONTEND_URL=https://YOUR-VERCEL-PROJECT.vercel.app
```

Never put the Merriam-Webster API key into the Vercel frontend. Vite variables are shipped to the browser and are not secret. The API key stays only on Render.

Merriam-Webster developer portal: https://dictionaryapi.com/

This code uses the Collegiate Dictionary JSON API:

```text
https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}?key=YOUR_KEY
```

## Run the complete project locally first

### Prerequisites

Install:

- Git
- Python 3.12+
- Node.js 22+

### Step 1 - start the backend

Open a terminal in the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install Python packages:

```bash
pip install -r requirements.txt
```

Copy `backend/.env.example` to a new file named `backend/.env`, then put your Merriam-Webster key in it:

```text
MERRIAM_WEBSTER_API_KEY=your_real_key
FRONTEND_URL=http://localhost:5173
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --port 8000
```

Test these in your browser:

```text
http://localhost:8000/api/health
http://localhost:8000/api/levels
http://localhost:8000/docs
```

The `/docs` page is FastAPI's interactive API documentation.

### Step 2 - start the frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and use:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Start Vite:

```bash
npm run dev
```

Open the URL Vite prints, normally:

```text
http://localhost:5173
```

At this point the full frontend and backend should work together locally.

## Put the project into Git and GitHub

Create an empty repository on GitHub, for example `beebright-spelling-bee`. Do not add a GitHub README or `.gitignore` when creating it because this folder already contains both.

From the `beebright-spelling-bee` project root run:

```bash
git init
git add .
git commit -m "Initial BeeBright spelling bee app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/beebright-spelling-bee.git
git push -u origin main
```

Before `git add .`, make sure you did not put secrets into any tracked file. `.env` files are already ignored by `.gitignore`; `.env.example` files intentionally contain placeholders only.

## Deploy the backend to Render

Render's FastAPI documentation uses the same basic pattern as this project: install from `requirements.txt`, then run Uvicorn on Render's `$PORT`.

Official guide: https://render.com/docs/deploy-fastapi

### Option A - Render dashboard (easiest)

1. Push this repository to GitHub.
2. Sign in to Render.
3. Click `New` -> `Web Service`.
4. Connect the GitHub repository containing BeeBright.
5. Configure the service:

```text
Name: beebright-api
Language: Python 3
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
Health Check Path: /api/health
```

6. Add environment variables under Render's Environment section:

```text
MERRIAM_WEBSTER_API_KEY=your_real_key
FRONTEND_URL=http://localhost:5173
```

`FRONTEND_URL` is temporary for the first deploy. After Vercel gives you a production URL, replace it with the Vercel URL.

7. Click `Create Web Service`.
8. Wait for the deploy to finish.
9. Copy the Render URL. It will look similar to:

```text
https://beebright-api.onrender.com
```

10. Verify:

```text
https://YOUR-RENDER-URL.onrender.com/api/health
https://YOUR-RENDER-URL.onrender.com/api/levels
```

### Option B - Render Blueprint

This repository also includes `render.yaml`. In Render, create a Blueprint from the GitHub repository. Render will read the backend build/start configuration from that file. You still enter secret environment values in Render.

## Deploy the frontend to Vercel

Vercel detects Vite projects directly. Official Vite guide: https://vercel.com/docs/frameworks/frontend/vite

1. Sign in to Vercel.
2. Click `Add New` -> `Project`.
3. Import the same GitHub repository.
4. Set the project's `Root Directory` to:

```text
frontend
```

5. Vercel should detect `Vite`. Confirm:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

6. Before deploying, add this environment variable:

```text
Name: VITE_API_BASE_URL
Value: https://YOUR-RENDER-SERVICE.onrender.com
```

7. Apply it to Production, Preview, and Development if you want all Vercel environments to use that backend.
8. Click `Deploy`.
9. When the build finishes, Vercel gives you a URL similar to:

```text
https://beebright-spelling-bee.vercel.app
```

## Final connection step - important

Now return to Render and change:

```text
FRONTEND_URL=https://YOUR-REAL-VERCEL-URL.vercel.app
```

Save the environment change and let Render redeploy/restart the backend. This allows browser requests from your Vercel website through FastAPI CORS.

Then open your Vercel site and test:

1. Choose One Bee.
2. Start Multiple Choice.
3. Press the pronunciation button.
4. Open Definition, Word origin, and In a sentence.
5. Answer one correctly and one incorrectly.
6. Confirm the score and streak update.
7. Click `Save & exit`, refresh the browser, and press Resume.
8. Try Flash Cards and double-click a card.
9. Try Fill in the Blank and Type the Word.

## Using the supplied PDF

The repository already contains `backend/data/words.json`, generated from the PDF you supplied, so the deployed app does not need to re-read the PDF every time it starts.

Detected primary practice entries:

```text
One Bee:   1,065
Two Bee:   1,829
Three Bee: 1,103
Total:     3,997
```

To replace the list later with a new edition, put the new PDF somewhere on your computer and run from `backend/`:

```bash
python scripts/build_word_data.py "/path/to/new-words.pdf"
```

That regenerates `backend/data/words.json`. Commit the changed JSON file and push it to GitHub. Render will then redeploy the new backend data.

The website's `Import a PDF word list` button is separate. It lets a user upload a PDF for a practice session without changing the permanent server data.

## Backend API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check and configuration status |
| GET | `/api/levels` | Available PDF levels and word counts |
| GET | `/api/practice` | Return up to 100 words for a level/set |
| GET | `/api/dictionary/{word}` | Merriam-Webster definition, origin, example, pronunciation, audio |
| POST | `/api/import-pdf` | Parse an uploaded word-list PDF for the current client session |

## Common deployment problems

### Frontend says the backend is not connected

Check Vercel -> Project -> Settings -> Environment Variables. `VITE_API_BASE_URL` must be the Render HTTPS URL and should not have a trailing slash. After changing a Vite environment variable, redeploy the frontend so the new build contains the value.

### Browser console shows a CORS error

On Render, verify:

```text
FRONTEND_URL=https://your-exact-vercel-domain.vercel.app
```

Do not add a trailing slash. Save the change and restart/redeploy Render.

### Definitions or pronunciation are missing

Open the Render health endpoint. It returns `merriam_webster_configured: true` when the API key exists. If it is false, add `MERRIAM_WEBSTER_API_KEY` to Render and restart the service.

When Merriam-Webster does not return an audio file for an entry, BeeBright falls back to the browser's speech synthesis so the practice session can continue.

### Render's free service is slow on the first request

Some Render plans can spin down when idle. The first request after inactivity can therefore take longer. The frontend will work normally once the service is awake.

## Security notes

- Never commit a real `.env` file.
- Never put `MERRIAM_WEBSTER_API_KEY` into `VITE_*` variables.
- Keep Merriam-Webster requests on the backend so the key is not exposed in browser source code.
- The uploaded PDF endpoint limits files to 15 MB.
- If you make the site widely public, consider adding rate limiting to `/api/dictionary/{word}` and `/api/import-pdf`.

## Merriam-Webster API note

Merriam-Webster's developer site currently describes its API as free for non-commercial use up to its stated daily request limit and subject to its terms. Review the current terms before making this a commercial product:

https://dictionaryapi.com/

## Quick production checklist

- [ ] Code pushed to GitHub
- [ ] Render Root Directory = `backend`
- [ ] Render `MERRIAM_WEBSTER_API_KEY` added
- [ ] Render backend deployed and `/api/health` works
- [ ] Vercel Root Directory = `frontend`
- [ ] Vercel `VITE_API_BASE_URL` points to Render
- [ ] Vercel frontend deployed
- [ ] Render `FRONTEND_URL` updated to the real Vercel URL
- [ ] Render restarted/redeployed after the CORS URL change
- [ ] Multiple Choice pronunciation tested
- [ ] Wrong-answer comparison tested
- [ ] Resume tested after refresh/closing the tab

