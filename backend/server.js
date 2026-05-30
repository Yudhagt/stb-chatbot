const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { createWorker } = require("tesseract.js");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const { PrismaClient } = require("@prisma/client");

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const APP_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || `http://localhost:${PORT}`;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAX_CONTEXT_CHARS = Number(process.env.MAX_CONTEXT_CHARS || 120000);
const GITHUB_MAX_FILES = Number(process.env.GITHUB_MAX_FILES || 35);
const GITHUB_MAX_FILE_CHARS = Number(process.env.GITHUB_MAX_FILE_CHARS || 20000);
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 1600);
const MAX_INPUT_TOKENS_PER_REQUEST = Number(process.env.MAX_INPUT_TOKENS_PER_REQUEST || 32000);
const DAILY_REPO_SCAN_LIMIT = Number(process.env.DAILY_REPO_SCAN_LIMIT || 3);
const DAILY_UPLOAD_LIMIT = Number(process.env.DAILY_UPLOAD_LIMIT || 5);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"));
    },
    credentials: true
  })
);

app.use(compression({ level: 6, threshold: 256 }));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "1mb" }));

const isDev = process.env.NODE_ENV !== "production";
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (isDev || duration > 1000) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d" }));

const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak request. Coba lagi nanti." }
});

app.use("/api", apiLimiter);

app.use((req, res, next) => {
  req.setTimeout(150000, () => {
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timeout." });
    }
  });
  next();
});

const allowedExt = new Set([
  ".txt", ".md", ".markdown",
  ".js", ".jsx", ".ts", ".tsx",
  ".json", ".html", ".css", ".scss",
  ".py", ".java", ".go", ".rs", ".php", ".rb",
  ".vue", ".svelte", ".sql", ".prisma",
  ".yaml", ".yml", ".xml",
  ".pdf", ".docx"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (!allowedExt.has(ext)) {
      return cb(new Error("Format file belum didukung. Pakai gambar, PDF, DOCX, TXT/MD, atau file kode."));
    }

    cb(null, true);
  }
});

function uploadSingle(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      error: error.message || "Upload file gagal."
    });
  });
}


const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Foto profil harus JPG, PNG, atau WEBP."));
    }

    cb(null, true);
  }
});

function avatarUploadSingle(req, res, next) {
  avatarUpload.single("avatar")(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      error: error.message || "Upload avatar gagal."
    });
  });
}


const FULL_MODEL_LIST = [
  // Anthropic (Claude)
  { id: "claude-opus-4.6",        provider: "Claude",   label: "Opus 4.6",     vision: false },
  { id: "claude-opus-4-6",        provider: "Claude",   label: "Opus 4.6 2",   vision: false },
  { id: "claude-opus-4.7",        provider: "Claude",   label: "Opus 4.7",     vision: false },
  { id: "claude-sonnet-4.5",      provider: "Claude",   label: "Sonnet 4.5",   vision: false },
  { id: "claude-haiku-4.5",       provider: "Claude",   label: "Haiku 4.5",    vision: false },
  { id: "claude-haiku-4-5-20251001", provider: "Claude", label: "Haiku 4.5 2",  vision: false },
  // OpenAI
  { id: "openai/o3",              provider: "OpenAI",   label: "o3",            vision: false },
  // Google (Gemini)
  { id: "gemini-3.1-pro-preview",       provider: "Gemini", label: "3.1 Pro Preview",      vision: false },
  { id: "gemini-3.1-flash-lite-preview",provider: "Gemini", label: "3.1 Flash Lite Preview",vision: false },
  { id: "gemini-3-pro-preview",         provider: "Gemini", label: "3 Pro Preview",          vision: false },
  { id: "gemini-3-flash-preview",       provider: "Gemini", label: "3 Flash Preview",        vision: false },
  { id: "gemini-2.0-flash-lite",        provider: "Gemini", label: "2.0 Flash Lite",          vision: false },
  { id: "google/gemini-2.5-pro",        provider: "Gemini", label: "2.5 Pro",                 vision: false },
  { id: "google/gemini-2.5-flash",      provider: "Gemini", label: "2.5 Flash",               vision: false },
  // DeepSeek
  { id: "deepseek-3.2",           provider: "DeepSeek", label: "V3.2",          vision: false },
  { id: "deepseek/deepseek-chat",     provider: "DeepSeek", label: "DeepSeek Chat",     vision: false },
  { id: "deepseek/deepseek-reasoner", provider: "DeepSeek", label: "DeepSeek Reasoner", vision: false },
  // Qwen
  { id: "qwen3-coder-next",       provider: "Qwen",     label: "Qwen 3 Coder",  vision: false },
  // MiniMax
  { id: "MiniMax-M2.5",           provider: "MiniMax",  label: "MiniMax M2.5",  vision: false },
  // GLM (Zhipu AI)
  { id: "glm-5",                  provider: "GLM",      label: "GLM-5",         vision: false },
  { id: "glm-5.1",                provider: "GLM",      label: "GLM-5.1",       vision: false },
  // Google Gemma
  { id: "gemma-4-31b-it",         provider: "Gemma",    label: "Gemma 4 31B",   vision: false }
];

const FALLBACK_CHAIN = [
  "deepseek-3.2", "claude-haiku-4.5",
  "qwen3-coder-next",
  "claude-sonnet-4.5", "glm-5", "gemini-3-flash-preview",
  "claude-opus-4.6", "gemini-3.1-pro-preview"
];

function getModelConfig(key) {
  if (MODEL_CONFIG[key]) return MODEL_CONFIG[key];
  const found = FULL_MODEL_LIST.find(m => m.id === key);
  if (found) {
    return {
      id: key,
      label: found?.label || key,
      description: found ? `${found.provider} ${found.label}` : key,
      vision: found ? found.vision : false,
      allowedForFree: true
    };
  }
  // Unknown model — fallback ke balanced
  return MODEL_CONFIG.balanced;
}

const MODEL_CONFIG = {
  fast: {
    id: process.env.MODEL_FAST || "claude-haiku-4.5",
    label: "Fast",
    description: "Claude Haiku cepat & ringan",
    vision: false,
    allowedForFree: true
  },
  balanced: {
    id: process.env.MODEL_BALANCED || "deepseek-3.2",
    label: "Balanced",
    description: "DeepSeek V3.2 serba guna & hemat",
    vision: false,
    allowedForFree: true
  },
  smart: {
    id: process.env.MODEL_SMART || "claude-sonnet-4.5",
    label: "Smart",
    description: "Claude Sonnet analisis kuat",
    vision: false,
    allowedForFree: false
  },
  coding: {
    id: process.env.MODEL_CODING || "qwen3-coder-next",
    label: "Coding",
    description: "Qwen 3 Coder coding & debug",
    vision: false,
    allowedForFree: false
  }
};

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    avatarUrl: user.avatarUrl,
    role: user.role,
    plan: user.plan,
    status: user.status,
    customDailyLimit: user.customDailyLimit,
    createdAt: user.createdAt
  };
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  return getAdminEmails().includes(String(email || "").toLowerCase());
}

function todayStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function dailyLimitForUser(user) {
  if (Number.isInteger(user.customDailyLimit) && user.customDailyLimit > 0) {
    return user.customDailyLimit;
  }

  if (user.role === "ADMIN") return Number(process.env.ADMIN_DAILY_LIMIT || 9999);
  return Number(process.env.FREE_DAILY_LIMIT || 20);
}

async function getUsage(userId) {
  const date = todayStart();

  return prisma.dailyUsage.upsert({
    where: {
      userId_date: {
        userId,
        date
      }
    },
    update: {},
    create: {
      userId,
      date,
      messageCount: 0,
      tokenCount: 0
    }
  });
}

async function usagePayload(user) {
  const usage = await getUsage(user.id);
  return {
    messageCount: usage.messageCount,
    tokenCount: usage.tokenCount,
    limit: dailyLimitForUser(user)
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Login dulu." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({ error: "User tidak ditemukan." });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "Akun kamu sedang disuspend. Hubungi admin." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session tidak valid. Login ulang." });
  }
}


function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin only." });
  }

  next();
}


function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function tokenHash(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function createVerificationToken(userId, type, minutes = 60) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hash = tokenHash(rawToken);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash: hash,
      type,
      expiresAt
    }
  });

  return rawToken;
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendMail({ to, subject, html, text }) {
  if (!hasSmtpConfig()) {
    console.log("\n================ EMAIL DEV MODE ================");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log(text || html);
    console.log("================================================\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Stb_Chatbot <noreply@stbchatbot.id>",
    to,
    subject,
    text,
    html
  });
}

async function sendVerificationEmail(user) {
  if (user.emailVerifiedAt) return;

  const rawToken = await createVerificationToken(user.id, "EMAIL_VERIFY", 24 * 60);
  const link = `${API_URL}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  await sendMail({
    to: user.email,
    subject: "Verify your Stb_Chatbot account",
    text: `Klik link ini untuk verifikasi akun Stb_Chatbot kamu:\n\n${link}\n\nLink berlaku 24 jam.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Verify Stb_Chatbot</h2>
        <p>Klik tombol di bawah untuk verifikasi akun kamu.</p>
        <p><a href="${link}" style="background:#ef4444;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Verify Email</a></p>
        <p>Link berlaku 24 jam.</p>
        <p>${link}</p>
      </div>
    `
  });
}

async function sendResetPasswordEmail(user) {
  const rawToken = await createVerificationToken(user.id, "RESET_PASSWORD", 60);
  const link = `${APP_URL}#/reset-password?token=${encodeURIComponent(rawToken)}`;

  await sendMail({
    to: user.email,
    subject: "Reset password Stb_Chatbot",
    text: `Klik link ini untuk reset password Stb_Chatbot kamu:\n\n${link}\n\nLink berlaku 1 jam.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Reset Password Stb_Chatbot</h2>
        <p>Klik tombol di bawah untuk reset password kamu.</p>
        <p><a href="${link}" style="background:#ef4444;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none">Reset Password</a></p>
        <p>Link berlaku 1 jam.</p>
        <p>${link}</p>
      </div>
    `
  });
}

function authRedirect(route) {
  const base = APP_URL.replace(/\/?$/, "/");
  const url = new URL(base);
  url.hash = route;
  return url;
}

function redirectAuthError(res, message) {
  const url = authRedirect("#/auth/callback");
  url.searchParams.set("error", message || "OAuth gagal.");
  return res.redirect(url.toString());
}

function createOAuthState(provider) {
  return jwt.sign(
    {
      type: "oauth",
      provider,
      nonce: crypto.randomBytes(12).toString("hex")
    },
    JWT_SECRET,
    {
      expiresIn: "10m"
    }
  );
}

function verifyOAuthState(rawState, provider) {
  const state = jwt.verify(rawState, JWT_SECRET);

  if (state.type !== "oauth" || state.provider !== provider) {
    throw new Error("OAuth state tidak valid.");
  }

  return state;
}

async function upsertOAuthUser({ provider, providerAccountId, email, emailVerified, name, avatarUrl, accessToken, refreshToken }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Provider tidak mengirim email.");
  }

  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: String(providerAccountId)
      }
    },
    include: {
      user: true
    }
  });

  if (existingAccount) {
    const updatedUser = await prisma.user.update({
      where: { id: existingAccount.userId },
      data: {
        name: name || existingAccount.user.name,
        avatarUrl: avatarUrl || existingAccount.user.avatarUrl,
        emailVerifiedAt: emailVerified && !existingAccount.user.emailVerifiedAt ? new Date() : existingAccount.user.emailVerifiedAt
      }
    });

    await prisma.oAuthAccount.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: accessToken || existingAccount.accessToken,
        refreshToken: refreshToken || existingAccount.refreshToken
      }
    });

    return updatedUser;
  }

  let user = await prisma.user.findFirst({
    where: { email: normalizedEmail }
  });

  if (!user) {
    const admin = isAdminEmail(normalizedEmail);
    const baseUsername = (name || normalizedEmail.split("@")[0])
      .toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
    let username = baseUsername;
    let attempt = 0;
    while (await prisma.user.findUnique({ where: { username } })) {
      attempt++;
      username = `${baseUsername}${attempt}`;
    }
    user = await prisma.user.create({
      data: {
        name: name || normalizedEmail.split("@")[0],
        username,
        email: normalizedEmail,
        passwordHash: null,
        avatarUrl: avatarUrl || null,
        emailVerifiedAt: emailVerified ? new Date() : null,
        role: admin ? "ADMIN" : "USER",
        plan: admin ? "ADMIN" : "FREE"
      }
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        avatarUrl: avatarUrl || user.avatarUrl,
        emailVerifiedAt: emailVerified && !user.emailVerifiedAt ? new Date() : user.emailVerifiedAt
      }
    });
  }

  await prisma.oAuthAccount.create({
    data: {
      userId: user.id,
      provider,
      providerAccountId: String(providerAccountId),
      accessToken: accessToken || null,
      refreshToken: refreshToken || null
    }
  });

  return user;
}

function sanitize(str) {
  return String(str || "").replace(/[<>]/g, "").trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeConversationTitle(text, hasFile, repoUrl) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (clean) return clean.slice(0, 42);
  if (repoUrl) return "Bahas GitHub repo";
  if (hasFile) return "Bahas dokumen";
  return "Chat baru";
}

function saveUploadForUser(userId, file) {
  const userDir = path.join(UPLOAD_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
  const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(userDir, safeName);

  fs.writeFileSync(fullPath, file.buffer);

  return {
    url: `/uploads/${userId}/${safeName}`,
    name: file.originalname,
    mime: file.mimetype
  };
}

function isImageFile(file) {
  return Boolean(file?.mimetype?.startsWith("image/"));
}

function isLikelyTextFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return [
    ".txt", ".md", ".markdown",
    ".js", ".jsx", ".ts", ".tsx",
    ".json", ".html", ".css", ".scss",
    ".py", ".java", ".go", ".rs", ".php", ".rb",
    ".vue", ".svelte", ".sql", ".prisma",
    ".yaml", ".yml", ".xml"
  ].includes(ext);
}

