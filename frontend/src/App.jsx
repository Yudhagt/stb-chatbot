import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  User,
  Send,
  Paperclip,
  X,
  Plus,
  LogOut,
  Zap,
  Sparkles,
  Brain,
  Code2,
  Menu,
  Trash2,
  Search,
  ShieldCheck,
  Github,
  FileText,
  MailCheck,
  Settings,
  UserRound,
  LockKeyhole,
  Link as LinkIcon,
  BadgeCheck,
  AlertTriangle,
  Copy,
  Check,
  Pencil,
  RotateCcw,
  BarChart3,
  Activity
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "";

const MODEL_PRESETS = [
  { key: "fast",    label: "Fast",     desc: "Claude Haiku cepat & ringan",    icon: Zap,     vision: false, free: true },
  { key: "balanced",label: "Balanced", desc: "DeepSeek V3 serba guna & hemat", icon: Sparkles,vision: false, free: true },
  { key: "smart",   label: "Smart",    desc: "Claude Sonnet analisis kuat",    icon: Brain,   vision: false, free: false },
  { key: "coding",  label: "Coding",   desc: "GPT-5.3 Codex coding & debug",   icon: Code2,   vision: false, free: false }
];

const ALL_MODELS = [
  { group: "Claude",   icon: Brain,    color: "#d97706", models: [
    { id: "claude-opus-4.6",    label: "Opus 4.6",   vision: false },
    { id: "claude-sonnet-4.5",  label: "Sonnet 4.5", vision: false },
    { id: "claude-sonnet-4",    label: "Sonnet 4",   vision: false },
    { id: "claude-haiku-4.5",   label: "Haiku 4.5",  vision: false }
  ]},
  { group: "OpenAI",   icon: Zap,      color: "#10a37f", models: [
    { id: "gpt-5.5",            label: "GPT-5.5",          vision: false },
    { id: "gpt-5.4",            label: "GPT-5.4",          vision: false },
    { id: "gpt-5.3-codex",      label: "GPT-5.3 Codex",   vision: false },
    { id: "gpt-5.2",            label: "GPT-5.2",          vision: false },
    { id: "gpt-5.1",            label: "GPT-5.1",          vision: false },
    { id: "gpt-5.1-codex",      label: "GPT-5.1 Codex",   vision: false },
    { id: "gpt-5.1-codex-max",  label: "GPT-5.1 Codex Max", vision: false },
    { id: "gpt-4o",             label: "GPT-4o",           vision: false }
  ]},
  { group: "Gemini",   icon: Sparkles, color: "#8b5cf6", models: [
    { id: "gemini-3.1-pro",         label: "3.1 Pro",       vision: false },
    { id: "gemini-3.1-flash-lite",  label: "3.1 Flash Lite",vision: false },
    { id: "gemini-3.0-pro",         label: "3.0 Pro",       vision: false },
    { id: "gemini-3.0-flash",       label: "3.0 Flash",     vision: false },
    { id: "gemini-2.5-pro",         label: "2.5 Pro",       vision: false },
    { id: "gemini-2.5-flash",       label: "2.5 Flash",     vision: false }
  ]},
  { group: "DeepSeek", icon: Code2,    color: "#06b6d4", models: [
    { id: "deepseek-v3", label: "DeepSeek V3", vision: false }
  ]},
  { group: "Qwen",     icon: Bot,      color: "#f472b6", models: [
    { id: "qwen3-coder-next", label: "Qwen 3 Coder", vision: false }
  ]},
  { group: "Moonshot", icon: Bot,      color: "#a78bfa", models: [
    { id: "kimi-k2.5", label: "Kimi K2.5", vision: false }
  ]},
  { group: "MiniMax",  icon: Bot,      color: "#f59e0b", models: [
    { id: "minimax-m2.5", label: "MiniMax M2.5", vision: false }
  ]},
  { group: "GLM",      icon: Bot,      color: "#34d399", models: [
    { id: "glm-5", label: "GLM-5", vision: false }
  ]}
];

function apiUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}


function guessLangFromPath(filePath = "") {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const map = {
    js: "js",
    jsx: "jsx",
    ts: "ts",
    tsx: "tsx",
    css: "css",
    html: "html",
    json: "json",
    py: "python",
    java: "java",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    sql: "sql",
    prisma: "prisma",
    yml: "yaml",
    yaml: "yaml",
    md: "markdown",
    sh: "bash"
  };

  return map[ext] || "";
}

