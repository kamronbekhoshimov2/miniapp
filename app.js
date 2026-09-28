// Backend (bot + baza) qayerda ishlayotgan bo'lsa, shu domenni yozing.
// Agar mini app'ni SHU BILAN BIR domenda joylasangiz, bo'sh qoldiring ("").
const API_BASE = "https://kamronronbekdev.pythonanywhere.com";

const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const SUBJECTS = {
  "🧮 Matematika": "Matematika",
  "⚛️ Fizika": "Fizika",
  "💻 Informatika": "Informatika",
  "🇬🇧 Ingliz tili": "Ingliz tili",
  "✍️ Ona tili": "Ona tili",
  "🏛️ Tarix": "Tarix",
  "📌 Boshqa fan": "Boshqa fan",
};

let state = { snapshot: null, tab: "savol", selectedSubject: null, chatMessages: [], lastMsgId: 0, draft: "", chatDraft: "", pendingRender: false };
let chatPollTimer = null;
let bootstrapPollTimer = null;

function initData() {
  return (tg && tg.initData) || "";
}

async function api(path, options = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json", "X-Telegram-Init-Data": initData() },
    options.headers || {}
  );
  let res;
  try {
    res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));
  } catch (e) {
    throw new Error("Server bilan aloqa yo'q. Internetni tekshiring.");
  }
  let body = null;
  try { body = await res.json(); } catch (e) { /* bo'sh javob */ }
  if (!res.ok) {
    const msg = (body && body.error) ? body.error : `Server xatosi (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

async function loadBootstrap() {
  if (!initData()) {
    document.getElementById("content").innerHTML =
      '<div class="card"><b>Xatolik.</b><div class="error">Bu sahifa faqat Telegram bot ichidan "Mini App" tugmasi orqali ochilganda ishlaydi.</div></div>';
    return;
  }
  try {
    state.snapshot = await api("/api/bootstrap");
    render();
  } catch (e) {
    document.getElementById("content").innerHTML =
      `<div class="card"><b>Yuklanmadi.</b><div class="error">${escapeHtml(e.message)}</div></div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function render() {
  const s = state.snapshot;
  if (!s) return;
  const isTeacher = !!s.teacher;
  const tabsDef = isTeacher
    ? [["holat","Holat"],["chat","Faol suhbat"],["profil","Profil"]]
    : [["savol","Savol yuborish"],["savollarim","Mening savollarim"],["chat","Faol suhbat"],["profil","Profil"]];

  const tabsEl = document.getElementById("tabs");
  tabsEl.innerHTML = "";
  tabsDef.forEach(([key, label]) => {
    const b = el(`<button class="tab ${state.tab===key?'active':''}">${label}</button>`);
    b.onclick = () => setTab(key);
    tabsEl.appendChild(b);
  });
  if (!tabsDef.find(t => t[0] === state.tab)) state.tab = tabsDef[0][0];

  const content = document.getElementById("content");
  content.innerHTML = "";
  if (state.tab === "savol") content.appendChild(renderSendQuestion());
  else if (state.tab === "savollarim") content.appendChild(renderMyQuestions());
  else if (state.tab === "holat") content.appendChild(renderTeacherStatus());
  else if (state.tab === "chat") content.appendChild(renderChat());
  else if (state.tab === "profil") content.appendChild(renderProfile());

  manageChatPolling();
}

function renderSendQuestion() {
  const c = el(`
    <div class="card">
      <h2>Qaysi fandan savolingiz bor?</h2>
      <div class="chip-row" id="subjectChips"></div>
      <textarea id="qtext" rows="4" maxlength="1200" placeholder="Savolingizni yozing (kamida 5 belgi)..."></textarea>
      <div class="hint" id="qcount">0/1200</div>
      <button class="btn" id="sendBtn">Yuborish</button>
      <div class="error" id="qerr" style="display:none"></div>
    </div>
  `);
  const chips = c.querySelector("#subjectChips");
  Object.entries(SUBJECTS).forEach(([label, value]) => {
    const chip = el(`<button class="chip ${state.selectedSubject === value ? "selected" : ""}">${label}</button>`);
    chip.onclick = () => {
      state.selectedSubject = value;
      chips.querySelectorAll(".chip").forEach(x => x.classList.remove("selected"));
      chip.classList.add("selected");
    };
    chips.appendChild(chip);
  });
  const textarea = c.querySelector("#qtext");
  const count = c.querySelector("#qcount");
  textarea.value = state.draft;
  count.textContent = `${textarea.value.length}/1200`;
  textarea.oninput = () => { state.draft = textarea.value; count.textContent = `${textarea.value.length}/1200`; };

  c.querySelector("#sendBtn").onclick = async () => {
    const err = c.querySelector("#qerr");
    err.style.display = "none";
    const text = textarea.value.trim();
    if (!state.selectedSubject) { err.textContent = "Fanni tanlang."; err.style.display = "block"; return; }
    if (text.length < 5) { err.textContent = "Savol kamida 5 belgidan iborat bo'lishi kerak."; err.style.display = "block"; return; }
    const btn = c.querySelector("#sendBtn");
    btn.disabled = true; btn.textContent = "Yuborilmoqda...";
    try {
      await api("/api/questions", { method: "POST", body: JSON.stringify({ subject: state.selectedSubject, question_text: text }) });
      state.draft = ""; textarea.value = ""; count.textContent = "0/1200";
      if (tg) tg.showAlert ? tg.showAlert("Savolingiz yuborildi. Bo'sh ustozlarga xabar ketdi.") : alert("Savolingiz yuborildi.");
      await loadBootstrap();
      setTab("savollarim");
    } catch (e) {
      err.textContent = e.message;
      err.style.display = "block";
    } finally {
      btn.disabled = false; btn.textContent = "Yuborish";
    }
  };
  return c;
}

function renderMyQuestions() {
  const qs = state.snapshot.questions || [];
  if (!qs.length) return el('<div class="card"><div class="empty">Hali savol yubormagansiz.</div></div>');
  const statusLabel = { new: "Kutilmoqda", accepted: "Qabul qilindi", closed: "Yakunlandi" };
  const items = qs.map(q => `
    <div class="qitem">
      <span class="qstatus">${statusLabel[q.status] || q.status}</span>
      <b>${escapeHtml(q.subject)}</b>
      <div>${escapeHtml(q.question_text || "")}</div>
      <div class="hint">${escapeHtml(q.created_at || "")}</div>
    </div>
  `).join("");
  return el(`<div class="card"><h2>Mening savollarim</h2>${items}</div>`);
}

function renderTeacherStatus() {
  const t = state.snapshot.teacher;
  const c = el(`
    <div class="card">
      <h2>Fan: ${escapeHtml(t.subject || "tanlanmagan")}</h2>
      <div class="toggle-row">
        <span>Bo'shman (yangi savollar kelsin)</span>
        <button class="switch ${t.is_free ? "on" : ""}" id="freeSwitch"><span class="dot"></span></button>
      </div>
      <div class="hint" style="margin-top:10px">Reyting: ${t.rating ? t.rating.toFixed(1) + "/5" : "hali baho yo'q"} · Yordam berilgan: ${t.helped_count}</div>
      <div class="error" id="terr" style="display:none"></div>
    </div>
  `);
  c.querySelector("#freeSwitch").onclick = async (ev) => {
    const btn = ev.currentTarget;
    const next = !btn.classList.contains("on");
    btn.disabled = true;
    try {
      await api("/api/teacher/availability", { method: "POST", body: JSON.stringify({ is_free: next }) });
      await loadBootstrap();
    } catch (e) {
      const err = c.querySelector("#terr");
      err.textContent = e.message;
      err.style.display = "block";
    } finally {
      btn.disabled = false;
    }
  };
  return c;
}

function renderChat() {
  const chat = state.snapshot.active_chat;
  if (!chat) return el('<div class="card"><div class="empty">Hozircha faol suhbatingiz yo\'q.</div></div>');
  const c = el(`
    <div class="card">
      <h2>${escapeHtml(chat.partner_name)} ${chat.subject ? "· " + escapeHtml(chat.subject) : ""}</h2>
      <div class="msgs" id="msgs"></div>
      <div class="row">
        <input type="text" id="chatInput" placeholder="Xabar yozing...">
        <button class="btn" id="chatSend" style="width:auto;padding:12px 16px;">Yubor</button>
      </div>
      <div class="error" id="cherr" style="display:none"></div>
    </div>
  `);
  renderMessagesInto(c.querySelector("#msgs"));
  const input = c.querySelector("#chatInput");
  input.value = state.chatDraft;
  input.oninput = () => { state.chatDraft = input.value; };
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; state.chatDraft = "";
    try {
      await api("/api/chat/send", { method: "POST", body: JSON.stringify({ text }) });
      state.chatMessages.push({ id: ++state.lastMsgId + 0.5, sender_id: state.snapshot.user.id, text, created_at: "" });
      renderMessagesInto(document.getElementById("msgs"));
      pollChat();
    } catch (e) {
      const err = c.querySelector("#cherr");
      err.textContent = e.message;
      err.style.display = "block";
    }
  };
  c.querySelector("#chatSend").onclick = send;
  input.onkeydown = (ev) => { if (ev.key === "Enter") send(); };
  return c;
}

