const CONFIG = {
  API_URL: 'https://api.openai.com/v1/chat/completions',
  API_KEY: localStorage.getItem('stb_api_key') || '',
  MODEL: 'gpt-3.5-turbo',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  SYSTEM_PROMPT: 'Kamu adalah Stb_Chatbot, asisten AI yang membantu dan ramah. Jawab dengan bahasa Indonesia yang baik dan benar. Berikan jawaban yang informatif, akurat, dan bermanfaat.'
};

const elements = {
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  messagesArea: document.getElementById('messagesArea'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  chatHistory: document.getElementById('chatHistory'),
  newChatBtn: document.getElementById('newChatBtn'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebar: document.getElementById('sidebar'),
  suggestionChips: document.getElementById('suggestionChips')
};

let chatIdCounter = 1;
let currentChatId = 'default';
let isProcessing = false;
let chats = loadChats();

function loadChats() {
  const saved = localStorage.getItem('stb_chats');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveChats() {
  localStorage.setItem('stb_chats', JSON.stringify(chats));
}

function generateId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function formatTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return hours + ':' + minutes;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  let html = text;

  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || 'plaintext', code: code.trim() });
    return '%%CODEBLOCK_' + idx + '%%';
  });

  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, function (_, code) {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return '%%INLINECODE_' + idx + '%%';
  });

  html = escapeHtml(html);

  inlineCodes.forEach(function (code, i) {
    html = html.replace('%%INLINECODE_' + i + '%%', '<code>' + escapeHtml(code) + '</code>');
  });

  html = html.replace(/&lt;br\s*\/?&gt;/gi, '\n');
  html = html.replace(/&lt;hr\s*\/?&gt;/gi, '<hr>');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/(?:<li>.*<\/li>)/g, function (m) { return m; });

  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, function (m) {
    if (!m.includes('<ul>')) {
      return '<ol>' + m + '</ol>';
    }
    return m;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(function (p) {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') || p.startsWith('<hr') || p.startsWith('<li') || p.startsWith('%%CODEBLOCK')) {
      return p;
    }
    if (p.includes('<h') || p.includes('<ul') || p.includes('<ol') || p.includes('<blockquote')) {
      return p;
    }
    return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  html = html.replace(/(?:<li>.*?<\/li>(\s*))+/g, function (m) {
    if (!m.trim().startsWith('<ul') && !m.trim().startsWith('<ol')) {
      if (/^\d+\./.test(m)) return '<ol>' + m + '</ol>';
      return '<ul>' + m + '</ul>';
    }
    return m;
  });

  if (html.includes('<ul><li>')) {
    html = html.replace(/<ul>(<li>.*?<\/li>)+<\/ul>/g, function (m) {
      if (m.includes('<ul><ul>')) return m;
      return m;
    });
  }

  codeBlocks.forEach(function (block, i) {
    const langClass = block.lang ? ' class="language-' + block.lang + '"' : '';
    const escapedCode = escapeHtml(block.code);
    const placeholder = '%%CODEBLOCK_' + i + '%%';
    const codeHtml = '<pre><code' + langClass + '>' + escapedCode + '</code></pre>';
    html = html.replace(placeholder, codeHtml);
  });

  return html;
}

function highlightAllCode() {
  document.querySelectorAll('.message-text pre code').forEach(function (block) {
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(block);
    }
  });
  document.querySelectorAll('.message-text pre').forEach(function (pre) {
    if (!pre.querySelector('.copy-btn')) {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = '<i class="fas fa-copy"></i>';
      btn.title = 'Copy code';
      btn.addEventListener('click', function () {
        const code = pre.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.textContent).then(function () {
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.classList.add('copied');
            setTimeout(function () {
              btn.innerHTML = '<i class="fas fa-copy"></i>';
              btn.classList.remove('copied');
            }, 2000);
          });
        }
      });
      pre.appendChild(btn);
    }
  });
}