async function extractTextFromImage(file) {
  if (!file || process.env.ENABLE_IMAGE_OCR === "false") {
    return "";
  }

  let worker;

  try {
    worker = await createWorker("eng");
    const result = await worker.recognize(file.buffer);
    const text = String(result?.data?.text || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text.slice(0, 6000);
  } catch (error) {
    console.warn("OCR failed:", error.message);
    return "";
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

async function extractTextFromFile(file) {
  if (!file) return "";

  const ext = path.extname(file.originalname || "").toLowerCase();

  if (isImageFile(file)) {
    const ocrText = await extractTextFromImage(file);
    return ocrText
      ? [
          "=== OCR DARI GAMBAR ===",
          ocrText
        ].join("\n")
      : "";
  }

  if (isLikelyTextFile(file)) {
    return file.buffer.toString("utf8").slice(0, MAX_CONTEXT_CHARS);
  }

  if (ext === ".pdf") {
    try {
      const data = await pdfParse(file.buffer);
      return String(data.text || "").slice(0, MAX_CONTEXT_CHARS);
    } catch (error) {
      console.warn("PDF parse failed:", error.message);
      return "";
    }
  }

  if (ext === ".docx") {
    try {
      const data = await mammoth.extractRawText({ buffer: file.buffer });
      return String(data.value || "").slice(0, MAX_CONTEXT_CHARS);
    } catch (error) {
      console.warn("DOCX parse failed:", error.message);
      return "";
    }
  }

  return "";
}

function parseGitHubUrl(input) {
  const value = String(input || "").trim();
  if (!value) return null;

  let url;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (!["github.com", "www.github.com"].includes(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const owner = parts[0];
  const repo = parts[1]?.replace(/\.git$/, "");

  if (!owner || !repo) return null;

  let branch = "";
  let subPath = "";

  const treeIndex = parts.indexOf("tree");
  if (treeIndex >= 0 && parts[treeIndex + 1]) {
    branch = parts[treeIndex + 1];
    subPath = parts.slice(treeIndex + 2).join("/");
  }

  return {
    owner,
    repo,
    branch,
    subPath,
    url: `https://github.com/${owner}/${repo}`
  };
}

function shouldIncludeRepoFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const lowered = normalized.toLowerCase();

  const ignoredSegments = [
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    ".nuxt/",
    ".git/",
    "coverage/",
    "vendor/",
    "target/",
    "__pycache__/"
  ];

  if (ignoredSegments.some((segment) => lowered.includes(segment))) return false;

  const ignoredNames = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb"
  ];

  if (ignoredNames.some((name) => lowered.endsWith(name))) return false;

  const ext = path.extname(lowered);
  const allowedRepoExt = new Set([
    ".js", ".jsx", ".ts", ".tsx",
    ".json", ".html", ".css", ".scss",
    ".py", ".java", ".go", ".rs", ".php", ".rb",
    ".vue", ".svelte", ".sql", ".prisma",
    ".md", ".txt", ".yaml", ".yml", ".xml",
    ".env", ".example"
  ]);

  if (allowedRepoExt.has(ext)) return true;

  const base = path.basename(lowered);
  return [
    "package.json",
    "vite.config.js",
    "vite.config.ts",
    "next.config.js",
    "tailwind.config.js",
    "postcss.config.js",
    "dockerfile",
    "docker-compose.yml",
    ".env.example",
    "readme.md"
  ].includes(base);
}

async function fetchJson(url) {
  const headers = {
    "User-Agent": "Stb_Chatbot"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`GitHub request failed ${res.status}`);
  }

  return res.json();
}

async function fetchText(url) {
  const headers = {
    "User-Agent": "Stb_Chatbot"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`GitHub raw fetch failed ${res.status}`);
  }

  return res.text();
}

async function fetchGitHubRepoContext(repoUrl) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) return "";

  const repoMeta = await fetchJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
  const branch = parsed.branch || repoMeta.default_branch || "main";
  const tree = await fetchJson(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  let files = (tree.tree || [])
    .filter((item) => item.type === "blob")
    .filter((item) => !parsed.subPath || item.path.startsWith(`${parsed.subPath}/`) || item.path === parsed.subPath)
    .filter((item) => shouldIncludeRepoFile(item.path))
    .filter((item) => Number(item.size || 0) <= 250000);

  const priority = (filePath) => {
    const base = path.basename(filePath.toLowerCase());
    if (base === "readme.md") return 0;
    if (base === "package.json") return 1;
    if (filePath.includes("src/")) return 2;
    return 3;
  };

  files = files
    .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path))
    .slice(0, GITHUB_MAX_FILES);

  const chunks = [
    `=== GITHUB REPOSITORY CONTEXT ===`,
    `Repository: ${parsed.url}`,
    `Branch: ${branch}`,
    parsed.subPath ? `Subpath: ${parsed.subPath}` : "",
    `Files included: ${files.length}`,
    ""
  ].filter(Boolean);

  let totalChars = chunks.join("\n").length;

  for (const file of files) {
    if (totalChars >= MAX_CONTEXT_CHARS) break;

    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(branch)}/${file.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    try {
      const content = await fetchText(rawUrl);
      const sliced = content.slice(0, GITHUB_MAX_FILE_CHARS);
      const block = [
        `--- FILE: ${file.path} ---`,
        sliced,
        ""
      ].join("\n");

      chunks.push(block);
      totalChars += block.length;
    } catch (error) {
      chunks.push(`--- FILE: ${file.path} ---\n[Gagal fetch file: ${error.message}]\n`);
    }
  }

  return chunks.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

function buildContextText({ extractedFileText, repoContext }) {
  const blocks = [];

  if (extractedFileText) {
    blocks.push([
      "=== ATTACHED DOCUMENT / IMAGE TEXT ===",
      extractedFileText
    ].join("\n"));
  }

  if (repoContext) {
    blocks.push(repoContext);
  }

  return blocks.join("\n\n").slice(0, MAX_CONTEXT_CHARS);
}

function mapHistoryMessage(message) {
  let content = message.content;

  if (message.contextText) {
    content = [
      message.content,
      "",
      "Konteks yang pernah dilampirkan user pada pesan ini:",
      message.contextText
    ].join("\n");
  }

  return {
    role: message.role === "ASSISTANT" ? "assistant" : "user",
    content
  };
}

function buildImageAwareText(text, contextText) {
  const cleanText = String(text || "").trim() || "Tolong analisis lampiran ini.";

  if (!contextText) {
    return cleanText;
  }

  return [
    cleanText,
    "",
    "Gunakan konteks berikut untuk menjawab. Konteks ini berasal dari file, OCR screenshot, atau GitHub repo yang dilampirkan user.",
    "Jika konteks tidak cukup, bilang apa yang kurang. Jangan mengarang isi file/repo.",
    "",
    contextText
  ].join("\n");
}