function renderMessagesInto(container) {
  if (!container) return;
  const myId = state.snapshot.user.id;
  container.innerHTML = state.chatMessages.map(m => `
    <div class="msg ${m.sender_id === myId ? "me" : ""}">
      ${escapeHtml(m.text)}
      <div class="t">${escapeHtml(m.created_at || "")}</div>
    </div>
  `).join("") || '<div class="empty">Xabarlar yo\'q</div>';
  container.scrollTop = container.scrollHeight;
}

async function pollChat() {
  if (!state.snapshot || !state.snapshot.active_chat) return;
  try {
    const res = await api(`/api/chat?after_id=${state.lastMsgId}`);
    if (res.active && res.messages && res.messages.length) {
      state.chatMessages.push(...res.messages);
      state.lastMsgId = res.messages[res.messages.length - 1].id;
      renderMessagesInto(document.getElementById("msgs"));
    }
  } catch (e) { /* jim, keyingi urinishda qayta tekshiramiz */ }
}

function manageChatPolling() {
  if (chatPollTimer) clearInterval(chatPollTimer);
  if (state.tab === "chat" && state.snapshot.active_chat) {
    chatPollTimer = setInterval(pollChat, 3000);
  }
}

function renderProfile() {
  const u = state.snapshot.user;
  const c = el(`
    <div class="card">
      <h2>Profil</h2>
      <input type="text" id="nameInput" value="${escapeHtml(u.name)}">
      <button class="btn" id="saveName">Saqlash</button>
      <div class="hint" id="perr"></div>
    </div>
  `);
  c.querySelector("#saveName").onclick = async () => {
    const name = c.querySelector("#nameInput").value.trim();
    const hint = c.querySelector("#perr");
    try {
      await api("/api/profile", { method: "PUT", body: JSON.stringify({ name }) });
      hint.textContent = "Saqlandi.";
      await loadBootstrap();
    } catch (e) {
      hint.textContent = e.message;
    }
  };
  return c;
}

loadBootstrap();
// Yangi savol qabul qilinishi / faol suhbat paydo bo'lishini kuzatib turamiz.
function isTyping() {
  const a = document.activeElement;
  return !!a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT");
}

// Yozayotgan maydondan chiqilganda, kutib turgan yangilanishni ko'rsatamiz.
document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (state.pendingRender && !isTyping()) { state.pendingRender = false; render(); }
  }, 100);
});

bootstrapPollTimer = setInterval(async () => {
  if (!initData()) return;
  try {
    const fresh = await api("/api/bootstrap");
    const changed = JSON.stringify(fresh) !== JSON.stringify(state.snapshot);
    if (!changed) return;                       // hech narsa o'zgarmadi — tegmaymiz
    const hadChat = !!(state.snapshot && state.snapshot.active_chat);
    const hasChat = !!fresh.active_chat;
    state.snapshot = fresh;
    if (!hadChat && hasChat) { state.chatMessages = []; state.lastMsgId = 0; }
    if (isTyping()) { state.pendingRender = true; return; }  // yozayotganda bezovta qilmaymiz
    render();
  } catch (e) { /* jim */ }
}, 6000);