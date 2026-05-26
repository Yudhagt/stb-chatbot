# Stb_Chatbot

Multi-model AI chatbot with JWT auth, OAuth (Google + GitHub), chat history, file upload, and public GitHub repo context.

## Tech Stack

- **Frontend**: React 18 + Vite 5 (GitHub Pages)
- **Backend**: Express 5 + Prisma ORM + PostgreSQL (Railway)
- **Auth**: JWT + Google OAuth + GitHub OAuth
- **AI**: x5lab API gateway (22 models)
- **Deploy**: GitHub Pages + Railway + Docker Compose

## Quick Start (Local Dev)

```bash
npm run setup
npm run dev
```

Backend: `http://localhost:3001`  
Frontend: `http://localhost:5173`

## Backend Setup

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="file:./prisma/dev.db"
X5LAB_API_KEY="isi_token_x5lab_kamu"
JWT_SECRET="random_secret_minimal_32_karakter"
APP_URL="http://localhost:5173"
API_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:5173"
```

```bash
npm run db:push
npm run dev
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```env
# Backend .env
DATABASE_URL="file:./prisma/dev.db"       # Dev: SQLite
# DATABASE_URL="postgresql://..."         # Prod: PostgreSQL
X5LAB_API_KEY="x5-xxx"
JWT_SECRET="random_secret"
APP_URL="http://localhost:5173"           # Dev
# APP_URL="https://yudhagt.github.io/stb-chatbot"  # Prod
API_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:5173"

# OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GITHUB_CALLBACK_URL="http://localhost:3001/api/auth/github/callback"

# SMTP (optional)
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="noreply@example.com"
SMTP_PASS="xxx"
SMTP_FROM="Stb_Chatbot <noreply@example.com>"
```

## OAuth Callback URLs

| Provider | Local (Dev) | Production |
|----------|-------------|------------|
| Google | `http://localhost:3001/api/auth/google/callback` | `https://backend-production-eb62e.up.railway.app/api/auth/google/callback` |
| GitHub | `http://localhost:3001/api/auth/github/callback` | `https://backend-production-eb62e.up.railway.app/api/auth/github/callback` |

## Features

- Multi-model AI chat (22 models via x5lab)
- Google & GitHub OAuth login
- Email verification & password reset
- Chat history & conversation management
- File upload: PDF, DOCX, images (OCR), code files
- Public GitHub repo context input
- Admin dashboard (user mgmt, usage stats)
- Dark/light theme
- Markdown + syntax highlighting responses
- Rate limiting & per-user daily limits
- Input/output token guards

## Deployment

### Frontend → GitHub Pages

```bash
cd frontend
$env:VITE_API_URL="https://backend-production-eb62e.up.railway.app"
npm run build
npx gh-pages -d dist
```

### Backend → Railway

Push to `main` branch → Railway auto-deploys.

Or deploy manually:

```bash
railway up --detach
```

## Prisma Schema Changes

```bash
cd backend
npm run db:generate
npm run db:push
```

For messy local DB:

```bash
npx prisma db push --force-reset
```

## License

MIT