function addMessage(role, content, chatId) {
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + role;
  messageDiv.id = msgId;

  const avatarIcon = role === 'user' ? 'fa-user' : 'fa-robot';
  const avatar = '<div class="message-avatar"><i class="fas ' + avatarIcon + '"></i></div>';

  const renderedContent = role === 'user' ? escapeHtml(content) : renderMarkdown(content);

  messageDiv.innerHTML = avatar + '<div class="message-content"><div class="message-text">' + renderedContent + '</div><div class="message-time">' + formatTime() + '</div></div>';

  elements.messagesArea.appendChild(messageDiv);

  if (!chats[chatId]) {
    chats[chatId] = { messages: [], title: 'Chat ' + chatIdCounter };
  }
  chats[chatId].messages.push({ role: role, content: content, time: formatTime() });
  saveChats();

  scrollToBottom();

  if (role === 'bot') {
    setTimeout(highlightAllCode, 100);
  }

  return msgId;
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typingIndicator';
  div.innerHTML = '<div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-content"><div class="message-text"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>';
  elements.messagesArea.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function scrollToBottom() {
  requestAnimationFrame(function () {
    elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
    document.querySelector('.chat-container').scrollTop = document.querySelector('.chat-container').scrollHeight;
  });
}

function showWelcome() {
  elements.welcomeScreen.style.display = 'flex';
  elements.messagesArea.classList.remove('active');
  elements.messagesArea.innerHTML = '';
}

function showMessages() {
  elements.welcomeScreen.style.display = 'none';
  elements.messagesArea.classList.add('active');
}

function getChatHistory(chatId) {
  if (chats[chatId]) {
    return chats[chatId].messages.map(function (m) {
      return { role: m.role, content: m.content };
    });
  }
  return [];
}

function loadChat(chatId) {
  currentChatId = chatId;
  elements.messagesArea.innerHTML = '';
  const chatData = chats[chatId];
  if (chatData && chatData.messages.length > 0) {
    showMessages();
    chatData.messages.forEach(function (m) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message ' + m.role;
      const avatarIcon = m.role === 'user' ? 'fa-user' : 'fa-robot';
      const renderedContent = m.role === 'user' ? escapeHtml(m.content) : renderMarkdown(m.content);
      msgDiv.innerHTML = '<div class="message-avatar"><i class="fas ' + avatarIcon + '"></i></div><div class="message-content"><div class="message-text">' + renderedContent + '</div><div class="message-time">' + (m.time || formatTime()) + '</div></div>';
      elements.messagesArea.appendChild(msgDiv);
    });
    setTimeout(highlightAllCode, 200);
    scrollToBottom();
  } else {
    showWelcome();
  }
  updateHistoryActive(chatId);
}

function updateHistoryActive(chatId) {
  document.querySelectorAll('.history-item').forEach(function (el) {
    el.classList.remove('active');
  });
  const activeEl = document.querySelector('.history-item[data-id="' + chatId + '"]');
  if (activeEl) activeEl.classList.add('active');
}

function addHistoryItem(chatId, title) {
  const existing = document.querySelector('.history-item[data-id="' + chatId + '"]');
  if (existing) return;

  const item = document.createElement('div');
  item.className = 'history-item active';
  item.setAttribute('data-id', chatId);
  item.innerHTML = '<i class="fas fa-comment-dots"></i><span>' + title + '</span>';
  item.addEventListener('click', function () {
    loadChat(chatId);
  });
  elements.chatHistory.insertBefore(item, elements.chatHistory.firstChild);
  updateHistoryActive(chatId);
}

function newChat() {
  chatIdCounter++;
  currentChatId = generateId();
  chats[currentChatId] = { messages: [], title: 'Chat ' + chatIdCounter };
  saveChats();
  addHistoryItem(currentChatId, 'Chat ' + chatIdCounter);
  showWelcome();
  isProcessing = false;
}

function sendMessage(text) {
  if (!text.trim() || isProcessing) return;

  if (!chats[currentChatId]) {
    chats[currentChatId] = { messages: [], title: text.substring(0, 40) + (text.length > 40 ? '...' : '') };
    addHistoryItem(currentChatId, chats[currentChatId].title);
  } else if (chats[currentChatId].messages.length === 0) {
    chats[currentChatId].title = text.substring(0, 40) + (text.length > 40 ? '...' : '');
    const histItem = document.querySelector('.history-item[data-id="' + currentChatId + '"] span');
    if (histItem) histItem.textContent = chats[currentChatId].title;
  }

  showMessages();
  addMessage('user', text.trim(), currentChatId);
  elements.chatInput.value = '';
  autoResize();
  setSendButtonState();

  isProcessing = true;
  elements.sendBtn.disabled = true;
  addTypingIndicator();

  if (CONFIG.API_KEY) {
    callAIAPI(text.trim());
  } else {
    simulateAIResponse(text.trim());
  }
}

function callAIAPI(userMessage) {
  const messages = [{ role: 'system', content: CONFIG.SYSTEM_PROMPT }];
  const history = getChatHistory(currentChatId);
  history.forEach(function (m) {
    messages.push(m);
  });

  fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.API_KEY
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      messages: messages,
      max_tokens: CONFIG.MAX_TOKENS,
      temperature: CONFIG.TEMPERATURE
    })
  })
  .then(function (res) {
    if (!res.ok) {
      throw new Error('API Error: ' + res.status);
    }
    return res.json();
  })
  .then(function (data) {
    removeTypingIndicator();
    const reply = data.choices[0].message.content;
    addMessage('bot', reply, currentChatId);
    isProcessing = false;
    elements.sendBtn.disabled = false;
    setSendButtonState();
  })
  .catch(function (err) {
    removeTypingIndicator();
    const errorMsg = 'Maaf, terjadi kesalahan saat menghubungi AI: ' + err.message + '. Pastikan API key valid dan coba lagi.';
    addMessage('bot', errorMsg, currentChatId);
    isProcessing = false;
    elements.sendBtn.disabled = false;
    setSendButtonState();
  });
}

