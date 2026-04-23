# VoxReader

Turn any PDF into an audiobook using Google Cloud TTS. Full-stack app with a shared library — books generated once are available to all users.

## Architecture

- **Frontend**: React + Vite (deployed on Vercel)
- **Auth**: Firebase Auth (Google, Email, Member ID)
- **Database**: Firestore (books, chapters, user progress, bookmarks)
- **Storage**: Firebase Storage (MP3 audio files)
- **TTS**: Google Cloud Text-to-Speech API
- **Player**: HTML5 audio with MediaSession API (lock screen controls + background playback)

## Setup

### 1. Firebase Project Setup

Project `ltn-voxreader` is configured in `src/services/firebase.js`.

In Firebase Console, make sure these services are enabled:
- Authentication → Google + Email/Password providers
- Firestore Database
- Storage

### 2. Deploy Security Rules

In Firebase Console:
- **Firestore → Rules** → paste contents of `firestore.rules` → Publish
- **Storage → Rules** → paste contents of `storage.rules` → Publish

### 3. Get Google Cloud TTS API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com) → select `ltn-voxreader`
2. APIs & Services → Library → enable **Cloud Text-to-Speech API**
3. APIs & Services → Credentials → **+ Create Credentials** → **API Key**
4. Edit the key → API restrictions → Restrict key → select **Cloud Text-to-Speech API** only
5. Copy the key (starts with `AIza...`)

You'll paste this into the app's Admin panel after first login.

### 4. Deploy to Vercel

**Option A: via GitHub**
1. Push this folder to a new GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo
3. Framework preset: **Vite** (auto-detected)
4. Click **Deploy**

**Option B: via Vercel CLI**
```bash
npm install -g vercel
vercel
```

## First Run

1. Open your deployed URL
2. Sign in with Google
3. **Make yourself admin**: Firebase Console → Firestore → `users` collection → find your doc → add field `role: "admin"` (string)
4. Refresh the app — a ⚙ icon appears in the top bar
5. Click ⚙ → Admin panel → paste your Google Cloud TTS API key → **Save** → **Test** (you should hear a confirmation)
6. Click **Upload PDF** → select a book → fill in title/author → **Create Audiobook**
7. On the book page, tap any chapter — audio generates paragraph-by-paragraph and plays
8. On mobile, tap browser share → **Add to Home Screen** for a PWA experience

## Background Playback

Audio generated as real MP3 files plays through `<audio>` — this means playback continues when:
- You switch browser tabs
- You lock your phone
- You switch to another app

Lock screen shows play/pause/skip controls via the MediaSession API.

## Adding More Admins

In Admin panel → **+ Add Admin** → enter email → they become admin (they must sign in once first).

## Cost Estimate

| Service | Free Tier | Overage |
|---|---|---|
| Google Cloud TTS (Standard) | 4M chars/month | $4/1M chars |
| Google Cloud TTS (Neural2) | 1M chars/month | $16/1M chars |
| Firebase Storage | 5 GB | $0.026/GB |
| Firestore | 50K reads/day | Cheap |
| Firebase Auth | Unlimited | Free |
| Vercel Hobby | Free | Free |

Typical monthly cost: **$0–$10**.

## Local Development

```bash
npm install
npm run dev   # http://localhost:5173
npm run build # → dist/
```

## Troubleshooting

**"TTS API key not configured"** — Admin must set the key in Admin panel first.

**"API key not valid"** — Make sure Cloud TTS API is enabled and the key isn't restricted to localhost only.

**Audio stops on iOS lock screen** — iOS requires starting audio from a user tap. Tap a paragraph/chapter to start (not auto).

**PDFs look scattered** — Use text-based PDFs (not scanned images). Scanned PDFs need OCR.

## Project Structure

```
src/
├── main.jsx                # entry
├── App.jsx                 # router (page state)
├── index.css               # global CSS variables
├── hooks/
│   ├── useAuth.js          # Firebase auth
│   └── usePlayer.js        # Audio player + MediaSession
├── services/
│   ├── firebase.js         # Firebase init
│   ├── pdfExtract.js       # PDF text extraction
│   ├── tts.js              # Google TTS calls
│   └── bookService.js      # Firestore CRUD
└── components/
    ├── Auth/LoginPage.jsx
    ├── Library/LibraryPage.jsx
    ├── Upload/UploadPage.jsx
    ├── BookView/BookPage.jsx
    ├── Admin/AdminPage.jsx
    └── Player/PlayerBar.jsx
```
