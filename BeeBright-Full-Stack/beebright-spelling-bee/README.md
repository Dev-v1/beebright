# BeeBright Spelling Bee Practice

> The complete Clerk, Neon, Render, and Vercel setup walkthrough is in [`CLERK_NEON_DEPLOYMENT.md`](CLERK_NEON_DEPLOYMENT.md).

BeeBright is a full-stack spelling-bee practice website built from the 2024 *Words of the Champions* PDF supplied with this project.

The project is intentionally split into two deployable applications:

- `frontend/` - React + Vite. Deploy this folder to Vercel.
- `backend/` - FastAPI + Python. Deploy this folder to Render.

The included generated word data contains the three difficulty sections found in the supplied PDF: One Bee, Two Bee, and Three Bee. The parser extracts 3,997 primary practice entries. The source guide describes the resource as 4,000 words; alternate/preferred spellings in the PDF are kept with their primary practice entry rather than treated as separate quiz questions.

## Features

- Flash Cards: definition and sentence first, then double-click or press Enter to reveal the word.
- Fill in the Blank: type the missing word from a Merriam-Webster example sentence.
- Multiple Choice: hear the word, choose one of four spellings, then see immediate feedback.
- Three pre-generated pronunciation-style wrong spellings for every word in all three PDF levels.
- Type the Word: hear the word and type the complete spelling.
- Merriam-Webster controls for pronunciation, definition, word origin, and example sentence.
- One Bee, Two Bee, and Three Bee levels from the supplied 2024 PDF.
- Exactly 100 questions per normal practice set.
- Next-set support so the next 100 words can be practiced after finishing a set.
- Compact correct-answer and current-streak display.
- Wrong answers show your answer and the correct spelling side by side.
- Clerk sign-in and sign-up pages with a protected practice experience.
- Neon-backed resume across tabs, browsers, and devices, plus a per-user local fallback.
- `/settings` page for avatar, light/dark mode, username, password, logout, and account deletion.
- Server-enforced administrator role configured by Clerk user ID.
- Admin-only `/admin` panel for PDF imports, publishing, hiding/deleting custom lists, request moderation, and lightweight usage totals.
- Neon-backed shared custom word lists that become available to every user after publication.
- User word-list request form with request-status history.
- Admin-only metallic rainbow badge and settings navigation.
- Yellow clickable One Bee, Two Bee, and Three Bee level buttons.
- Hints hide the target spelling and sentence hints are complete short sentences.
- Bee favicon in the browser tab.
- Admin-only PDF import for Scripps-format or simple word-list PDFs. The parsed words are stored in Neon; uploaded PDF files are not retained.
- Responsive layout for desktop, tablet, and phone.

## Project directory

```text
beebright-spelling-bee/
|
|-- README.md
|-- CLERK_NEON_DEPLOYMENT.md     # complete production setup and troubleshooting
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
|       |-- admin/               # protected admin dashboard
|       |-- clerk/               # Clerk routing and account settings
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
    |   `-- distractors.json     # three wrong spellings for all 3,997 words
    |-- scripts/
    |   `-- build_word_data.py   # regenerate words.json from a future PDF
    `-- tests/
        `-- test_api.py
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