function simulateAIResponse(userMessage) {
  const responses = [
    'Halo! Saya Stb_Chatbot. Terima kasih atas pertanyaannya. Berikut adalah jawaban untuk Anda:\n\n' + userMessage + ' adalah topik yang menarik! Dalam konteks teknologi modern, ada beberapa hal yang perlu dipertimbangkan:\n\n1. **Integrasi AI** yang makin canggih\n2. **Performa tinggi** dengan optimasi terbaru\n3. **Keamanan data** sebagai prioritas utama\n\nSemoga membantu! Ada lagi yang bisa saya bantu?',
    'Terima kasih sudah bertanya! Saya senang membantu.\n\nMengenai "' + userMessage + '", berikut penjelasannya:\n\n```python\ndef stb_chatbot_response(query):\n    # AI processing logic\n    response = process_with_ai(query)\n    return response\n```\n\nKode di atas menunjukkan bagaimana Stb_Chatbot memproses pertanyaan Anda menggunakan algoritma AI modern.',
    'Pertanyaan bagus! Stb_Chatbot siap membantu.\n\n> *"Teknologi terbaik adalah yang membuat hidup lebih sederhana."*\n\nBerikut beberapa poin penting:\n- ✅ Mudah diimplementasikan\n- ✅ Skalabilitas tinggi\n- ✅ Didukung AI terkini\n- ✅ Optimal untuk berbagai kebutuhan\n\nAda hal lain yang ingin Anda diskusikan?',
    'Tentu! Saya akan bantu jelaskan.\n\n## Poin Utama\n\n**' + userMessage + '** mencakup beberapa aspek penting:\n\n| Aspek | Deskripsi |\n|-------|-----------|\n| Kecepatan | Diproses dalam milidetik |\n| Akurasi | Tingkat presisi tinggi |\n| Skalabilitas | Mudah dikembangkan |\n\n### Kesimpulan\n\nDengan pendekatan yang tepat, hasil yang optimal bisa dicapai. Stb_Chatbot siap membantu Anda!'
  ];

  setTimeout(function () {
    removeTypingIndicator();
    const reply = responses[Math.floor(Math.random() * responses.length)];
    addMessage('bot', reply, currentChatId);
    isProcessing = false;
    elements.sendBtn.disabled = false;
    setSendButtonState();
  }, 1500 + Math.random() * 1500);
}

function autoResize() {
  elements.chatInput.style.height = 'auto';
  elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 200) + 'px';
}

function setSendButtonState() {
  const hasText = elements.chatInput.value.trim().length > 0;
  elements.sendBtn.classList.toggle('active', hasText);
}

elements.chatInput.addEventListener('input', function () {
  autoResize();
  setSendButtonState();
});

elements.chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(elements.chatInput.value);
  }
});

elements.sendBtn.addEventListener('click', function () {
  sendMessage(elements.chatInput.value);
});

elements.newChatBtn.addEventListener('click', newChat);

elements.sidebarToggle.addEventListener('click', function () {
  elements.sidebar.classList.toggle('open');
});

document.addEventListener('click', function (e) {
  if (window.innerWidth <= 768) {
    if (!elements.sidebar.contains(e.target) && !elements.sidebarToggle.contains(e.target)) {
      elements.sidebar.classList.remove('open');
    }
  }
});

elements.suggestionChips.addEventListener('click', function (e) {
  const chip = e.target.closest('.chip');
  if (chip && chip.dataset.prompt) {
    sendMessage(chip.dataset.prompt);
  }
});

function init() {
  const savedChatIds = Object.keys(chats);

  if (savedChatIds.length > 0) {
    elements.chatHistory.innerHTML = '';
    savedChatIds.forEach(function (id) {
      const chat = chats[id];
      const item = document.createElement('div');
      item.className = 'history-item';
      item.setAttribute('data-id', id);
      item.innerHTML = '<i class="fas fa-comment-dots"></i><span>' + (chat.title || 'Chat') + '</span>';
      item.addEventListener('click', function () {
        loadChat(id);
      });
      elements.chatHistory.appendChild(item);
    });
    currentChatId = savedChatIds[savedChatIds.length - 1];
    loadChat(currentChatId);
  } else {
    currentChatId = generateId();
    chats[currentChatId] = { messages: [], title: 'Chat ' + chatIdCounter };
    saveChats();
    addHistoryItem(currentChatId, 'Chat ' + chatIdCounter);
  }
}

init();
