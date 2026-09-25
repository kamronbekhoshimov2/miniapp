(function () {
  const tg =
    window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const titles = {
    ask: "Savol yuborish",
    questions: "Mening savollarim",
    chat: "Ustoz bilan suhbat",
    rating: "Reyting",
    profile: "Profil",
  };
  const questionStatuses = {
    new: "Ustoz qidirilmoqda",
    accepted: "Faol suhbat",
    closed: "Yechildi",
    redirected: "Qayta yuborildi",
  };
  const state = {
    subject: "Matematika",
    dark: false,
    view: "ask",
    userName: "Test foydalanuvchi",
    sending: false,
    questions: [],
  };
  const elements = {
    form: document.getElementById("questionForm"),
    subjectGrid: document.getElementById("subjectGrid"),
    questionText: document.getElementById("questionText"),
    counter: document.getElementById("counter"),
    submitButton: document.getElementById("submitButton"),
    status: document.getElementById("telegramStatus"),
    sendStatus: document.getElementById("sendStatus"),
    toast: document.getElementById("toast"),
    themeButton: document.getElementById("themeButton"),
    pageTitle: document.getElementById("pageTitle"),
    questionsList: document.getElementById("questionsList"),
    questionSummary: document.getElementById("questionSummary"),
    profileName: document.getElementById("profileName"),
    profileInitials: document.getElementById("profileInitials"),
    profileDisplayName: document.getElementById("profileDisplayName"),
    profileQuestionCount: document.getElementById("profileQuestionCount"),
    saveProfileButton: document.getElementById("saveProfileButton"),
    returnToBotButton: document.getElementById("returnToBotButton"),
  };

  function getQuestions() {
    return state.questions;
  }
  function saveQuestions(questions) {
    state.questions = questions;
  }
  async function apiRequest(path, options) {
    if (!tg || !tg.initData) throw new Error("Telegram ma'lumoti topilmadi");
    const response = await window.fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": tg.initData,
        ...(options && options.headers),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Server xatosi");
    return data;
  }
  async function refreshFromServer() {
    const data = await apiRequest("/api/bootstrap");
    state.userName = data.user.name;
    saveQuestions(data.questions);
    renderProfile();
    renderQuestions();
  }
  function escapeHtml(value) {
    return String(value).replace(
      /[&<>\"]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
    );
  }
  function formatDate(value) {
    return new Intl.DateTimeFormat("uz-UZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }
  function initials(name) {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "N"
    );
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(
      () => elements.toast.classList.remove("is-visible"),
      2600,
    );
  }

  function renderProfile() {
    const questions = getQuestions();
    elements.profileName.textContent = state.userName;
    elements.profileInitials.textContent = initials(state.userName);
    elements.profileDisplayName.value = state.userName;
    elements.profileQuestionCount.textContent = String(questions.length);
  }

  function renderQuestions() {
    const questions = getQuestions();
    elements.questionSummary.textContent = questions.length
      ? questions.length + " ta savol saqlandi."
      : "Hali savol yuborilmagan.";
    elements.profileQuestionCount.textContent = String(questions.length);
    if (!questions.length) {
      elements.questionsList.innerHTML =
        '<div class="empty-list">Savol yuborganingizdan keyin uning holati shu yerda chiqadi.</div>';
      return;
    }
    elements.questionsList.innerHTML = questions
      .map(
        (item) =>
          '<article class="question-item"><div class="item-meta"><span>' +
          escapeHtml(item.subject) +
          '</span><span class="item-status">' +
          escapeHtml(questionStatuses[item.status] || item.status) +
          "</span></div><p>" +
          escapeHtml(item.question_text) +
          "</p><time>" +
          formatDate(item.created_at) +
          "</time></article>",
      )
      .join("");
  }

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".view").forEach((section) => {
      const active = section.dataset.view === view;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === view;
      button.classList.toggle("is-active", active);
      button.toggleAttribute("aria-current", active);
    });
    elements.pageTitle.textContent = titles[view];
    if (view === "questions") {
      renderQuestions();
      if (tg && tg.initData) refreshFromServer().catch(() => {});
    }
    if (view === "profile") renderProfile();
    updateSubmitState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateSubmitState() {
    const hasQuestion = elements.questionText.value.trim().length >= 5;
    elements.submitButton.disabled = !hasQuestion || state.sending;
    elements.counter.textContent = elements.questionText.value.length + "/1200";
    if (tg && tg.MainButton) {
      if (state.view === "ask" && hasQuestion && !state.sending) {
        tg.MainButton.setText("Ustozga yuborish");
        tg.MainButton.show();
        tg.MainButton.enable();
      } else {
        tg.MainButton.hide();
      }
    }
  }

  function setSubject(button) {
    state.subject = button.dataset.subject;
    elements.subjectGrid.querySelectorAll(".subject-option").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-checked", String(active));
    });
  }

  async function submitQuestion(event) {
    if (event && event.preventDefault) event.preventDefault();
    const question = elements.questionText.value.trim();
    if (question.length < 5 || state.sending) {
      if (question.length < 5)
        showToast("Savol kamida 5 ta belgidan iborat bo'lsin.");
      return;
    }
    state.sending = true;
    elements.sendStatus.textContent = "Yuborilmoqda";
    updateSubmitState();

    if (tg && tg.initData) {
      try {
        const data = await apiRequest("/api/questions", {
          method: "POST",
          body: JSON.stringify({
            subject: state.subject,
            question_text: question,
          }),
        });
        saveQuestions([data.question, ...getQuestions()].slice(0, 30));
        elements.questionText.value = "";
        renderQuestions();
        elements.sendStatus.textContent = "Yuborildi";
        showToast("Savol ustozlarga yuborildi.");
      } catch (error) {
        state.sending = false;
        elements.sendStatus.textContent = "Xatolik";
        updateSubmitState();
        showToast(error.message || "Savol yuborilmadi. Qaytadan urinib ko'ring.");
        return;
      }
      state.sending = false;
      updateSubmitState();
      return;
    }

    state.sending = false;
    elements.sendStatus.textContent = "Telegram ichida oching";
    updateSubmitState();
    showToast("Savol yuborish uchun Mini App'ni Telegram ichida oching.");
  }

  async function initTelegram() {
    if (!tg) {
      elements.status.textContent = "Brauzerda test rejimi";
      renderProfile();
      return;
    }
    tg.ready();
    tg.expand();
    const user =
      tg.initDataUnsafe && tg.initDataUnsafe.user
        ? tg.initDataUnsafe.user
        : null;
    const telegramName = user
      ? [user.first_name, user.last_name].filter(Boolean).join(" ")
      : "";
    state.userName =
      telegramName ||
      (user && user.username ? "@" + user.username : "Telegram foydalanuvchi");
    elements.status.textContent = "Server bilan ulanmoqda";
    if (tg.colorScheme === "dark") {
      state.dark = true;
      document.body.classList.add("dark");
    }
    if (tg.MainButton) tg.MainButton.onClick(submitQuestion);
    if (tg.BackButton) tg.BackButton.onClick(() => setView("ask"));
    try {
      await refreshFromServer();
      elements.status.textContent = "Telegram va server ulandi";
    } catch (_) {
      elements.status.textContent = "Serverga ulanib bo'lmadi";
      showToast("Ma'lumotlarni yuklab bo'lmadi. Keyinroq qaytadan oching.");
    }
  }

  elements.subjectGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".subject-option");
    if (button) setSubject(button);
  });
  elements.questionText.addEventListener("input", updateSubmitState);
  elements.form.addEventListener("submit", submitQuestion);
  document.querySelectorAll("[data-template]").forEach((button) =>
    button.addEventListener("click", () => {
      const current = elements.questionText.value.trim();
      elements.questionText.value = current
        ? current + "\n\n" + button.dataset.template
        : button.dataset.template;
      elements.questionText.focus();
      updateSubmitState();
    }),
  );
  document
    .querySelectorAll("[data-nav]")
    .forEach((button) =>
      button.addEventListener("click", () => setView(button.dataset.nav)),
    );
  elements.themeButton.addEventListener("click", () => {
    state.dark = !state.dark;
    document.body.classList.toggle("dark", state.dark);
  });
  elements.saveProfileButton.addEventListener("click", async () => {
    const name = elements.profileDisplayName.value.trim();
    if (!name) {
      showToast("Ismni kiriting.");
      return;
    }
    if (!tg || !tg.initData) {
      showToast("Profilni saqlash uchun Mini App'ni Telegram ichida oching.");
      return;
    }
    try {
      const data = await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      state.userName = data.name;
      renderProfile();
      showToast("Profil saqlandi.");
    } catch (error) {
      showToast(error.message || "Profil saqlanmadi.");
    }
  });
  elements.returnToBotButton.addEventListener("click", () => {
    if (tg && typeof tg.close === "function") {
      tg.close();
    } else {
      showToast("Suhbat Telegram botda davom etadi.");
    }
  });

  initTelegram().finally(() => {
    renderQuestions();
    updateSubmitState();
  });
})();