function buildSystemPrompt() {
  return [
    "Kamu adalah Stb_Chatbot, chatbot publik multi-model.",
    "Jawab dengan jelas, berguna, dan tidak bertele-tele.",
    "Gunakan bahasa yang sama dengan user.",
    "Jika user bertanya dalam bahasa Indonesia santai, jawab santai tapi tetap rapi.",
    "Kamu bisa membantu vibe coding: memahami repo, debugging, membuat fitur, refactor, menjelaskan error, dan menyarankan struktur project.",
    "Saat memberi kode, SELALU gunakan Markdown fenced code block dengan bahasa yang sesuai, misalnya ```js, ```jsx, ```css, atau ```bash.",
    "Jangan gunakan format XML seperti <write_file>, <path>, <content>, atau tag pseudo-code lain.",
    "Untuk banyak file, tulis nama file sebagai heading singkat, lalu code block di bawahnya.",
    "Jangan mengklaim membaca file/repo jika konteks tidak tersedia.",
    "Jangan membantu tindakan ilegal, malware, pencurian data, bypass keamanan, atau penyalahgunaan sistem.",
    "Jika tidak yakin, jelaskan batasannya dengan jujur."
  ].join(" ");
}

async function callX5LabStream({ modelId, text, file, history, contextText, sendImageBlock, systemPrompt, temperature, maxTokens }) {
  if (!process.env.X5LAB_API_KEY) {
    throw new Error("X5LAB_API_KEY belum diisi di .env backend.");
  }

  const imageAwareText = buildImageAwareText(text, contextText);

  const userContent = sendImageBlock && file && isImageFile(file)
    ? [
        { type: "text", text: imageAwareText },
        { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` } }
      ]
    : imageAwareText;

  const messages = [
    { role: "system", content: systemPrompt || buildSystemPrompt() },
    ...history.map(mapHistoryMessage),
    { role: "user", content: userContent }
  ];

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        console.log(`Retry stream (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const response = await fetch("https://api.x5lab.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.X5LAB_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: temperature != null ? temperature : 0.7,
          max_tokens: maxTokens || MAX_OUTPUT_TOKENS,
          stream: true
        }),
        signal: AbortSignal.timeout(120000)
      });

      if (!response.ok) {
        const rawText = await response.text();
        let data;
        try { data = JSON.parse(rawText); } catch { data = null; }
        const detail = data?.error?.message || data?.error || rawText || `HTTP ${response.status}`;
        const isRetryable = [429, 500, 502, 503].includes(response.status) ||
          String(detail).includes("at capacity") ||
          String(detail).includes("E200");
        if (isRetryable && attempt < MAX_RETRIES) { continue; }
        const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        error.status = response.status;
        throw error;
      }

      return response.body;
    } catch (err) {
      if (err.name === "TimeoutError") {
        if (attempt < MAX_RETRIES) { continue; }
        throw new Error("AI provider timeout setelah beberapa percobaan.");
      }
      if (attempt >= MAX_RETRIES) throw err;
    }
  }
  throw new Error("AI provider gagal setelah retry.");
}

