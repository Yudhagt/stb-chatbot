# Stb_Chatbot

Multi-model AI chatbot. Login pakai Google/GitHub, chat dengan 22 model AI, upload file, dan input link GitHub repo buat vibe coding.

## 📸 Preview

![Stb_Chatbot](https://img.shields.io/badge/status-live-brightgreen)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Express](https://img.shields.io/badge/Express-5-000000)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)

---

## 🚀 Cara Install & Jalankan (Local Development)

### Syarat Minimal

- [Node.js](https://nodejs.org/) v18 atau lebih baru
- [Git](https://git-scm.com/) (buat clone repo)
- (Opsional) [Docker Desktop](https://www.docker.com/products/docker-desktop/) kalau mau pake PostgreSQL

### Langkah 1: Clone & Masuk Folder

```bash
git clone https://github.com/Yudhagt/stb-chatbot.git
cd stb-chatbot
```

### Langkah 2: Install Semua Dependensi

Cukup satu perintah:

```bash
npm run setup
```

Perintah ini otomatis menjalankan:
1. `npm install` di folder `backend/`
2. `npm install` di folder `frontend/`
3. `prisma db push` untuk bikin database SQLite

### Langkah 3: Isi Token API x5lab

Buka file `backend/.env` dan isi `X5LAB_API_KEY`:

```env
X5LAB_API_KEY="x5-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

> **Daftar x5lab**: https://x5lab.dev — registrasi gratis, dapet saldo buat testing.

### Langkah 4: Jalankan Server

```bash
npm run dev
```

Ini menjalankan **backend + frontend barengan**:
- Backend → `http://localhost:3001`
- Frontend → `http://localhost:5173`

Buka `http://localhost:5173` di browser.

### Langkah 5: Login

Akun admin default:
- **Username**: `yudhagt`
- **Password**: `123`

Atau registrasi akun baru lewat halaman login.

---

## 🧩 Penjelasan Perintah Penting

| Perintah | Fungsi |
|----------|--------|
| `npm run setup` | Install semua dependensi + bikin database dari awal |
| `npm run dev` | Jalankan backend (3001) + frontend (5173) barengan |
| `npm run dev:api` | Jalankan backend aja (dengan auto-restart) |
| `npm run dev:web` | Jalankan frontend aja |
| `npm run build` | Build frontend buat production |
| `npm run db:push` | Update database setelah ubah schema Prisma |
| `npm run db:reset` | Reset total database SQLite (hapus semua data) |

> Semua perintah dijalankan dari **folder root** `stb-chatbot/`.

---

## 🔧 Konfigurasi Environment

### File `.env` di `backend/`

```env
# ===================== WAJIB DIISI =====================
X5LAB_API_KEY="x5-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
JWT_SECRET="random_string_minimal_32_karakter"

# ===================== DEFAULT (Jangan diubah kalau local) =====================
DATABASE_URL="file:./prisma/dev.db"        # SQLite (local)
APP_URL="http://localhost:5173"
API_URL="http://localhost:3001"
CORS_ORIGIN="http://localhost:5173"

# ===================== OPSIONAL: Google OAuth =====================
# Biarkan kosong kalau cuma mau pake login username/password
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# ===================== OPSIONAL: GitHub OAuth =====================
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITHUB_CALLBACK_URL="http://localhost:3001/api/auth/github/callback"

# ===================== OPSIONAL: SMTP Email =====================
# Kalau kosong, link verifikasi/reset password tampil di terminal
SMTP_HOST=""
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="Stb_Chatbot <noreply@emailkamu.com>"
```

---

## ☁️ Deploy ke Production

### Frontend → GitHub Pages

```bash
cd frontend
$env:VITE_API_URL="https://backend-production-eb62e.up.railway.app"
npm run build
npx gh-pages -d dist
```

Hasil: `https://yudhagt.github.io/stb-chatbot/`

### Backend → Railway

1. Push ke GitHub → Railway auto-deploy
2. Atau deploy manual:

```bash
railway up --detach
```

### OAuth untuk Production

Daftarkan callback URL ini ke Google Cloud Console / GitHub OAuth App:

| Provider | Callback URL |
|----------|-------------|
| **Google** | `https://backend-production-eb62e.up.railway.app/api/auth/google/callback` |
| **GitHub** | `https://backend-production-eb62e.up.railway.app/api/auth/github/callback` |

---

## 💡 Fitur Lengkap

| Fitur | Keterangan |
|-------|-----------|
| **22 Model AI** | Claude, DeepSeek, Gemini, Qwen, GLM, MiniMax, Gemma, OpenAI |
| **Google Login** | Login cepat dengan akun Google |
| **GitHub Login** | Login cepat dengan akun GitHub |
| **Email Verification** | Verifikasi email + reset password |
| **Chat History** | Riwayat percakapan per user |
| **Upload File** | PDF, DOCX, gambar (OCR otomatis), file code |
| **GitHub Repo Context** | Input link repo GitHub buat vibe coding |
| **Dark/Light Theme** | Tema gelap & terang |
| **Markdown Response** | Jawaban AI diformat rapi dengan syntax highlighting |
| **Admin Dashboard** | Kelola user, lihat statistik, atur limit |
| **Rate Limiting** | 200 request/10 menit per IP, 20 chat/hari per user |
| **Token Guard** | Proteksi input/output token biar nggak jebol |

---

## 📦 Struktur Folder

```
stb-chatbot/
├── backend/
│   ├── server.js              # Express API
│   ├── prisma/
│   │   ├── schema.prisma      # SQLite (local)
│   │   └── schema.pg.prisma   # PostgreSQL (production)
│   └── uploads/               # File upload user
├── frontend/
│   ├── src/App.jsx            # React app (single-page)
│   ├── src/App.css            # Styling
│   └── dist/                  # Hasil build
├── docs/                      # Dokumentasi deployment
├── nginx/                     # Config Nginx production
├── docker-compose.yml         # PostgreSQL production
├── ecosystem.config.cjs       # PM2 process manager
└── package.json               # Root scripts
```

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `Error: listen EADDRINUSE` | Port 3001 atau 5173 udah dipakai. Matiin aplikasi lain atau ganti port di `.env` |
| `Cannot find module 'prisma'` | Jalankan `npm run setup` dulu dari root |
| Database error | `npm run db:reset` buat reset SQLite |
| Login gagal | Cek `JWT_SECRET` di `.env` |
| AI gak jawab | Cek `X5LAB_API_KEY` dan saldo x5lab |
| Blank white page | Clear cache browser, atau cek `base: '/stb-chatbot/'` di `vite.config.js` |

---

## 📄 License

MIT
