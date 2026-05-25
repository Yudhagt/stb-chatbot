<<<<<<< HEAD
# Stb_Chatbot Auth Pro

ChatGPT-like public chatbot with:
- PostgreSQL + Prisma
- JWT auth
- Google OAuth
- GitHub OAuth
- Email verification
- Forgot/reset password
- Per-user daily limit
- Chat history
- Upload image/document/code
- OCR fallback for screenshots
- Public GitHub repo context for vibe coding

## 1. Start PostgreSQL

With Docker:

```bash
docker compose up -d
```

## 2. Backend

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://urbanmotion:urbanmotion123@localhost:5432/urbanmotion_ai?schema=public"
X5LAB_API_KEY="ISI_TOKEN_X5LAB_KAMU"
JWT_SECRET="random_secret_panjang_minimal_32_karakter"
APP_URL="http://localhost:5173"
API_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:5173"
ADMIN_EMAILS="24051204191@mhs.unesa.ac.id"
```

Then:

```bash
npm run db:generate
npm run db:push
npm run dev
```

## 3. Frontend

Open new terminal:

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open:

```txt
http://localhost:5173
```

## 4. Email Verification

If SMTP is empty, the backend logs verification/reset links to terminal.

For real email delivery, set:

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="noreply@urbanmotion.web.id"
SMTP_PASS="smtp_password"
SMTP_FROM="Stb_Chatbot <noreply@urbanmotion.web.id>"
```

## 5. Google OAuth Setup

Google callback URL local:

```txt
http://localhost:3001/api/auth/google/callback
```

Production callback URL:

```txt
https://api.urbanmotion.web.id/api/auth/google/callback
```

`.env`:

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"
```

## 6. GitHub OAuth Setup

GitHub callback URL local:

```txt
http://localhost:3001/api/auth/github/callback
```

Production callback URL:

```txt
https://api.urbanmotion.web.id/api/auth/github/callback
```

`.env`:

```env
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
GITHUB_CALLBACK_URL="http://localhost:3001/api/auth/github/callback"
```

## 7. Vibe Code Features

Supported attachments:

```txt
Images: jpg, jpeg, png, webp
Documents: pdf, docx, txt, md
Code: js, jsx, ts, tsx, json, html, css, py, java, go, rs, php, rb, vue, svelte, sql, prisma, yaml, xml
```

GitHub repo input examples:

```txt
https://github.com/user/repo
https://github.com/user/repo/tree/main/src
```

Optional higher GitHub rate limit:

```env
GITHUB_TOKEN="github_personal_access_token_optional"
```

## 8. After schema changes

Run:

```bash
cd backend
npm run db:generate
npm run db:push
```

If local database is messy and you do not need the data:

```bash
npx prisma db push --force-reset
```


## Dashboard Settings

This build adds ChatGPT-like settings dashboard:

- Account profile
- Update display name
- Update avatar URL
- Email verification status
- Resend verification email
- Change/set password
- Connected Google/GitHub accounts list
- Usage summary
- Default model preference via browser localStorage
- Delete account


## Polished Features

This build adds:

- Markdown renderer for AI responses.
- GitHub-style syntax highlighting.
- Copy message button.
- Regenerate last response.
- Rename chat.
- Delete all chats.
- Basic admin dashboard:
  - total users
  - today chats
  - today tokens
  - user list
  - role/plan update
- Helmet security headers.

After updating from older build:

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```


## Image upload disabled

This build intentionally disables image upload in the UI and backend.

Supported input focus:
- PDF
- DOCX
- TXT/MD
- code files
- public GitHub repo URL


## Avatar upload

Image upload is disabled for chat input, but enabled for profile photos.

Endpoint:

```txt
POST /api/account/avatar
field: avatar
types: jpg, png, webp
max: 2 MB
```

Uploaded avatars are stored in `backend/uploads/<userId>/...` and exposed via `/uploads/...`.


## Code render fix

This build fixes ugly AI code output by:
- forcing backend prompt to use Markdown fenced code blocks
- converting pseudo XML output like `<write_file><path>...</path><content>...</content></write_file>` into Markdown
- rendering code blocks with a header and Copy code button
- preventing long code from breaking the chat layout


## ChatGPT skin

This build replaces the custom red/glass dashboard styling with a more ChatGPT-like dark layout:
- neutral dark sidebar
- centered chat column
- rounded gray composer
- minimal model selector
- cleaner code blocks
- quieter account/settings cards


## Product Ready Additions

This build adds:

- Health check endpoint: `/health` and `/api/health`
- Admin suspend user
- Admin custom daily limit per user
- Admin reset daily usage
- Repo scan daily limit
- File upload daily limit
- Input token guard
- Output token guard
- Graceful shutdown
- PM2 ecosystem config
- Nginx production config
- Production `.env` examples
- Legal files: `LICENSE`, `SECURITY.md`, `PRIVACY.md`, `TERMS.md`
- Production deployment docs under `docs/`

## Important after update

Because Prisma schema changed, run:

```bash
cd backend
npm install
npm run db:generate
npm run db:push
```

If this is production and you already use migrations, create and apply a proper migration instead of relying on `db:push`.
=======
# stb-chatbot
Website chatbot modern
>>>>>>> 476d36e7aac21844f99be899d659b2695177546f