function normalizeAiMarkdown(content = "") {
  let text = String(content || "");

  // Convert common pseudo XML code output into readable Markdown.
  text = text.replace(
    /<write_file>\s*<path>([\s\S]*?)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_file>/g,
    (_, rawPath, rawCode) => {
      const filePath = rawPath.trim();
      const code = rawCode
        .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
        .replace(/```$/, "")
        .trim();
      const lang = guessLangFromPath(filePath);
      return `\n\n### \`${filePath}\`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }
  );

  text = text.replace(
    /<file>\s*<path>([\s\S]*?)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/file>/g,
    (_, rawPath, rawCode) => {
      const filePath = rawPath.trim();
      const code = rawCode.trim();
      const lang = guessLangFromPath(filePath);
      return `\n\n### \`${filePath}\`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }
  );

  return text;
}

function copyFallback(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text || "";
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {}
}

function CodeBlock({ inline, className, children, ...props }) {
  const codeText = String(children || "").replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  function copyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(codeText).catch(() => copyFallback(codeText));
      } else {
        copyFallback(codeText);
      }
    } catch {}
  }

  return (
    <div className="code-shell">
      <div className="code-header">
        <span>{match?.[1] || "code"}</span>
        <button type="button" onClick={copyCode}>Copy code</button>
      </div>
      <pre className={className}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short"
  });
}

export default function App() {
  const [screen, setScreen] = useState("boot");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [form, setForm] = useState({ name: "", username: "", password: "", email: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  const [token, setToken] = useState(localStorage.getItem("um_token") || "");
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState(localStorage.getItem("um_default_model") || "balanced");

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoOpen, setRepoOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("account");
  const [accountData, setAccountData] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: "", avatarUrl: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [modelSwitchOpen, setModelSwitchOpen] = useState(false);
  const modelSwitchRef = useRef(null);
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const bottomRef = useRef(null);

  const isAdmin = user?.role === "ADMIN";
  const emailVerified = Boolean(user?.emailVerifiedAt || isAdmin);

  const activeModel = useMemo(() => {
    const preset = MODEL_PRESETS.find((item) => item.key === model);
    if (preset) return preset;
    for (const g of ALL_MODELS) {
      const m = g.models.find(x => x.id === model);
      if (m) return { key: m.id, label: g.group, desc: m.label, icon: g.icon, vision: m.vision || false, free: true };
    }
    return MODEL_PRESETS[1];
  }, [model]);

  const visibleConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((item) =>
      item.title.toLowerCase().includes(keyword)
    );
  }, [conversations, search]);

  useEffect(() => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const basePath = import.meta.env.BASE_URL || "/";

    if (hash.startsWith("#/auth/callback")) {
      const oauthToken = searchParams.get("token");
      const error = searchParams.get("error");

      window.history.replaceState({}, "", basePath);

      if (oauthToken) {
        localStorage.setItem("um_token", oauthToken);
        setToken(oauthToken);
        bootstrap(oauthToken);
        return;
      }

      setAuthMessage(error || "OAuth gagal.");
      setScreen("auth");
      return;
    }

    if (hash.startsWith("#/auth/verified")) {
      const status = searchParams.get("status");
      const message = searchParams.get("message");

      window.history.replaceState({}, "", basePath);
      setAuthMessage(
        status === "success"
          ? "Email berhasil diverifikasi. Silakan login atau lanjutkan sesi."
          : message || "Verifikasi email gagal."
      );
      setScreen("auth");
      return;
    }

    if (hash.startsWith("#/reset-password")) {
      const tokenParam = searchParams.get("token") || "";
      window.history.replaceState({}, "", basePath);
      setResetToken(tokenParam);
      setScreen("reset");
      return;
    }

    bootstrap(token);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!modelSwitchOpen) return;
    function handleClick(e) {
      if (modelSwitchRef.current && !modelSwitchRef.current.contains(e.target)) {
        setModelSwitchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelSwitchOpen]);

  async function bootstrap(activeToken = token) {
    if (!activeToken) {
      setScreen("auth");
      return;
    }

    try {
      const me = await fetch(`${API_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${activeToken}`
        }
      });

      if (!me.ok) throw new Error("Invalid token");

      const data = await me.json();
      setUser(data.user);
      setUsage(data.usage);
      setScreen("chat");
      await loadConversations(activeToken);
    } catch {
      localStorage.removeItem("um_token");
      setToken("");
      setScreen("auth");
    }
  }

  async function loadConversations(activeToken = token) {
    const res = await fetch(`${API_URL}/api/conversations`, {
      headers: {
        Authorization: `Bearer ${activeToken}`
      }
    });

    if (!res.ok) return;

    const data = await res.json();
    setConversations(data.conversations || []);
  }

  async function loadConversation(conversationId) {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = "Gagal membuka chat.";
        try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
        alert(msg);
        return;
      }

      const data = await res.json();
      setActiveConversation(data.conversation);
      setMessages(data.messages || []);
      setModel(data.conversation.model || localStorage.getItem("um_default_model") || "balanced");
      setSidebarOpen(window.innerWidth > 860);
    } catch {
      alert("Gagal terhubung ke server.");
    }
  }

  async function deleteConversation(e, conversationId) {
    e.stopPropagation();

    const ok = confirm("Hapus chat ini?");
    if (!ok) return;

    const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      alert("Gagal hapus chat.");
      return;
    }

    if (activeConversation?.id === conversationId) {
      newChat();
    }

    setConversations((prev) => prev.filter((item) => item.id !== conversationId));
  }

  async function handleAuth(event) {
    event.preventDefault();

    if (authMode === "forgot") {
      return handleForgotPassword();
    }

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Auth gagal.");
        return;
      }

      localStorage.setItem("um_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setUsage(data.usage);
      setAuthMessage(data.message || "");
      setScreen("chat");
      await loadConversations(data.token);
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function handleForgotPassword() {
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal memproses reset password.");
        return;
      }

      setAuthMessage(data.message);
      setAuthMode("login");
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Reset password gagal.");
        return;
      }

      setAuthMessage(data.message || "Password berhasil direset.");
      setScreen("auth");
      setAuthMode("login");
      setResetPassword("");
      setResetToken("");
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  function oauthLogin(provider) {
    window.location.href = `${API_URL}/api/auth/${provider}`;
  }

  async function resendVerification() {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal kirim email verifikasi.");
        return;
      }

      alert(data.message || "Email verifikasi dikirim.");
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function openSettings(tab = "account") {
    setSettingsOpen(true);
    setSettingsTab(tab);
    setSettingsMessage("");

    if (tab === "admin") {
      setTimeout(() => loadAdminDashboard(), 0);
    }

    try {
      const res = await fetch(`${API_URL}/api/account`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal load account.");
        return;
      }

      setAccountData(data);
      setProfileForm({
        name: data.user?.name || "",
        avatarUrl: data.user?.avatarUrl || ""
      });
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }


  async function uploadAvatar(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Foto profil harus JPG, PNG, atau WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran foto profil maksimal 2 MB.");
      event.target.value = "";
      return;
    }

    setSettingsMessage("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch(`${API_URL}/api/account/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        setSettingsMessage(data.error || "Gagal upload foto profil.");
        return;
      }

      setUser(data.user);
      setAccountData((prev) => ({ ...prev, user: data.user }));
      setProfileForm((prev) => ({ ...prev, avatarUrl: data.user.avatarUrl || "" }));
      setSettingsMessage(data.message || "Foto profil berhasil diperbarui.");
    } catch {
      setSettingsMessage("Backend belum bisa dihubungi.");
    } finally {
      event.target.value = "";
    }
  }

  async function updateProfile(event) {
    event.preventDefault();
    setSettingsMessage("");

    try {
      const res = await fetch(`${API_URL}/api/account/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profileForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setSettingsMessage(data.error || "Gagal update profil.");
        return;
      }

      setUser(data.user);
      setAccountData((prev) => ({ ...prev, user: data.user }));
      setSettingsMessage(data.message || "Profil berhasil diperbarui.");
    } catch {
      setSettingsMessage("Backend belum bisa dihubungi.");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setSettingsMessage("");

    try {
      const res = await fetch(`${API_URL}/api/account/change-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(passwordForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setSettingsMessage(data.error || "Gagal ganti password.");
        return;
      }

      setPasswordForm({ currentPassword: "", newPassword: "" });
      setSettingsMessage(data.message || "Password berhasil diganti.");
    } catch {
      setSettingsMessage("Backend belum bisa dihubungi.");
    }
  }

  async function deleteAccount() {
    const ok = confirm("Yakin hapus akun? Semua chat history akan ikut hilang.");
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/api/account`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal hapus akun.");
        return;
      }

      alert(data.message || "Akun dihapus.");
      logout();
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }


  function copyText(id, text) {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text || "").then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(""), 1200);
        }).catch(() => { copyFallback(text); setCopiedId(id); setTimeout(() => setCopiedId(""), 1200); });
      } else {
        copyFallback(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(""), 1200);
      }
    } catch {
      copyFallback(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1200);
    }
  }

  async function renameConversation(conversationId, currentTitle) {
    const title = prompt("Rename chat:", currentTitle || "");

    if (!title) return;

    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal rename chat.");
        return;
      }

      setConversations((prev) =>
        prev.map((item) =>
          item.id === conversationId ? { ...item, title: data.conversation.title } : item
        )
      );

      if (activeConversation?.id === conversationId) {
        setActiveConversation(data.conversation);
      }
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function deleteAllChats() {
    const ok = confirm("Hapus semua chat history?");
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal hapus semua chat.");
        return;
      }

      setConversations([]);
      newChat();
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function regenerateResponse() {
    if (!activeConversation?.id || sending) return;

    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/conversations/${activeConversation.id}/regenerate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Regenerate gagal.");
        return;
      }

      setMessages((prev) => [...prev.slice(0, -1), data.assistantMessage]);
      setUsage(data.usage || usage);
      await loadConversations();
    } catch {
      alert("Backend belum bisa dihubungi.");
    } finally {
      setSending(false);
    }
  }

  async function loadAdminDashboard() {
    if (!isAdmin) return;

    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const stats = await statsRes.json();
      const users = await usersRes.json();

      if (statsRes.ok) setAdminStats(stats);
      if (usersRes.ok) setAdminUsers(users.users || []);
    } catch {
      setSettingsMessage("Gagal load admin dashboard.");
    }
  }

  async function updateAdminUser(userId, patch) {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal update user.");
        return;
      }

      await loadAdminDashboard();
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  async function resetUserUsage(userId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/reset-usage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Gagal reset usage.");
        return;
      }

      await loadAdminDashboard();
    } catch {
      alert("Backend belum bisa dihubungi.");
    }
  }

  function logout() {
    localStorage.removeItem("um_token");
    setToken("");
    setUser(null);
    setUsage(null);
    setMessages([]);
    setConversations([]);
    setActiveConversation(null);
    setSettingsOpen(false);
    setScreen("auth");
  }

  function newChat() {
    setActiveConversation(null);
    setMessages([]);
    setInput("");
    setRepoUrl("");
    setRepoOpen(false);
    removeImage();
    setSidebarOpen(window.innerWidth > 860);
  }

  function chooseModel(nextModel) {
    let selected = MODEL_PRESETS.find((item) => item.key === nextModel);
    if (!selected) {
      for (const g of ALL_MODELS) {
        const m = g.models.find(x => x.id === nextModel);
        if (m) { selected = { ...m, free: true, vision: m.vision || false }; break; }
      }
    }

    if (!selected) return;

    if (!isAdmin && !selected.free) {
      alert("Model ini khusus admin dulu, cuy.");
      return;
    }

    if (imageFile?.type?.startsWith("image/") && !selected.vision) {
      alert("Model ini text-only. Untuk gambar pakai Balanced atau Smart.");
      return;
    }

    setModel(nextModel);
    localStorage.setItem("um_default_model", nextModel);
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      alert("Ukuran file maksimal 6 MB.");
      event.target.value = "";
      return;
    }

    setImageFile(file);
    setImagePreview("");
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendMessage() {
    const text = input.trim();

    if ((!text && !imageFile && !repoUrl.trim()) || sending) return;

    if (!emailVerified) {
      alert("Verifikasi email dulu sebelum memakai chatbot.");
      return;
    }

    if (imageFile && !activeModel.vision) {
      alert("Model ini text-only. Untuk gambar pakai Balanced atau Smart.");
      return;
    }

    const tempUserMessage = {
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: text || (repoUrl.trim() ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."),
      attachmentUrl: imagePreview || null,
      attachmentName: imageFile?.name || null,
      attachmentMime: imageFile?.type || null,
      repoUrl: repoUrl.trim() || null,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setInput("");
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("message", text || (repoUrl.trim() ? "Tolong analisis GitHub repo ini." : "Tolong analisis lampiran ini."));
      formData.append("model", model);

      if (activeConversation?.id) {
        formData.append("conversationId", activeConversation.id);
      }

      if (repoUrl.trim()) {
        formData.append("repoUrl", repoUrl.trim());
      }

      if (imageFile) {
        formData.append("file", imageFile);
      }

      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev.filter((item) => item.id !== tempUserMessage.id),
          tempUserMessage,
          {
            id: `err-${Date.now()}`,
            role: "ASSISTANT",
            content: data.error || "Terjadi error.",
            createdAt: new Date().toISOString()
          }
        ]);
        return;
      }

      setUsage(data.usage || usage);
      setActiveConversation(data.conversation);

      setMessages((prev) => [
        ...prev.filter((item) => item.id !== tempUserMessage.id),
        data.userMessage,
        data.assistantMessage
      ]);

      removeImage();
      setRepoUrl("");
      setRepoOpen(false);
      await loadConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "ASSISTANT",
          content: "Backend belum bisa dihubungi. Cek server lokal kamu.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (screen === "boot") {
    return (
      <main className="boot-page">
        <div className="loader-dot" />
        <p>Loading Stb_Chatbot...</p>
      </main>
    );
  }

  if (screen === "reset") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">
            <Bot size={28} />
          </div>

          <h1>Reset Password</h1>
          <p>Masukkan password baru untuk akun Stb_Chatbot kamu.</p>

          <form onSubmit={handleResetPassword}>
            <input
              type="password"
              placeholder="Password baru"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
            />

            <button type="submit">Reset password</button>
          </form>

          <button className="link-button center" onClick={() => setScreen("auth")}>
            Kembali ke login
          </button>
        </section>
      </main>
    );
  }

  if (screen === "auth") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-logo">
            <Bot size={28} />
          </div>

          <h1>Stb_Chatbot</h1>
          <p>Chatbot publik multi-model dengan akun, OAuth, email verification, dan history chat.</p>

          {authMessage && <div className="auth-message">{authMessage}</div>}

          <div className="oauth-buttons">
            <button type="button" onClick={() => oauthLogin("google")}>
              <MailCheck size={18} />
              Continue with Google
            </button>

            <button type="button" onClick={() => oauthLogin("github")}>
              <Github size={18} />
              Continue with GitHub
            </button>
          </div>

          <div className="auth-divider">
            <span>atau pakai email</span>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>

            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {authMode === "register" && (
              <input
                placeholder="Nama"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            )}

            <input
              placeholder="Username"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              autoComplete="username"
            />

            {authMode === "register" && (
              <input
                type="email"
                placeholder="Email (opsional)"
                value={form.email || ""}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            )}

            {authMode !== "forgot" && (
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            )}

            {authMode === "forgot" && (
              <input
                type="email"
                placeholder="Email untuk reset password"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
              />
            )}

            <button type="submit">
              {authMode === "forgot"
                ? "Kirim link reset"
                : authMode === "login"
                  ? "Masuk"
                  : "Buat akun"}
            </button>
          </form>

          <button
            className="link-button center"
            onClick={() => setAuthMode(authMode === "forgot" ? "login" : "forgot")}
          >
            {authMode === "forgot" ? "Kembali ke login" : "Lupa password?"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              {user?.avatarUrl ? (
                <img src={apiUrl(user.avatarUrl)} alt={user.name} />
              ) : (
                <Bot size={20} />
              )}
            </div>
            <div>
              <strong>Stb_Chatbot</strong>
              <span>{isAdmin ? "Admin account" : "Free account"}</span>
            </div>
          </div>

          <button className="mobile-close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {!emailVerified && (
          <div className="verify-banner">
            <strong>Email belum verified</strong>
            <span>Cek email kamu atau kirim ulang link.</span>
            <button onClick={resendVerification}>Resend verification</button>
          </div>
        )}

        <button className="new-chat-button" onClick={newChat}>
          <Plus size={18} />
          New chat
        </button>

        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats"
          />
        </div>

        {conversations.length > 0 && (
          <button className="clear-history-button" onClick={deleteAllChats}>
            <Trash2 size={15} />
            Delete all chats
          </button>
        )}

        <div className="history-list">
          {visibleConversations.length === 0 ? (
            <p className="empty-history">Belum ada history.</p>
          ) : (
            visibleConversations.map((item) => (
              <button
                key={item.id}
                className={`history-item ${
                  activeConversation?.id === item.id ? "active" : ""
                }`}
                onClick={() => loadConversation(item.id)}
              >
                <div>
                  <strong>{item.title}</strong>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>

                <div className="history-actions">
                  <Pencil
                    size={14}
                    onClick={(event) => {
                      event.stopPropagation();
                      renameConversation(item.id, item.title);
                    }}
                  />
                  <Trash2
                    size={15}
                    onClick={(event) => deleteConversation(event, item.id)}
                  />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="usage-card">
          <div>
            <span>Usage today</span>
            <strong>
              {usage?.messageCount || 0} / {usage?.limit || (isAdmin ? 9999 : 20)}
            </strong>
          </div>

          <div className="usage-progress">
            <i
              style={{
                width: `${Math.min(
                  ((usage?.messageCount || 0) /
                    (usage?.limit || (isAdmin ? 9999 : 20))) *
                    100,
                  100
                )}%`
              }}
            />
          </div>

          <p>{usage?.tokenCount || 0} token tercatat hari ini</p>
        </div>

        <button className="account-card account-button" onClick={() => openSettings("account")}>
          <div className="mini-avatar">
            {user?.avatarUrl ? <img src={apiUrl(user.avatarUrl)} alt={user.name} /> : <UserRound size={18} />}
          </div>
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>

          {isAdmin && (
            <small>
              <ShieldCheck size={13} />
              Admin
            </small>
          )}
        </button>

        <button className="settings-button" onClick={() => openSettings("account")}>
          <Settings size={17} />
          Settings
        </button>

        <button className="settings-button" onClick={() => window.open("https://x5lab.dev/monitoring", "_blank")}>
          <Activity size={17} />
          Monitoring
        </button>

        <button className="logout-button" onClick={logout}>
          <LogOut size={17} />
          Logout
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="model-switch" ref={modelSwitchRef}>
            <button
              className="model-switch-btn"
              onClick={() => setModelSwitchOpen(!modelSwitchOpen)}
              title={activeModel.desc}
            >
              {(() => { const Icon = activeModel.icon; return <Icon size={16} />; })()}
              <span>{activeModel.label}</span>
              {MODEL_PRESETS.find(p => p.key === model) ? null : (
                <small className="model-preview">{activeModel.desc}</small>
              )}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`chevron ${modelSwitchOpen ? "open" : ""}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {modelSwitchOpen && (
              <div className="model-switch-dropdown">
                <div className="model-group-label">Presets</div>
                {MODEL_PRESETS.map((item) => {
                  const Icon = item.icon;
                  const locked = !isAdmin && !item.free;

                  return (
                    <button
                      key={item.key}
                      className={`model-option ${model === item.key ? "active" : ""} ${locked ? "locked" : ""}`}
                      onClick={() => {
                        if (!locked) {
                          chooseModel(item.key);
                          setModelSwitchOpen(false);
                        }
                      }}
                    >
                      <Icon size={16} />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.desc}</span>
                      </div>
                      {model === item.key && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {locked && <small>Locked</small>}
                    </button>
                  );
                })}

                <div className="model-divider" />

                {ALL_MODELS.map((group) => (
                  <div key={group.group}>
                    <div className="model-group-label" style={{ color: group.color }}>
                      {group.group}
                    </div>
                    {group.models.map((m) => {
                      const ItemIcon = group.icon;
                      const isActive = model === m.id;
                      return (
                        <button
                          key={m.id}
                          className={`model-option ${isActive ? "active" : ""}`}
                          onClick={() => {
                            chooseModel(m.id);
                            setModelSwitchOpen(false);
                          }}
                        >
                          <ItemIcon size={16} />
                          <div>
                            <strong>{m.label}</strong>
                            <span>{group.group}</span>
                          </div>
                          {isActive && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="chat-area">
          {messages.length === 0 ? (
            <section className="welcome-panel">
              <div className="welcome-mark">
                <Sparkles size={30} />
              </div>
              <h1>Apa yang bisa dibantu?</h1>
              <p>
                Tanya apa saja, upload dokumen/file kode, atau paste GitHub repo.
                Stb_Chatbot bakal bantu baca context dan lanjut coding.
              </p>

              <div className="suggestions">
                <button onClick={() => setInput("Baca repo ini, jelaskan struktur project dan saran refactor")}>
                  Analisis repo
                </button>
                <button onClick={() => setInput("Bantu debug error dari file ini")}>
                  Debug file
                </button>
                <button onClick={() => setInput("Buatkan fitur auth lengkap untuk project ini")}>
                  Buat fitur
                </button>
              </div>
            </section>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message ${message.role === "USER" ? "user" : "assistant"}`}
                >
                  <div className="avatar">
                    {message.role === "USER" ? <User size={18} /> : <Bot size={18} />}
                  </div>

                  <div className="message-body">
                    {message.attachmentUrl && (
                      <div className="attachment-preview compact-file-card">
                        <div className="file-preview">
                          <FileText size={22} />
                        </div>
                        <span>
                          <FileText size={14} />
                          {message.attachmentName || "Attachment"}
                        </span>
                      </div>
                    )}

                    {message.repoUrl && (
                      <div className="repo-preview">
                        <Github size={15} />
                        <span>{message.repoUrl}</span>
                      </div>
                    )}

                    <div className="message-text markdown-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: CodeBlock
                        }}
                      >
                        {normalizeAiMarkdown(message.content)}
                      </ReactMarkdown>
                    </div>

                    <div className="message-actions">
                      <button onClick={() => copyText(message.id, message.content)}>
                        {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === message.id ? "Copied" : "Copy"}
                      </button>
                      {message.role === "ASSISTANT" && activeConversation?.id && (
                        <button onClick={regenerateResponse}>
                          <RotateCcw size={14} />
                          Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {sending && (
                <article className="message assistant">
                  <div className="avatar">
                    <Bot size={18} />
                  </div>
                  <div className="message-body">
                    <div className="thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="composer">
          {imageFile && (
            <div className="selected-image">
              <div className="selected-file-icon">
                <FileText size={22} />
              </div>
              <div>
                <strong>{imageFile?.name}</strong>
                <span>Dokumen/file kode siap dibaca sebagai konteks</span>
              </div>
              <button onClick={removeImage}>
                <X size={16} />
              </button>
            </div>
          )}

          {repoOpen && (
            <div className="repo-input-wrap">
              <Github size={18} />
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="Paste GitHub repo URL, contoh: https://github.com/user/repo"
              />
              <button onClick={() => setRepoOpen(false)}>
                <X size={16} />
              </button>
            </div>
          )}

          <div className="composer-box">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,.js,.jsx,.ts,.tsx,.json,.html,.css,.scss,.py,.java,.go,.rs,.php,.rb,.vue,.svelte,.sql,.prisma,.yaml,.yml,.xml,.pdf,.docx"
              hidden
              onChange={handleImageChange}
            />

            <button
              className="icon-action"
              onClick={() => fileInputRef.current?.click()}
              title="Upload dokumen/file kode"
            >
              <Paperclip size={20} />
            </button>

            <button
              className={`icon-action ${repoUrl.trim() ? "active" : ""}`}
              onClick={() => setRepoOpen(!repoOpen)}
              title="Tambahkan GitHub repo"
            >
              <Github size={20} />
            </button>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                imageFile
                  ? "Tanya sesuatu tentang dokumen/file kode ini..."
                  : repoUrl.trim()
                    ? "Tanya sesuatu tentang repo ini..."
                    : "Kirim pesan ke Stb_Chatbot"
              }
              rows={1}
            />

            <button
              className="send-action"
              onClick={sendMessage}
              disabled={sending || (!input.trim() && !imageFile && !repoUrl.trim())}
            >
              <Send size={18} />
            </button>
          </div>

          <p>Stb_Chatbot bisa saja salah. Cek ulang jawaban penting.</p>
        </footer>
      </section>

      {settingsOpen && (
        <div className="settings-overlay" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <div>
                <h2>Settings</h2>
                <p>Kelola akun, profil, login provider, dan limit kamu.</p>
              </div>

              <button onClick={() => setSettingsOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <div className="settings-body">
              <nav className="settings-nav">
                <button className={settingsTab === "account" ? "active" : ""} onClick={() => setSettingsTab("account")}>
                  <UserRound size={17} />
                  Account
                </button>
                <button className={settingsTab === "security" ? "active" : ""} onClick={() => setSettingsTab("security")}>
                  <LockKeyhole size={17} />
                  Security
                </button>
                <button className={settingsTab === "connections" ? "active" : ""} onClick={() => setSettingsTab("connections")}>
                  <LinkIcon size={17} />
                  Connections
                </button>
                <button className={settingsTab === "usage" ? "active" : ""} onClick={() => setSettingsTab("usage")}>
                  <Zap size={17} />
                  Usage
                </button>
                {isAdmin && (
                  <button className={settingsTab === "admin" ? "active" : ""} onClick={() => {
                    setSettingsTab("admin");
                    loadAdminDashboard();
                  }}>
                    <BarChart3 size={17} />
                    Admin
                  </button>
                )}
              </nav>

              <div className="settings-content">
                {settingsMessage && <div className="settings-message">{settingsMessage}</div>}

                {settingsTab === "account" && (
                  <div className="settings-section">
                    <div className="profile-row">
                      <div className="profile-avatar">
                        {profileForm.avatarUrl ? (
                          <img src={apiUrl(profileForm.avatarUrl)} alt="avatar" />
                        ) : (
                          <UserRound size={26} />
                        )}
                      </div>
                      <div>
                        <h3>{accountData?.user?.name || user?.name}</h3>
                        <p>{accountData?.user?.email || user?.email}</p>
                        <div className="avatar-actions">
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            hidden
                            onChange={uploadAvatar}
                          />
                          <button type="button" onClick={() => avatarInputRef.current?.click()}>
                            Upload photo
                          </button>
                          <span>JPG, PNG, WEBP • max 2 MB</span>
                        </div>
                      </div>
                    </div>

                    <form className="settings-form" onSubmit={updateProfile}>
                      <label>
                        Display name
                        <input
                          value={profileForm.name}
                          onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                          placeholder="Nama tampil"
                        />
                      </label>

                      <label>
                        Avatar URL
                        <input
                          value={profileForm.avatarUrl}
                          onChange={(event) => setProfileForm({ ...profileForm, avatarUrl: event.target.value })}
                          placeholder="https://..."
                        />
                      </label>

                      <button type="submit">Save profile</button>
                    </form>

                    <div className="status-card">
                      <div>
                        <strong>Email status</strong>
                        <span>{emailVerified ? "Verified" : "Not verified"}</span>
                      </div>
                      {emailVerified ? (
                        <BadgeCheck className="ok" size={24} />
                      ) : (
                        <button onClick={resendVerification}>Resend</button>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === "security" && (
                  <div className="settings-section">
                    <h3>Password</h3>
                    <p className="muted-copy">
                      Kalau akun kamu dibuat via Google/GitHub, kamu bisa membuat password baru di sini supaya bisa login manual juga.
                    </p>

                    <form className="settings-form" onSubmit={changePassword}>
                      <label>
                        Current password
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                          placeholder="Kosongkan jika akun OAuth belum punya password"
                        />
                      </label>

                      <label>
                        New password
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                          placeholder="Minimal 6 karakter"
                        />
                      </label>

                      <button type="submit">Update password</button>
                    </form>

                    <div className="danger-card">
                      <div>
                        <strong>Danger zone</strong>
                        <span>Hapus akun dan semua chat history.</span>
                      </div>
                      <button onClick={deleteAccount}>
                        <AlertTriangle size={15} />
                        Delete account
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === "connections" && (
                  <div className="settings-section">
                    <h3>Connected accounts</h3>
                    <p className="muted-copy">Akun provider yang sudah tersambung dengan Stb_Chatbot.</p>

                    <div className="connection-list">
                      {(accountData?.accounts || []).length === 0 ? (
                        <p className="empty-history">Belum ada provider OAuth tersambung.</p>
                      ) : (
                        accountData.accounts.map((account) => (
                          <div className="connection-item" key={account.id}>
                            <div>
                              {account.provider === "github" ? <Github size={20} /> : <MailCheck size={20} />}
                            </div>
                            <div>
                              <strong>{account.provider}</strong>
                              <span>ID: {account.providerAccountId}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="oauth-buttons compact">
                      <button type="button" onClick={() => oauthLogin("google")}>
                        <MailCheck size={18} />
                        Connect Google
                      </button>

                      <button type="button" onClick={() => oauthLogin("github")}>
                        <Github size={18} />
                        Connect GitHub
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === "usage" && (
                  <div className="settings-section">
                    <h3>Usage</h3>

                    <div className="big-usage">
                      <div>
                        <strong>{usage?.messageCount || 0}</strong>
                        <span>chat used</span>
                      </div>
                      <div>
                        <strong>{usage?.limit || (isAdmin ? 9999 : 20)}</strong>
                        <span>daily limit</span>
                      </div>
                      <div>
                        <strong>{usage?.tokenCount || 0}</strong>
                        <span>tokens logged</span>
                      </div>
                    </div>

                    <div className="settings-form">
                      <label>
                        Default model
                        <select
                          value={model}
                          onChange={(event) => chooseModel(event.target.value)}
                        >
                          <optgroup label="─ Presets ─">
                            {MODEL_PRESETS.map((item) => (
                              <option key={item.key} value={item.key} disabled={!isAdmin && !item.free}>
                                {item.label} — {item.desc}
                              </option>
                            ))}
                          </optgroup>
                          {ALL_MODELS.map((group) => (
                            <optgroup key={group.group} label={`─ ${group.group} ─`}>
                              {group.models.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </div>

                    <p className="muted-copy">
                      Limit dihitung per hari per akun. Admin punya limit lebih besar dan akses semua model.
                    </p>
                  </div>
                )}

                {settingsTab === "admin" && isAdmin && (
                  <div className="settings-section">
                    <h3>Admin dashboard</h3>
                    <p className="muted-copy">Pantau user, token, suspend akun, ubah role, dan atur limit harian.</p>

                    <div className="status-card" style={{ marginBottom: 16 }}>
                      <div>
                        <strong>AI Monitoring</strong>
                        <span>Pantau usage API key, balance, dan token di dashboard x5lab.</span>
                      </div>
                      <button type="button" onClick={() => window.open("https://x5lab.dev/monitoring", "_blank")}>
                        <Activity size={15} />
                        Buka Monitoring
                      </button>
                    </div>

                    <div className="big-usage">
                      <div>
                        <strong>{adminStats?.users || 0}</strong>
                        <span>total users</span>
                      </div>
                      <div>
                        <strong>{adminStats?.suspendedUsers || 0}</strong>
                        <span>suspended</span>
                      </div>
                      <div>
                        <strong>{adminStats?.todayTokens || 0}</strong>
                        <span>today tokens</span>
                      </div>
                    </div>

                    <div className="admin-user-list">
                      {adminUsers.map((item) => (
                        <div className="admin-user-item" key={item.id}>
                          <div className="admin-user-main">
                            <div className="mini-avatar">
                              {item.avatarUrl ? <img src={apiUrl(item.avatarUrl)} alt={item.name} /> : <UserRound size={17} />}
                            </div>
                            <div>
                              <strong>{item.name}</strong>
                              <span>{item.email}</span>
                              <em>
                                {item.counts?.conversations || 0} chats • {item.todayUsage?.messageCount || 0} today • {item.todayUsage?.tokenCount || 0} tokens
                              </em>
                            </div>
                          </div>

                          <div className="admin-controls extended">
                            <select
                              value={item.role}
                              onChange={(event) => updateAdminUser(item.id, { role: event.target.value })}
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>

                            <select
                              value={item.status || "ACTIVE"}
                              onChange={(event) => updateAdminUser(item.id, { status: event.target.value })}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="SUSPENDED">SUSPENDED</option>
                            </select>

                            <input
                              type="number"
                              min="1"
                              max="100000"
                              placeholder="limit"
                              defaultValue={item.customDailyLimit || ""}
                              onBlur={(event) => updateAdminUser(item.id, { customDailyLimit: event.target.value })}
                            />

                            <button type="button" onClick={() => resetUserUsage(item.id)}>
                              Reset usage
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
