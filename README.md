# VoxReader

Turn any PDF into an audiobook with AI-cleaned text and human-quality voice. Books generated once are shared across all users.

## What's New (v2)

- **AI-powered PDF cleanup** — Claude Haiku 4.5 reads raw PDF text, identifies real chapters vs section headers, fixes broken words ("inthe way" → "in the way"), and strips junk (headers, footers, page numbers, table of contents)
- **One chapter at a time navigation** — no more endless scrolling. Sticky chapter picker, prev/next buttons, focused reading view
- **True background generation** — playback starts as soon as paragraph 1 is ready, the rest generates while you listen
- **Bookmark drawer** — slide-up drawer accessible from the player bar, one-tap jumps

## Architecture

| Layer | Tech |
|---|---|
| Frontend | React + Vite (Vercel) |
| Backend | Vercel serverless function (`/api/process-pdf`) |
| Auth | Firebase Auth |
| Database | Firestore |
| Audio storage | Firebase Storage |
| AI cleanup | Anthropic Claude Haiku 4.5 |
| TTS | Google Cloud Text-to-Speech |

When you upload a PDF: browser → base64 encode → POST to `/api/process-pdf` (serverless) → `pdf-parse` extracts text → split into chunks → Claude cleans each chunk in parallel → returns structured JSON → frontend saves to Firestore.

When you tap play: paragraph 1 generates via Google TTS → MP3 saved to Firebase Storage → `<audio>` plays it → meanwhile paragraphs 2-5 generate in parallel → next chapter pre-generates when you're 60% through.

## Setup

### 1. Firebase Console (project `ltn-voxreader`)

Enable:
- Authentication → Google + Email/Password
- Firestore Database → production mode
- Storage → production mode

Paste rules:
- Firestore → Rules → paste `firestore.rules` → Publish
- Storage → Rules → paste `storage.rules` → Publish

### 2. Google Cloud Console (same project)

- APIs & Services → Library → enable **Cloud Text-to-Speech API**
- Credentials → Create API Key
- Restrict the key to Cloud Text-to-Speech API only

### 3. Anthropic Console

- Get an API key at [console.anthropic.com](https://console.anthropic.com)
- Cost: ~$0.10–$0.50 per book processed (Haiku 4.5 is very cheap)

### 4. Deploy to Vercel

Push this folder to GitHub, then on [vercel.com](https://vercel.com):
- New Project → Import the repo
- Framework: Vite (auto-detected)
- Click Deploy

Vercel automatically deploys the `/api/process-pdf` serverless function. **No environment variables needed** — keys are stored in Firestore by admins and read by the function from the request body.

### 5. First Run

1. Open your Vercel URL → sign in with Google
2. Make yourself admin: Firebase Console → Firestore → `users` → your doc → add field `role: "admin"`
3. Refresh app → ⚙ Admin icon appears
4. Paste **both** keys:
   - **Anthropic API key** (for AI cleanup) — Save
   - **Google Cloud TTS key** (for voice) — Save → Test
5. Click Upload PDF → wait 1–3 min for AI processing → Save to Library
6. Tap any chapter → audio generates and plays in real time

## Cost Estimate

| Service | Free Tier | At ~10 books/month |
|---|---|---|
| Anthropic Haiku 4.5 | none | ~$2–5 (cleanup) |
| Google Cloud TTS (Neural2) | 1M chars/month | ~$5–10 (voice) |
| Firebase Storage | 5GB | Free |
| Firestore | 50K reads/day | Free |
| Firebase Auth | unlimited | Free |
| Vercel Hobby | unlimited deploys | Free |
| **Total** | | **~$5–15/month** |

## Project Structure

```
voxreader/
├── api/
│   └── process-pdf.js         # Vercel serverless function (PDF → AI cleanup)
├── src/
│   ├── App.jsx                # router
│   ├── main.jsx
│   ├── index.css
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── usePlayer.js       # audio + background generation
│   ├── services/
│   │   ├── firebase.js
│   │   ├── pdfProcessor.js    # calls /api/process-pdf
│   │   ├── tts.js             # Google Cloud TTS calls
│   │   └── bookService.js     # Firestore CRUD
│   └── components/
│       ├── Auth/LoginPage.jsx
│       ├── Library/LibraryPage.jsx
│       ├── Upload/UploadPage.jsx
│       ├── BookView/BookPage.jsx     # one-chapter-per-page reader
│       ├── Admin/AdminPage.jsx       # API keys, admin grants, book management
│       └── Player/PlayerBar.jsx      # fixed bottom player + bookmark drawer
├── firebase.json
├── firestore.rules
├── storage.rules
├── firestore.indexes.json
├── vercel.json                # SPA routing for client-side routes
├── package.json
└── README.md
```

## Local Development

```bash
npm install
npm run dev   # http://localhost:5173 — but /api/process-pdf won't work locally
              # use `vercel dev` to run serverless functions locally:
              # npm i -g vercel && vercel dev
npm run build
```

## Troubleshooting

**"Anthropic API key not configured"** — Admin must paste key in ⚙ Admin → save.

**PDF processing hangs / times out** — Large books (500+ pages) can take 2–3 minutes. Vercel Hobby has 60s limit on serverless functions; for very large books you may need Vercel Pro or split the PDF.

**"API key not valid" on TTS** — Make sure Cloud Text-to-Speech API is enabled and your key isn't restricted to disallow your Vercel domain.

**Audio doesn't play in background on iOS** — iOS requires audio to start from a user tap (not auto-trigger). Tap the play button explicitly.

**Bookmarks not syncing** — Bookmarks are stored per-user in Firestore. Make sure you're signed in.

**Chapter numbers wrong / sections counted as chapters** — This is what AI cleanup is supposed to fix vs the old regex approach. If it still happens, the AI may have misclassified — try a different PDF or report the issue.
