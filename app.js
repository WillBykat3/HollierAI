(() => {
  "use strict";

  // ───────────── Config ─────────────
  // Every question gets the same answer after a 5–15 second "think".
  const REPLY = "Jackass";
  const MIN_THINK_MS = 5000;
  const MAX_THINK_MS = 15000;
  const HEADLINES = [
    "What can I help with?",
    "Where should we begin?",
    "What's on your mind today?",
    "Ready when you are.",
    "What's on the agenda today?",
  ];
  // Profile name shown bottom-left. Personalise with ?name=Jane%20Doe
  const params = new URLSearchParams(location.search);
  const USER_NAME = (params.get("name") || "User").trim().slice(0, 40) || "User";

  // ───────────── DOM ─────────────
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const main = $("main");
  const thread = $("thread");
  const messagesEl = $("messages");
  const headline = $("headline");
  const form = $("composer");
  const prompt = $("prompt");
  const sendBtn = $("send-btn");
  const chatList = $("chat-list");
  const chatsSection = $("chats-section");
  const shareBtn = $("share-btn");
  const modelBtn = $("model-btn");
  const modelMenu = $("model-menu");
  const toastEl = $("toast");

  const mqMobile = window.matchMedia("(max-width: 767px)");
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // ───────────── State ─────────────
  const chats = [];          // { id, title, messages: [{ id, role, text, status, secs }] }
  let current = null;        // chat currently shown (null = fresh "new chat" screen)
  let pending = null;        // { chat, msg, timer, start }
  let uid = 0;
  const nextId = () => `m${++uid}`;

  // ───────────── Helpers ─────────────
  const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function titleFrom(text) {
    const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ");
    let t = words.length > 38 ? words.slice(0, 38).trimEnd() : words;
    t = t.replace(/[?.!,;:]+$/, "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "New chat";
  }

  function scrollToBottom(smooth = true) {
    thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // ───────────── Profile ─────────────
  (function initProfile() {
    const initials = USER_NAME.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
    const palette = ["#e06c28", "#1a7f64", "#5436da", "#b4308b", "#0c79c1", "#c2410c", "#4d7c0f"];
    let h = 0;
    for (const c of USER_NAME) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const avatar = $("avatar");
    avatar.textContent = initials || "U";
    avatar.style.background = palette[h % palette.length];
    $("profile-name").textContent = USER_NAME;
  })();

  // ───────────── Composer ─────────────
  function autosize() {
    prompt.style.height = "auto";
    prompt.style.height = Math.min(prompt.scrollHeight, 208) + "px";
  }

  function updateSendState() {
    let state = "voice";
    if (pending && pending.chat === current) state = "stop";
    else if (prompt.value.trim()) state = "send";
    sendBtn.dataset.state = state;
    sendBtn.setAttribute("aria-label", { voice: "Start voice mode", send: "Send prompt", stop: "Stop streaming" }[state]);
  }

  prompt.addEventListener("input", () => { autosize(); updateSendState(); });
  prompt.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !coarsePointer) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("click", (e) => {
    if (!e.target.closest("button")) prompt.focus();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const state = sendBtn.dataset.state;
    if (state === "stop") return finish(pending.chat, pending.msg);
    if (state === "voice") return prompt.focus();
    if (pending) return; // a reply is still being "thought" about in another chat
    const text = prompt.value.trim();
    if (!text) return;
    prompt.value = "";
    autosize();
    send(text);
  });

  // ───────────── Conversation flow ─────────────
  function send(text) {
    if (!current) {
      current = { id: `c${chats.length + 1}`, title: titleFrom(text), messages: [] };
      chats.unshift(current);
      renderChatList(current.id);
      enterThreadMode();
    }
    const userMsg = { id: nextId(), role: "user", text };
    current.messages.push(userMsg);
    messagesEl.appendChild(renderMessage(userMsg));
    ask(current);
  }

  function ask(chat, msg) {
    if (!msg) {
      msg = { id: nextId(), role: "assistant" };
      chat.messages.push(msg);
    }
    msg.status = "thinking";
    msg.text = "";
    msg.secs = 0;

    if (chat === current) {
      const existing = messagesEl.querySelector(`[data-id="${msg.id}"]`);
      const el = renderMessage(msg);
      existing ? existing.replaceWith(el) : messagesEl.appendChild(el);
      scrollToBottom();
    }

    const delay = MIN_THINK_MS + Math.random() * (MAX_THINK_MS - MIN_THINK_MS);
    pending = { chat, msg, start: performance.now(), timer: setTimeout(() => finish(chat, msg), delay) };
    updateSendState();
  }

  function finish(chat, msg) {
    if (!pending || pending.msg !== msg) return;
    clearTimeout(pending.timer);
    msg.secs = Math.max(1, Math.round((performance.now() - pending.start) / 1000));
    msg.status = "done";
    msg.text = REPLY;
    pending = null;
    updateSendState();
    if (chat === current) {
      const el = messagesEl.querySelector(`[data-id="${msg.id}"]`);
      if (el) el.replaceWith(renderMessage(msg, true));
      scrollToBottom();
    }
  }

  // ───────────── Rendering ─────────────
  function renderMessage(msg, animate = false) {
    const el = document.createElement("div");
    el.className = `msg ${msg.role}`;
    el.dataset.id = msg.id;

    if (msg.role === "user") {
      const b = document.createElement("div");
      b.className = "bubble";
      b.textContent = msg.text;
      el.appendChild(b);
      return el;
    }

    if (msg.status === "thinking") {
      el.innerHTML = `<div class="thought thinking"><span class="t-label">Thinking</span></div>`;
      return el;
    }

    el.innerHTML = `
      <div class="thought done" role="button" tabindex="0" aria-expanded="false">
        <span class="t-label">Thought for ${msg.secs}s</span>${icon("chev-r")}
      </div>
      <div class="thought-body" hidden>Done</div>
      <div class="content"><p></p></div>
      <div class="actions">
        <button class="act" data-act="copy" data-tip="Copy" aria-label="Copy">${icon("copy")}</button>
        <button class="act" data-act="up" data-tip="Good response" aria-label="Good response">${icon("up")}</button>
        <button class="act" data-act="down" data-tip="Bad response" aria-label="Bad response">${icon("down")}</button>
        <button class="act" data-act="speak" data-tip="Read aloud" aria-label="Read aloud">${icon("speaker")}</button>
        <button class="act" data-act="share" data-tip="Share" aria-label="Share">${icon("share")}</button>
        <button class="act" data-act="retry" data-tip="Try again..." aria-label="Try again">${icon("retry")}</button>
        <button class="act" data-act="more" data-tip="More actions" aria-label="More actions">${icon("more")}</button>
      </div>`;
    const p = el.querySelector(".content p");
    const word = document.createElement("span");
    if (animate) word.className = "word";
    word.textContent = msg.text;
    p.appendChild(word);
    return el;
  }

  function renderChatList(freshId) {
    chatsSection.hidden = chats.length === 0;
    chatList.innerHTML = "";
    for (const chat of chats) {
      const li = document.createElement("li");
      const a = document.createElement("button");
      a.className = "chat-link" + (chat === current ? " active" : "") + (chat.id === freshId ? " fresh" : "");
      a.dataset.chat = chat.id;
      const span = document.createElement("span");
      span.className = "chat-title";
      span.textContent = chat.title;
      a.append(span);
      a.insertAdjacentHTML("beforeend", `<span class="chat-more" aria-hidden="true">${icon("more")}</span>`);
      li.appendChild(a);
      chatList.appendChild(li);
    }
  }

  function enterThreadMode() {
    main.classList.remove("is-empty");
    shareBtn.hidden = false;
    document.title = current ? current.title : "ChatGPT";
  }

  function showChat(chat) {
    current = chat;
    messagesEl.innerHTML = "";
    for (const m of chat.messages) messagesEl.appendChild(renderMessage(m));
    enterThreadMode();
    renderChatList();
    updateSendState();
    closeMobileSidebar();
    requestAnimationFrame(() => scrollToBottom(false));
  }

  function newChat() {
    current = null;
    messagesEl.innerHTML = "";
    main.classList.add("is-empty");
    shareBtn.hidden = true;
    headline.textContent = pick(HEADLINES);
    document.title = "ChatGPT";
    renderChatList();
    updateSendState();
    closeMobileSidebar();
    if (!coarsePointer) prompt.focus();
  }

  // ───────────── Message actions ─────────────
  messagesEl.addEventListener("click", (e) => {
    const thought = e.target.closest(".thought.done");
    if (thought) {
      const body = thought.nextElementSibling;
      const open = body.hidden;
      body.hidden = !open;
      thought.classList.toggle("open", open);
      thought.setAttribute("aria-expanded", String(open));
      return;
    }

    const btn = e.target.closest(".act");
    if (!btn) return;
    const msgEl = btn.closest(".msg");
    const msg = current && current.messages.find((m) => m.id === msgEl.dataset.id);
    if (!msg) return;

    switch (btn.dataset.act) {
      case "copy": {
        const done = () => {
          btn.innerHTML = icon("check");
          btn.dataset.tip = "Copied";
          setTimeout(() => { btn.innerHTML = icon("copy"); btn.dataset.tip = "Copy"; }, 2000);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(msg.text).then(done, done);
        else done();
        break;
      }
      case "up":
      case "down": {
        const other = msgEl.querySelector(`[data-act="${btn.dataset.act === "up" ? "down" : "up"}"]`);
        const on = !btn.classList.contains("on");
        btn.classList.toggle("on", on);
        other.hidden = on;
        if (on) toast("Thank you for your feedback!");
        break;
      }
      case "speak":
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel();
          speechSynthesis.speak(new SpeechSynthesisUtterance(msg.text));
        }
        break;
      case "share":
        shareLink();
        break;
      case "retry":
        if (!pending) ask(current, msg);
        break;
    }
  });
  messagesEl.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".thought.done")) {
      e.preventDefault();
      e.target.click();
    }
  });

  function shareLink() {
    const done = () => toast("Link copied to clipboard");
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, done);
    else done();
  }
  shareBtn.addEventListener("click", shareLink);

  // ───────────── Sidebar ─────────────
  function closeMobileSidebar() { app.classList.remove("sb-mobile-open"); }

  $("sb-close").addEventListener("click", () => {
    if (mqMobile.matches) closeMobileSidebar();
    else app.classList.add("sb-collapsed");
  });
  $("logo-btn").addEventListener("click", () => {
    if (app.classList.contains("sb-collapsed") && !mqMobile.matches) app.classList.remove("sb-collapsed");
    else newChat();
  });
  $("sb-open-mobile").addEventListener("click", () => app.classList.add("sb-mobile-open"));
  $("scrim").addEventListener("click", closeMobileSidebar);
  $("new-chat-side").addEventListener("click", newChat);
  $("new-chat-mobile").addEventListener("click", newChat);
  chatList.addEventListener("click", (e) => {
    const link = e.target.closest(".chat-link");
    if (!link) return;
    const chat = chats.find((c) => c.id === link.dataset.chat);
    if (chat && chat !== current) showChat(chat);
    else closeMobileSidebar();
  });

  // ───────────── Model menu ─────────────
  function setMenu(open) {
    modelMenu.hidden = !open;
    modelBtn.setAttribute("aria-expanded", String(open));
  }
  modelBtn.addEventListener("click", (e) => { e.stopPropagation(); setMenu(modelMenu.hidden); });
  modelMenu.addEventListener("click", (e) => { if (e.target.closest("[data-close-menu]")) setMenu(false); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".model-wrap")) setMenu(false); });

  // ───────────── Keyboard shortcuts ─────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setMenu(false); closeMobileSidebar(); }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); }
  });

  // ───────────── Boot ─────────────
  headline.textContent = pick(HEADLINES);
  updateSendState();
  if (!coarsePointer) prompt.focus();
})();