async function callX5Lab({ modelId, text, file, history, contextText, sendImageBlock, systemPrompt, temperature, maxTokens }) {
  if (!process.env.X5LAB_API_KEY) {
    throw new Error("X5LAB_API_KEY belum diisi di .env backend.");
  }

  const imageAwareText = buildImageAwareText(text, contextText);

  const userContent = sendImageBlock && file && isImageFile(file)
    ? [
        {
          type: "text",
          text: imageAwareText
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
          }
        }
      ]
    : imageAwareText;

  const messages = [
    {
      role: "system",
      content: systemPrompt || buildSystemPrompt()
    },
    ...history.map(mapHistoryMessage),
    {
      role: "user",
      content: userContent
    }
  ];

  const MAX_RETRIES = 2;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        console.log(`Retry X5Lab call (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const response = await fetch("https://api.x5lab.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.X5LAB_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: temperature != null ? temperature : 0.7,
          max_tokens: maxTokens || MAX_OUTPUT_TOKENS
        }),
        signal: AbortSignal.timeout(120000)
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const detail = data?.error?.message || data?.error || rawText || `HTTP ${response.status}`;
        const isRetryable = [429, 500, 502, 503].includes(response.status) ||
          String(detail).includes("at capacity") ||
          String(detail).includes("E200");
        if (isRetryable && attempt < MAX_RETRIES) {
          lastError = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
          lastError.status = response.status;
          continue;
        }
        const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        error.status = response.status;
        throw error;
      }

      if (!data?.choices?.[0]?.message?.content) {
        const bodyError = data?.error?.message || data?.error || "";
        if (bodyError) {
          const isRetryable = String(bodyError).includes("at capacity") || String(bodyError).includes("E200");
          if (isRetryable && attempt < MAX_RETRIES) {
            lastError = new Error(typeof bodyError === "string" ? bodyError : JSON.stringify(bodyError));
            continue;
          }
          const error = new Error(typeof bodyError === "string" ? bodyError : JSON.stringify(bodyError));
          error.status = 200;
          throw error;
        }
      }

      const answer = data?.choices?.[0]?.message?.content || "AI tidak mengirim jawaban.";
      const totalTokens = Number(data?.usage?.total_tokens || 0);

      return {
        answer,
        usage: data?.usage || null,
        totalTokens
      };
    } catch (err) {
      if (err.name === "TimeoutError") {
        if (attempt < MAX_RETRIES) { lastError = err; continue; }
        throw new Error("AI provider timeout setelah beberapa percobaan.");
      }
      throw err;
    }
  }
  throw lastError || new Error("AI provider gagal.");
}

app.get("/", (req, res) => {
  res.json({
    status: "Stb_Chatbot API running",
    endpoints: ["/api/auth/register", "/api/auth/login", "/api/auth/google", "/api/auth/github", "/api/me", "/api/chat", "/api/health"]
  });
});

app.get(["/health", "/api/health"], async (req, res) => {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      service: "Stb_Chatbot API",
      uptime: process.uptime(),
      database: "ok",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: "Stb_Chatbot API",
      database: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

let cachedModels = null;
let cachedModelsAt = 0;
const MODEL_CACHE_TTL = 60000;

app.get("/api/models", (req, res) => {
  const presets = Object.entries(MODEL_CONFIG).map(([key, value]) => ({
    key,
    label: value.label,
    description: value.description,
    vision: value.vision,
    allowedForFree: value.allowedForFree,
    modelId: value.id
  }));
  const allModels = FULL_MODEL_LIST.map(m => ({
    key: m.id,
    label: `${m.provider} ${m.label}`,
    description: m.provider,
    vision: m.vision || false,
    allowedForFree: true,
    modelId: m.id,
    provider: m.provider
  }));
  res.json({ presets, allModels });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = sanitize(String(req.body.name || ""));
    const username = String(req.body.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const email = String(req.body.email || "").trim().toLowerCase() || null;
    const password = String(req.body.password || "");

    if (!name || !username || !password) {
      return res.status(400).json({ error: "Nama, username, dan password wajib diisi." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Username minimal 3 karakter." });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return res.status(409).json({ error: "Username sudah terdaftar." });
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({ where: { email } });
      if (existingEmail) {
        return res.status(409).json({ error: "Email sudah terdaftar." });
      }
    }

    const admin = email ? isAdminEmail(email) : false;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        emailVerifiedAt: admin ? new Date() : null,
        role: admin ? "ADMIN" : "USER",
        plan: admin ? "ADMIN" : "FREE"
      }
    });

    if (!admin) {
      await sendVerificationEmail(user);
    }

    const token = createToken(user);

    res.status(201).json({
      token,
      user: publicUser(user),
      usage: await usagePayload(user),
      message: admin
        ? "Akun admin berhasil dibuat."
        : "Akun berhasil dibuat. Cek email untuk verifikasi. Kalau SMTP belum diset, link muncul di terminal backend."
    });
  } catch (error) {
    res.status(500).json({
      error: "Register gagal.",
      detail: error.message
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi." });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "Akun ini sedang disuspend." });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: "Akun ini dibuat dengan Google/GitHub. Login lewat provider tersebut." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    const token = createToken(user);

    res.json({
      token,
      user: publicUser(user),
      usage: await usagePayload(user)
    });
  } catch (error) {
    res.status(500).json({
      error: "Login gagal.",
      detail: error.message
    });
  }
});

app.get("/api/auth/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    return res.status(500).send("Google OAuth belum dikonfigurasi di .env. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_CALLBACK_URL.");
  }

  const state = createOAuthState("google");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", process.env.GOOGLE_CALLBACK_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");

    if (!code || !state) {
      return redirectAuthError(res, "Google callback tidak lengkap.");
    }

    verifyOAuthState(state, "google");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return redirectAuthError(res, tokenData.error_description || "Gagal exchange token Google.");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const profile = await profileRes.json();

    if (!profileRes.ok) {
      return redirectAuthError(res, "Gagal mengambil profile Google.");
    }

    const user = await upsertOAuthUser({
      provider: "google",
      providerAccountId: profile.sub,
      email: profile.email,
      emailVerified: Boolean(profile.email_verified),
      name: profile.name || profile.email,
      avatarUrl: profile.picture || null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    });

    const appToken = createToken(user);
    const url = authRedirect("#/auth/callback");
    url.searchParams.set("token", appToken);
    res.redirect(url.toString());
  } catch (error) {
    return redirectAuthError(res, error.message);
  }
});

app.get("/api/auth/github", (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CALLBACK_URL) {
    return res.status(500).send("GitHub OAuth belum dikonfigurasi di .env.");
  }

  const state = createOAuthState("github");
  const url = new URL("https://github.com/login/oauth/authorize");

  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", process.env.GITHUB_CALLBACK_URL);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/api/auth/github/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");

    if (!code || !state) {
      return redirectAuthError(res, "GitHub callback tidak lengkap.");
    }

    verifyOAuthState(state, "github");

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
        code
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      return redirectAuthError(res, tokenData.error_description || "Gagal exchange token GitHub.");
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "Stb_Chatbot"
      }
    });

    const ghUser = await userRes.json();

    if (!userRes.ok) {
      return redirectAuthError(res, "Gagal mengambil profile GitHub.");
    }

    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "Stb_Chatbot"
      }
    });

    const emails = emailRes.ok ? await emailRes.json() : [];
    const primary = Array.isArray(emails)
      ? emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified) || emails[0]
      : null;

    const email = primary?.email || ghUser.email;

    if (!email) {
      return redirectAuthError(res, "GitHub tidak mengirim email. Pastikan email GitHub bisa diakses.");
    }

    const user = await upsertOAuthUser({
      provider: "github",
      providerAccountId: ghUser.id,
      email,
      emailVerified: Boolean(primary?.verified || ghUser.email),
      name: ghUser.name || ghUser.login || email,
      avatarUrl: ghUser.avatar_url || null,
      accessToken: tokenData.access_token,
      refreshToken: null
    });

    const appToken = createToken(user);
    const url = authRedirect("#/auth/callback");
    url.searchParams.set("token", appToken);
    res.redirect(url.toString());
  } catch (error) {
    return redirectAuthError(res, error.message);
  }
});

app.post("/api/auth/verify-email/send", auth, async (req, res) => {
  try {
    if (req.user.emailVerifiedAt) {
      return res.json({ message: "Email sudah terverifikasi." });
    }

    await sendVerificationEmail(req.user);

    res.json({
      message: "Link verifikasi sudah dikirim. Kalau SMTP belum diset, cek terminal backend."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal mengirim email verifikasi.",
      detail: error.message
    });
  }
});

app.get("/api/auth/verify-email", async (req, res) => {
  try {
    const rawToken = String(req.query.token || "");

    if (!rawToken) {
      const url = authRedirect("#/auth/verified");
      url.searchParams.set("status", "error");
      url.searchParams.set("message", "Token kosong.");
      return res.redirect(url.toString());
    }

    const record = await prisma.verificationToken.findUnique({
      where: {
        tokenHash: tokenHash(rawToken)
      },
      include: {
        user: true
      }
    });

    if (!record || record.type !== "EMAIL_VERIFY" || record.usedAt || record.expiresAt < new Date()) {
      const url = authRedirect("#/auth/verified");
      url.searchParams.set("status", "error");
      url.searchParams.set("message", "Token verifikasi tidak valid atau sudah expired.");
      return res.redirect(url.toString());
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() }
      }),
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      })
    ]);

    const url = authRedirect("#/auth/verified");
    url.searchParams.set("status", "success");
    return res.redirect(url.toString());
  } catch (error) {
    const url = authRedirect("#/auth/verified");
    url.searchParams.set("status", "error");
    url.searchParams.set("message", error.message);
    return res.redirect(url.toString());
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email wajib diisi." });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      await sendResetPasswordEmail(user);
    }

    res.json({
      message: "Kalau email terdaftar, link reset password akan dikirim. Kalau SMTP belum diset, cek terminal backend."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal memproses reset password.",
      detail: error.message
    });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const rawToken = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (!rawToken || !password) {
      return res.status(400).json({ error: "Token dan password wajib diisi." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }

    const record = await prisma.verificationToken.findUnique({
      where: {
        tokenHash: tokenHash(rawToken)
      }
    });

    if (!record || record.type !== "RESET_PASSWORD" || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ error: "Token reset tidak valid atau expired." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          emailVerifiedAt: new Date()
        }
      }),
      prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      })
    ]);

    res.json({
      message: "Password berhasil direset. Silakan login."
    });
  } catch (error) {
    res.status(500).json({
      error: "Reset password gagal.",
      detail: error.message
    });
  }
});

app.get("/api/me", auth, async (req, res) => {
  res.json({
    user: publicUser(req.user),
    usage: await usagePayload(req.user)
  });
});


app.get("/api/account", auth, async (req, res) => {
  const accounts = await prisma.oAuthAccount.findMany({
    where: {
      userId: req.user.id
    },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  res.json({
    user: publicUser(req.user),
    usage: await usagePayload(req.user),
    accounts
  });
});


app.post("/api/account/avatar", auth, avatarUploadSingle, async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "File avatar wajib diupload." });
    }

    const saved = saveUploadForUser(req.user.id, file);

    const updated = await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        avatarUrl: saved.url
      }
    });

    res.json({
      user: publicUser(updated),
      avatarUrl: saved.url,
      message: "Foto profil berhasil diperbarui."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal upload foto profil.",
      detail: error.message
    });
  }
});

app.patch("/api/account/profile", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const avatarUrl = String(req.body.avatarUrl || "").trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Nama minimal 2 karakter." });
    }

    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
      return res.status(400).json({ error: "Avatar URL harus diawali http:// atau https://." });
    }

    const updated = await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        name,
        avatarUrl: avatarUrl || null
      }
    });

    res.json({
      user: publicUser(updated),
      message: "Profil berhasil diperbarui."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal update profil.",
      detail: error.message
    });
  }
});

app.post("/api/account/change-password", auth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password baru minimal 6 karakter." });
    }

    if (req.user.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Password lama wajib diisi." });
      }

      const match = await bcrypt.compare(currentPassword, req.user.passwordHash);

      if (!match) {
        return res.status(401).json({ error: "Password lama salah." });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: {
        id: req.user.id
      },
      data: {
        passwordHash
      }
    });

    res.json({
      message: req.user.passwordHash
        ? "Password berhasil diganti."
        : "Password berhasil dibuat untuk akun ini."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal ganti password.",
      detail: error.message
    });
  }
});

app.delete("/api/account", auth, async (req, res) => {
  try {
    await prisma.user.delete({
      where: {
        id: req.user.id
      }
    });

    res.json({
      ok: true,
      message: "Akun berhasil dihapus."
    });
  } catch (error) {
    res.status(500).json({
      error: "Gagal hapus akun.",
      detail: error.message
    });
  }
});


app.get("/api/conversations", auth, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      userId: req.user.id
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  res.json({
    conversations: conversations.map((item) => ({
      id: item.id,
      title: item.title,
      model: item.model,
      updatedAt: item.updatedAt,
      lastMessage: item.messages[0]?.content || ""
    }))
  });
});


app.patch("/api/conversations/:id", auth, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();

    if (!title || title.length > 80) {
      return res.status(400).json({ error: "Judul wajib diisi dan maksimal 80 karakter." });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation tidak ditemukan." });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title }
    });

    res.json({ conversation: updated });
  } catch (error) {
    res.status(500).json({ error: "Gagal rename chat.", detail: error.message });
  }
});

app.delete("/api/conversations", auth, async (req, res) => {
  try {
    const result = await prisma.conversation.deleteMany({
      where: {
        userId: req.user.id
      }
    });

    res.json({
      ok: true,
      deleted: result.count
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus semua chat.", detail: error.message });
  }
});

app.post("/api/conversations/:id/regenerate", auth, async (req, res) => {
  try {
    const selectedKey = String(req.body.model || "balanced").trim();
    const model = getModelConfig(selectedKey);

    if (!model) {
      return res.status(400).json({ error: "Model tidak valid." });
    }

    if (req.user.role !== "ADMIN" && !model.allowedForFree) {
      return res.status(403).json({ error: "Model ini khusus admin dulu." });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation tidak ditemukan." });
    }

    const allMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" }
    });

    const lastUserMessage = [...allMessages].reverse().find((item) => item.role === "USER");

    if (!lastUserMessage) {
      return res.status(400).json({ error: "Tidak ada pesan user untuk regenerate." });
    }

    const usage = await getUsage(req.user.id);
    const limit = dailyLimitForUser(req.user);

    if (usage.messageCount >= limit) {
      return res.status(429).json({
        error: `Limit harian tercapai. Limit kamu ${limit} chat/hari.`,
        usage: {
          messageCount: usage.messageCount,
          tokenCount: usage.tokenCount,
          limit
        }
      });
    }

    const history = allMessages
      .filter((item) => item.createdAt < lastUserMessage.createdAt)
      .slice(-10);

    const aiResult = await callX5Lab({
      modelId: model.id,
      text: lastUserMessage.content,
      file: null,
      history,
      contextText: lastUserMessage.contextText || "",
      sendImageBlock: false
    });

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: req.user.id,
        role: "ASSISTANT",
        content: aiResult.answer,
        model: selectedKey
      }
    });

    const updatedUsage = await prisma.dailyUsage.update({
      where: {
        userId_date: {
          userId: req.user.id,
          date: todayStart()
        }
      },
      data: {
        messageCount: { increment: 1 },
        tokenCount: { increment: aiResult.totalTokens || 0 }
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { model: selectedKey, updatedAt: new Date() }
    });

    res.json({
      assistantMessage,
      usage: {
        messageCount: updatedUsage.messageCount,
        tokenCount: updatedUsage.tokenCount,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Regenerate gagal.", detail: error.message });
  }
});

app.get("/api/admin/stats", auth, adminOnly, async (req, res) => {
  try {
    const [users, conversations, messages, usageRows] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.dailyUsage.findMany({
        where: {
          date: todayStart()
        }
      })
    ]);

    const todayChats = usageRows.reduce((sum, item) => sum + item.messageCount, 0);
    const todayTokens = usageRows.reduce((sum, item) => sum + item.tokenCount, 0);

    const [activeUsers, suspendedUsers] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } })
    ]);

    res.json({
      users,
      activeUsers,
      suspendedUsers,
      conversations,
      messages,
      todayChats,
      todayTokens
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal load admin stats.", detail: error.message });
  }
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      include: {
        dailyUsages: {
          where: { date: todayStart() },
          take: 1
        },
        _count: {
          select: {
            conversations: true,
            messages: true
          }
        }
      }
    });

    res.json({
      users: users.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role,
        plan: item.plan,
        status: item.status,
        customDailyLimit: item.customDailyLimit,
        avatarUrl: item.avatarUrl,
        emailVerifiedAt: item.emailVerifiedAt,
        createdAt: item.createdAt,
        todayUsage: item.dailyUsages[0] || { messageCount: 0, tokenCount: 0 },
        counts: item._count
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal load users.", detail: error.message });
  }
});

app.patch("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const data = {};

    if (typeof req.body.role !== "undefined") {
      const role = String(req.body.role || "").toUpperCase();
      if (!["USER", "ADMIN"].includes(role)) {
        return res.status(400).json({ error: "Role tidak valid." });
      }
      data.role = role;
      data.plan = role === "ADMIN" ? "ADMIN" : "FREE";
    }

    if (typeof req.body.plan !== "undefined") {
      const plan = String(req.body.plan || "").toUpperCase();
      if (!["FREE", "ADMIN"].includes(plan)) {
        return res.status(400).json({ error: "Plan tidak valid." });
      }
      data.plan = plan;
    }

    if (typeof req.body.status !== "undefined") {
      const status = String(req.body.status || "").toUpperCase();
      if (!["ACTIVE", "SUSPENDED"].includes(status)) {
        return res.status(400).json({ error: "Status tidak valid." });
      }

      if (req.params.id === req.user.id && status === "SUSPENDED") {
        return res.status(400).json({ error: "Admin tidak bisa suspend akun sendiri." });
      }

      data.status = status;
    }

    if (typeof req.body.customDailyLimit !== "undefined") {
      const rawLimit = req.body.customDailyLimit;
      const customDailyLimit = rawLimit === "" || rawLimit === null ? null : Number(rawLimit);

      if (customDailyLimit !== null && (!Number.isInteger(customDailyLimit) || customDailyLimit < 1 || customDailyLimit > 100000)) {
        return res.status(400).json({ error: "Custom limit harus angka 1 sampai 100000." });
      }

      data.customDailyLimit = customDailyLimit;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Tidak ada field yang diubah." });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data
    });

    res.json({ user: publicUser(updated) });
  } catch (error) {
    res.status(500).json({ error: "Gagal update user.", detail: error.message });
  }
});

app.post("/api/admin/users/:id/reset-usage", auth, adminOnly, async (req, res) => {
  try {
    await prisma.dailyUsage.upsert({
      where: {
        userId_date: {
          userId: req.params.id,
          date: todayStart()
        }
      },
      update: {
        messageCount: 0,
        tokenCount: 0
      },
      create: {
        userId: req.params.id,
        date: todayStart(),
        messageCount: 0,
        tokenCount: 0
      }
    });

    res.json({ ok: true, message: "Usage hari ini berhasil direset." });
  } catch (error) {
    res.status(500).json({ error: "Gagal reset usage.", detail: error.message });
  }
});


app.get("/api/conversations/:id/messages", auth, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation tidak ditemukan." });
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  res.json({
    conversation,
    messages
  });
});

app.delete("/api/conversations/:id", auth, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id
    }
  });

  if (!conversation) {
    return res.status(404).json({ error: "Conversation tidak ditemukan." });
  }

  await prisma.conversation.delete({
    where: {
      id: conversation.id
    }
  });

  res.json({
    ok: true
  });
});

app.post("/api/chat", auth, uploadSingle, async (req, res) => {
  try {
    if (!req.user.emailVerifiedAt && req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Verifikasi email dulu sebelum memakai chatbot. Klik tombol resend verification di sidebar."
      });
    }

    const text = String(req.body.message || "").trim();
    const selectedKey = String(req.body.model || "balanced").trim();
    const conversationId = String(req.body.conversationId || "").trim();
    const repoUrl = String(req.body.repoUrl || "").trim();
    const file = req.file || null;

    if (repoUrl) {
      const repoScanCount = await prisma.message.count({
        where: {
          userId: req.user.id,
          repoUrl: { not: null },
          createdAt: { gte: todayStart() }
        }
      });

      if (repoScanCount >= DAILY_REPO_SCAN_LIMIT) {
        return res.status(429).json({
          error: `Limit scan GitHub repo harian tercapai. Limit kamu ${DAILY_REPO_SCAN_LIMIT} repo/hari.`
        });
      }
    }

    if (file) {
      const uploadCount = await prisma.message.count({
        where: {
          userId: req.user.id,
          attachmentUrl: { not: null },
          createdAt: { gte: todayStart() }
        }
      });

      if (uploadCount >= DAILY_UPLOAD_LIMIT) {
        return res.status(429).json({
          error: `Limit upload file harian tercapai. Limit kamu ${DAILY_UPLOAD_LIMIT} file/hari.`
        });
      }
    }

    if (!text && !file && !repoUrl) {
      return res.status(400).json({
        error: "Pesan, file, atau GitHub repo tidak boleh kosong."
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: "Pesan terlalu panjang. Maksimal 5000 karakter."
      });
    }

    const model = getModelConfig(selectedKey);

    if (!model) {
      return res.status(400).json({
        error: "Model tidak valid."
      });
    }

    if (req.user.role !== "ADMIN" && !model.allowedForFree) {
      return res.status(403).json({
        error: "Model ini khusus admin dulu."
      });
    }

    const usage = await getUsage(req.user.id);
    const limit = dailyLimitForUser(req.user);

    if (usage.messageCount >= limit) {
      return res.status(429).json({
        error: `Limit harian tercapai. Limit kamu ${limit} chat/hari.`,
        usage: {
          messageCount: usage.messageCount,
          tokenCount: usage.tokenCount,
          limit
        }
      });
    }

    let conversation;

    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: req.user.id
        }
      });

      if (!conversation) {
        return res.status(404).json({
          error: "Conversation tidak ditemukan."
        });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          title: makeConversationTitle(text, Boolean(file), repoUrl),
          userId: req.user.id,
          model: selectedKey
        }
      });
    }

    const history = await prisma.message.findMany({
      where: {
        conversationId: conversation.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    const orderedHistory = history.reverse();

    const savedFile = file ? saveUploadForUser(req.user.id, file) : null;

    let extractedFileText = "";
    if (file) {
      extractedFileText = await extractTextFromFile(file);
    }

    let repoContext = "";
    if (repoUrl) {
      try {
        repoContext = await fetchGitHubRepoContext(repoUrl);
      } catch (error) {
        repoContext = `Gagal mengambil GitHub repo dari URL ${repoUrl}: ${error.message}`;
      }
    }

    const contextText = buildContextText({
      extractedFileText,
      repoContext
    });

    const estimatedInputTokens = estimateTokens(`${text}\n${contextText}`);

    if (estimatedInputTokens > MAX_INPUT_TOKENS_PER_REQUEST) {
      return res.status(413).json({
        error: `Context terlalu besar (${estimatedInputTokens} estimasi token). Maksimal ${MAX_INPUT_TOKENS_PER_REQUEST} token/request. Kurangi file/repo/prompt.`
      });
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: req.user.id,
        role: "USER",
        content: text || (repoUrl ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."),
        model: selectedKey,
        attachmentUrl: savedFile?.url || null,
        attachmentName: savedFile?.name || null,
        attachmentMime: savedFile?.mime || null,
        repoUrl: repoUrl || null,
        contextText: contextText || null
      }
    });

    let aiResult;
    let usedModelId = model.id;

    for (let fb = 0; fb <= FALLBACK_CHAIN.length; fb++) {
      try {
        aiResult = await callX5Lab({
          modelId: usedModelId,
          text: text || (repoUrl ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."),
          file,
          history: orderedHistory,
          contextText,
          sendImageBlock: Boolean(model.vision && file && isImageFile(file)),
          systemPrompt: req.body.systemPrompt,
          temperature: req.body.temperature,
          maxTokens: req.body.maxTokens
        });
        break;
      } catch (error) {
        const isCapacity = String(error.message || "").includes("at capacity") || String(error.message || "").includes("E200");
        if (isCapacity && fb < FALLBACK_CHAIN.length) {
          const nextId = FALLBACK_CHAIN[fb];
          if (nextId === usedModelId) continue;
          usedModelId = nextId;
          console.log(`Fallback to model: ${usedModelId}`);
          continue;
        }
        const status = error.status || 500;
        const detail = error.message || "Gagal menghubungi AI provider.";

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            userId: req.user.id,
            role: "ASSISTANT",
            content:
              status === 402
                ? "Token AI sedang habis."
                : `AI provider error: ${detail}`,
            model: selectedKey
          }
        });

        return res.status(status >= 400 && status < 600 ? status : 500).json({
          error: assistantMessage.content,
          conversation,
          userMessage,
          assistantMessage,
          usage: {
            messageCount: usage.messageCount,
            tokenCount: usage.tokenCount,
            limit
          }
        });
      }
    }

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: req.user.id,
        role: "ASSISTANT",
        content: aiResult.answer,
        model: selectedKey
      }
    });

    const contextTokenEstimate = Math.ceil((contextText || "").length / 4);
    const updatedUsage = await prisma.dailyUsage.update({
      where: {
        userId_date: {
          userId: req.user.id,
          date: todayStart()
        }
      },
      data: {
        messageCount: {
          increment: 1
        },
        tokenCount: {
          increment: aiResult.totalTokens || contextTokenEstimate
        }
      }
    });

    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversation.id
      },
      data: {
        model: selectedKey,
        updatedAt: new Date()
      }
    });

    res.json({
      conversation: updatedConversation,
      userMessage: {
        ...userMessage,
        contextText: undefined
      },
      assistantMessage,
      answer: assistantMessage.content,
      providerUsage: aiResult.usage,
      usage: {
        messageCount: updatedUsage.messageCount,
        tokenCount: updatedUsage.tokenCount,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error.",
      detail: error.message
    });
  }
});

app.post("/api/chat/stream", auth, uploadSingle, async (req, res) => {
  try {
    if (!req.user.emailVerifiedAt && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Verifikasi email dulu." });
    }

    const text = String(req.body.message || "").trim();
    const selectedKey = String(req.body.model || "balanced").trim();
    const conversationId = String(req.body.conversationId || "").trim();
    const repoUrl = String(req.body.repoUrl || "").trim();
    const file = req.file || null;

    if (!text && !file && !repoUrl) {
      return res.status(400).json({ error: "Pesan, file, atau GitHub repo tidak boleh kosong." });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: "Pesan terlalu panjang. Maksimal 5000 karakter." });
    }

    const model = getModelConfig(selectedKey);
    if (!model) return res.status(400).json({ error: "Model tidak valid." });

    if (req.user.role !== "ADMIN" && !model.allowedForFree) {
      return res.status(403).json({ error: "Model ini khusus admin dulu." });
    }

    const usage = await getUsage(req.user.id);
    const limit = dailyLimitForUser(req.user);

    if (usage.messageCount >= limit) {
      return res.status(429).json({
        error: `Limit harian tercapai. Limit kamu ${limit} chat/hari.`,
        usage: { messageCount: usage.messageCount, tokenCount: usage.tokenCount, limit }
      });
    }

    if (repoUrl) {
      const repoScanCount = await prisma.message.count({
        where: { userId: req.user.id, repoUrl: { not: null }, createdAt: { gte: todayStart() } }
      });
      if (repoScanCount >= DAILY_REPO_SCAN_LIMIT) {
        return res.status(429).json({ error: `Limit scan GitHub repo harian tercapai. Limit kamu ${DAILY_REPO_SCAN_LIMIT} repo/hari.` });
      }
    }

    if (file) {
      const uploadCount = await prisma.message.count({
        where: { userId: req.user.id, attachmentUrl: { not: null }, createdAt: { gte: todayStart() } }
      });
      if (uploadCount >= DAILY_UPLOAD_LIMIT) {
        return res.status(429).json({ error: `Limit upload file harian tercapai. Limit kamu ${DAILY_UPLOAD_LIMIT} file/hari.` });
      }
    }

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId: req.user.id } });
      if (!conversation) return res.status(404).json({ error: "Conversation tidak ditemukan." });
    } else {
      conversation = await prisma.conversation.create({
        data: { title: makeConversationTitle(text, Boolean(file), repoUrl), userId: req.user.id, model: selectedKey }
      });
    }

    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    const orderedHistory = history.reverse();

    const savedFile = file ? saveUploadForUser(req.user.id, file) : null;

    let extractedFileText = "";
    if (file) extractedFileText = await extractTextFromFile(file);

    let repoContext = "";
    if (repoUrl) {
      try { repoContext = await fetchGitHubRepoContext(repoUrl); }
      catch (error) { repoContext = `Gagal mengambil GitHub repo dari URL ${repoUrl}: ${error.message}`; }
    }

    const contextText = buildContextText({ extractedFileText, repoContext });

    const estimatedInputTokens = estimateTokens(`${text}\n${contextText}`);
    if (estimatedInputTokens > MAX_INPUT_TOKENS_PER_REQUEST) {
      return res.status(413).json({
        error: `Context terlalu besar (${estimatedInputTokens} estimasi token). Maksimal ${MAX_INPUT_TOKENS_PER_REQUEST} token/request.`
      });
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: req.user.id,
        role: "USER",
        content: text || (repoUrl ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."),
        model: selectedKey,
        attachmentUrl: savedFile?.url || null,
        attachmentName: savedFile?.name || null,
        attachmentMime: savedFile?.mime || null,
        repoUrl: repoUrl || null,
        contextText: contextText || null
      }
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent("meta", {
      conversation: { id: conversation.id, title: conversation.title, model: selectedKey, updatedAt: conversation.updatedAt },
      userMessage: { ...userMessage, contextText: undefined },
      usage: { messageCount: usage.messageCount + 1, tokenCount: usage.tokenCount, limit }
    });

    let fullContent = "";

    try {
      const stream = await callX5LabStream({
        modelId: model.id,
        text: text || (repoUrl ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."),
        file,
        history: orderedHistory,
        contextText,
        sendImageBlock: Boolean(model.vision && file && isImageFile(file))
      });
    } catch (error) {
      const errorMsg = error.message || "Stream error";
      sendEvent("error", { error: errorMsg });
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error.", detail: error.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== "production";
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (isDev) console.error(err.stack);
  res.status(status).json({
    error: status === 500 && !isDev ? "Server error." : err.message,
    ...(isDev && { detail: err.stack })
  });
});

async function seedDefaultUser() {
  try {
    const username = "yudhagt";
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      console.log(`Default user '${username}' already exists.`);
      return;
    }
    const passwordHash = await bcrypt.hash("123", 10);
    await prisma.user.create({
      data: {
        name: "Yudha GT",
        username,
        email: null,
        passwordHash,
        emailVerifiedAt: new Date(),
        role: "ADMIN",
        plan: "ADMIN"
      }
    });
    console.log(`Default user '${username}' created (pass: 123).`);
  } catch (err) {
    console.error("Seed user failed:", err.message);
  }
}

const serverInstance = app.listen(PORT, async () => {
  await seedDefaultUser();
  console.log(`Stb_Chatbot API running on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  serverInstance.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
