import { useState } from "react";
import {
  Bot,
  Send,
  User,
  MessageSquare,
  ChevronDown,
  Cpu,
  Trash2,
  Eraser,
} from "lucide-react";

const MODELS = [
  { id: "deepseek-chat", label: "DeepSeek Chat", icon: "🧠" },
  { id: "gemini-flash", label: "Gemini Flash", icon: "⚡" },
  { id: "claude-3-haiku", label: "Claude Haiku", icon: "🎯" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", icon: "🤖" },
];

function App() {
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [showModels, setShowModels] = useState(false);
  const [chat, setChat] = useState([
    {
      role: "assistant",
      content: "Halo 👋 Saya Stb_Chatbot, ada yang bisa saya bantu?",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const currentModel = MODELS.find((m) => m.id === selectedModel);

  const handleNewChat = () => {
    setChat([
      {
        role: "assistant",
        content: "Halo 👋 Saya Stb_Chatbot, ada yang bisa saya bantu?",
      },
    ]);
  };

  const deleteMessage = (index) => {
    setChat((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllChats = () => {
    setChat([]);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      role: "user",
      content: message,
    };

    setChat((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3001/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          model: selectedModel || undefined,
        }),
      });

      const data = await response.json();

      const modelUsed = data.model
        ? MODELS.find((m) => m.id === data.model)?.label || data.model
        : null;

      const botReply = {
        role: "assistant",
        content:
          data.reply || "Maaf, AI tidak memberikan jawaban.",
        model: modelUsed,
      };

      setChat((prev) => [...prev, botReply]);
    } catch (error) {
      console.log(error);

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Terjadi error saat menghubungi AI.",
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 flex items-center justify-center p-5 overflow-hidden">

      <div className="absolute w-[400px] h-[400px] bg-blue-500/20 rounded-full blur-3xl top-0 left-0"></div>
      <div className="absolute w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-3xl bottom-0 right-0"></div>

      <div className="relative w-full max-w-5xl h-[90vh] bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex">

        {/* SIDEBAR */}
        <div className="hidden md:flex w-[280px] bg-black/20 border-r border-white/10 flex-col p-5">

          <div className="flex items-center gap-3 mb-10">
            <div className="bg-blue-500 p-3 rounded-2xl">
              <Bot className="text-white" size={28} />
            </div>

            <div>
              <h1 className="text-white font-bold text-xl">
                Stb_Chatbot
              </h1>
              <p className="text-gray-400 text-sm">
                AI Assistant
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div
              onClick={handleNewChat}
              className="bg-white/10 hover:bg-white/20 transition p-4 rounded-2xl text-white flex items-center gap-3 cursor-pointer"
            >
              <MessageSquare size={20} />
              New Chat
            </div>

            {chat.length > 1 && (
              <div
                onClick={clearAllChats}
                className="bg-red-500/10 hover:bg-red-500/20 transition p-4 rounded-2xl text-red-300 flex items-center gap-3 cursor-pointer"
              >
                <Eraser size={20} />
                Hapus Semua
              </div>
            )}
          </div>

          <div className="mt-auto">
            <div className="relative">
              <button
                onClick={() => setShowModels(!showModels)}
                className="w-full bg-white/10 hover:bg-white/20 transition p-4 rounded-2xl text-white flex items-center gap-3"
              >
                <Cpu size={20} />
                <div className="flex-1 text-left">
                  <p className="text-xs text-gray-400">Model</p>
                  <p className="font-medium text-sm">{currentModel?.label || "Auto (Fallback)"}</p>
                </div>
                <ChevronDown size={16} className={`transition ${showModels ? "rotate-180" : ""}`} />
              </button>

              {showModels && (
                <div className="absolute bottom-full mb-2 w-full bg-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(selectedModel === m.id ? "" : m.id);
                        setShowModels(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/10 ${
                        selectedModel === m.id ? "bg-blue-500/20 text-blue-300" : "text-gray-300"
                      }`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      {selectedModel === m.id && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  ))}
                  {selectedModel && (
                    <button
                      onClick={() => {
                        setSelectedModel("");
                        setShowModels(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-400 hover:bg-white/10 transition border-t border-white/10"
                    >
                      <span>🔄</span>
                      <span>Auto (Fallback)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="text-gray-400 text-sm text-center mt-3">
              Powered by x5LAB AI
            </div>
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 flex flex-col">

          {/* HEADER */}
          <div className="border-b border-white/10 p-5 flex items-center justify-between bg-black/10 backdrop-blur-xl">
            <div>
              <h1 className="text-white text-2xl font-bold">
                Stb_Chatbot 🚀
              </h1>
              <p className="text-gray-400 text-sm">
                {currentModel?.label
                  ? `Model: ${currentModel.icon} ${currentModel.label}`
                  : "Smart AI Assistant"}
              </p>
            </div>

            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          </div>

          {/* CHAT BOX */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {chat.map((msg, index) => (
              <div
                key={index}
                className={`flex group ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-3xl p-4 text-white shadow-lg ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                      : "bg-white/10 backdrop-blur-xl border border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === "user" ? (
                      <User size={18} />
                    ) : (
                      <Bot size={18} />
                    )}

                    <span className="font-semibold text-sm">
                      {msg.role === "user"
                        ? "You"
                        : "Stb_Chatbot"}
                    </span>
                  </div>
                  {msg.role === "assistant" && msg.model && (
                    <p className="text-[10px] text-gray-500 mb-2">{msg.model}</p>
                  )}

                  <p className="leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>

                  <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => deleteMessage(index)}
                      className="text-gray-500 hover:text-red-400 transition"
                      title="Hapus pesan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/10 text-white rounded-3xl px-5 py-4 backdrop-blur-xl">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>

                    <span className="ml-2 text-sm text-gray-300">
                      AI sedang mengetik...
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* INPUT */}
          <div className="p-5 border-t border-white/10 bg-black/10 backdrop-blur-xl">

            <div className="flex items-center gap-3 bg-white/10 border border-white/10 rounded-2xl p-3">

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis pesan untuk AI..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none px-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
              />

              <button
                onClick={sendMessage}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-105 transition text-white p-3 rounded-xl shadow-lg"
              >
                <Send size={20} />
              </button>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;