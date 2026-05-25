# Stb_Chatbot

Full-stack AI chatbot with multi-model support via x5lab.

## Tech Stack

- **Frontend**: React 18 + Vite 5 + custom CSS (dark/light theme) 
- **Backend**: Express 5 + Prisma ORM + SQLite (dev) / PostgreSQL (prod)
- **AI**: x5lab API gateway (https://api.x5lab.dev) with 22 models
- **Auth**: JWT + Google OAuth + GitHub OAuth
- **Infra**: Docker Compose, PM2, Nginx

## Project Structure

```
Stb_Chatbot/
  backend/
    server.js           # Express API (auth, chat, upload, admin)
    prisma/
      schema.prisma     # Database schema (SQLite dev / PostgreSQL prod)
      dev.db            # SQLite database file (auto-created)
    uploads/            # User file uploads
  frontend/
    src/                # React app (single-page, no react-router)
    dist/               # Production build output
  nginx/                # Nginx production configs
  docs/                 # Deployment docs
  opencode.json         # OpenCode config with x5lab
  AGENTS.md             # This file
  docker-compose.yml    # PostgreSQL for production
  ecosystem.config.cjs  # PM2 process manager
```

## Initial Setup

```bash
npm run setup
```
Runs: `npm install` in both `backend/` and `frontend/`, then `prisma db push` to create SQLite database.

## Development Workflow

```bash
# Start both servers concurrently:
npm run dev

# Or individually:
npm run dev:api    # Backend on http://localhost:3001
npm run dev:web    # Frontend on http://localhost:5173
```

- Backend uses SQLite (`backend/prisma/dev.db`) — no Docker needed for dev
- Frontend proxies `/api` and `/uploads` to backend via Vite proxy
- Frontend also calls backend directly via `VITE_API_URL=http://localhost:3001`

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both servers (concurrently) |
| `npm run build` | Build frontend to `frontend/dist/` |
| `npm run setup` | Install deps + init database |
| `npm run db:push` | Push schema to SQLite |
| `npm run db:reset` | Force-reset SQLite database |

From `backend/`:
- `npm run db:generate` - Regenerate Prisma client
- `npm run db:studio` - Open Prisma Studio GUI
- `npm run db:migrate` - Run Prisma migrations
- `npm run dev` - Start with nodemon (auto-restart on changes)

## Architecture Notes

- **Auth**: Register/login with email+password, or Google/GitHub OAuth
- **Verification**: Email verification via SMTP (logs to terminal if SMTP unconfigured)
- **Rate limiting**: 200 requests/10min per IP, 20 chats/day per user (configurable)
- **File upload**: Supports PDF, DOCX, images (OCR via tesseract.js), code files
- **Database**: Dev uses SQLite at `backend/prisma/dev.db`; prod uses PostgreSQL via `DATABASE_URL` env var
- **.env**: Backend `.env` is pre-configured with SQLite and x5lab API key

## Available Agents

- `@reviewer` - Code review for React/Express/Prisma
- `@planner` - Implementation plans for new features
- `@tester` - Test writing and execution
- `@devops` - Docker, PM2, Nginx, deployment
- `@db-manager` - Prisma schema and database management

## x5lab Models (Primary)

- `claude-sonnet-4.5` — Frontend/UI (default smart mode)
- `claude-opus-4.6` — Complex backend/reasoning
- `gpt-5.3-codex` — Code generation & debugging
- `deepseek-v3` — Cost-effective general tasks (default balanced mode)
- `gemini-3.1-pro` — Large context (1M tokens)
- `qwen3-coder-next` — Coding-specific (default coding mode)

## Conventions

- All API routes under `/api/` prefix
- Auth: `auth` middleware; Admin: `adminOnly` middleware
- AI responses must use Markdown fenced code blocks with language tags
- Always run `npm run db:push` after Prisma schema changes
- Backend API key: `X5LAB_API_KEY` in `backend/.env`
- CORS origin: `http://localhost:5173` (dev)
- Production URLs: `urbanmotion.web.id` / `api.urbanmotion.web.id`
