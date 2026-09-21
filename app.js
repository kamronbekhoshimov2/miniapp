(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  const state = {
    subject: "Matematika",
    dark: false,
  };

  const elements = {
    form: document.getElementById("questionForm"),
    subjectGrid: document.getElementById("subjectGrid"),
    questionText: document.getElementById("questionText"),
    counter: document.getElementById("counter"),
    submitButton: document.getElementById("submitButton"),
    status: document.getElementById("telegramStatus"),
    userName: document.getElementById("userName"),
    sendStatus: document.getElementById("sendStatus"),
    toast: document.getElementById("toast"),
    themeButton: document.getElementById("themeButton"),
  };

  function initTelegram() {
    if (!tg) {
      elements.status.textContent = "Brauzerda test rejimi";
      elements.userName.textContent = "Test foydalanuvchi";
      return;
    }

    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
    const fullName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "";

    elements.status.textContent = "Telegram ulandi";
    elements.userName.textContent = fullName || (user && user.username ? "@" + user.username : "Telegram user");

    if (tg.colorScheme === "dark") {
      state.dark = true;
      document.body.classList.add("dark");
    }

    if (tg.MainButton) {
      tg.MainButton.setText("Ustozga yuborish");
      tg.MainButton.onClick(submitQuestion);
    }
  }

  function updateSubmitState() {
    const hasQuestion = elements.questionText.value.trim().length >= 5;
    elements.submitButton.disabled = !hasQuestion;
    elements.counter.textContent = elements.questionText.value.length + "/1200";

    if (tg && tg.MainButton) {
      if (hasQuestion) {
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

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 2400);
  }

  function submitQuestion(event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    const question = elements.questionText.value.trim();
    if (question.length < 5) {
      showToast("Savol kamida 5 ta belgidan iborat bo'lsin.");
      return;
    }

    const payload = {
      action: "submit_question",
      subject: state.subject,
      question_type: "text",
      question_text: question,
      sent_at: new Date().toISOString(),
    };

    elements.sendStatus.textContent = "Yuborildi";

    if (tg && typeof tg.sendData === "function") {
      tg.sendData(JSON.stringify(payload));
      tg.close();
      return;
    }

    window.localStorage.setItem("nomiyo_last_question", JSON.stringify(payload));
    showToast("Test rejimida saqlandi. Telegram ichida botga yuboriladi.");
  }

  elements.subjectGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".subject-option");
    if (button) {
      setSubject(button);
    }
  });

  elements.questionText.addEventListener("input", updateSubmitState);
  elements.form.addEventListener("submit", submitQuestion);

  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = elements.questionText.value.trim();
      const template = button.dataset.template;
      elements.questionText.value = current ? current + "\n\n" + template : template;
      elements.questionText.focus();
      updateSubmitState();
    });
  });

  elements.themeButton.addEventListener("click", () => {
    state.dark = !state.dark;
    document.body.classList.toggle("dark", state.dark);
  });

  initTelegram();
  updateSubmitState();
})();
