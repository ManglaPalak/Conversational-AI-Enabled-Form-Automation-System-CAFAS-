/* ================= STATE ================= */
let currentFieldIndex = 0;
let isMuted = false;
let assistantActive = false;

/* ================= FIELDS ================= */
const fields = [
  { id: "name", label: "name", type: "text" },
  { id: "email", label: "email", type: "text" },
  { id: "dob", label: "date of birth", type: "date" },
  { id: "gender", label: "gender", type: "radio" },
  { id: "interest", label: "interests", type: "checkbox" },
  { id: "rating", label: "satisfaction", type: "rating" }
];

/* ================= SPEECH ================= */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous = false;

/* 🔥 SAFE START FIX */
function safeStartRecognition() {
  try {
    recognition.start();
  } catch (e) {
    setTimeout(() => {
      try { recognition.start(); } catch (err) {}
    }, 300);
  }
}

let voices = [];
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

/* ================= SPEAK ================= */
function speak(text, callback) {
  if (isMuted) return;

  speechSynthesis.cancel();

  let voices = speechSynthesis.getVoices();

  const lang = document.getElementById("lang").value || "en-US";

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const voice = voices.find(v => v.lang === lang) 
             || voices.find(v => v.lang.startsWith(lang.split('-')[0]))
             || voices[0];

  if (voice) utterance.voice = voice;

  document.getElementById("confirmation").innerText = text;

  if (callback) {
    utterance.onend = () => setTimeout(callback, 150);
  }

  speechSynthesis.speak(utterance);
}

/* ================= FORM RENDER ================= */
function renderForm() {
  const form = document.getElementById("userForm");
  form.innerHTML = "";

  fields.forEach(field => {
    const card = document.createElement("div");
    card.className = "field-card";
    card.id = "card_" + field.id;

    card.innerHTML = `<label>${field.label}</label>`;

    if (field.type === "text" || field.type === "date") {
      card.innerHTML += `<input type="${field.type}" id="${field.id}">`;
    }

    if (field.type === "radio") {
      ["Male","Female","Other"].forEach(opt => {
        card.innerHTML += `<label><input type="radio" name="${field.id}" id="${field.id}_${opt}"> ${opt}</label>`;
      });
    }

    if (field.type === "checkbox") {
      ["Music","Sports","Tech"].forEach(opt => {
        card.innerHTML += `<label><input type="checkbox" id="interest_${opt}"> ${opt}</label>`;
      });
    }

    if (field.type === "rating") {
      let stars = `<div id="stars">`;
      for (let i = 1; i <= 5; i++) {
        stars += `<span class="star">★</span>`;
      }
      stars += `</div><input type="hidden" id="rating">`;
      card.innerHTML += stars;
    }

    card.innerHTML += `<div class="field-status" id="${field.id}_status"></div>`;

    form.appendChild(card);
  });
}

/* ================= FILL ================= */
function fillField(field, value) {

  if (!value) return;

  const card = document.getElementById("card_" + field.id);
  if (card) {
    card.classList.add("field-filled");
    card.classList.remove("field-active");
  }

  if (field.type === "radio") {
    document.getElementById(`gender_${value}`)?.click();
  }

  else if (field.type === "checkbox") {
    value.forEach(v => {
      document.getElementById(`interest_${v.charAt(0).toUpperCase()+v.slice(1)}`)?.click();
    });
  }

  else if (field.type === "rating") {
    document.getElementById("rating").value = value;
    document.querySelectorAll(".star").forEach((s, i) => {
      s.classList.toggle("active", i < value);
    });
  }

  else {
    document.getElementById(field.id).value = value;
  }

  const status = document.getElementById(field.id + "_status");
  if (status) status.innerText = "✔ Filled";
}

/* ================= PROMPT ================= */
function promptNextField() {
  if (!assistantActive) return;

  updateProgressBar();

  if (currentFieldIndex >= fields.length) {
    speak("All fields completed. Submitting your form now.", saveData);
    return;
  }

  const field = fields[currentFieldIndex];

  document.querySelectorAll(".field-card").forEach(c => c.classList.remove("field-active"));

  const active = document.getElementById("card_" + field.id);
  if (active) {
    active.classList.add("field-active");
    active.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const prompts = {
    name: "Please tell me your full name",
    email: "Please say your email address",
    dob: "Please tell your date of birth",
    gender: "Please say your gender: male, female or other",
    interest: "Tell me your interests like music, sports or tech",
    rating: "Rate your satisfaction from 1 to 5"
  };

  speak(prompts[field.id], () => safeStartRecognition());
}

/* ================= VOICE ================= */
recognition.onstart = () => {
  document.getElementById("micIndicator").classList.add("active");
  document.getElementById("waveform")?.classList.remove("hidden");
};

recognition.onend = () => {
  document.getElementById("micIndicator").classList.remove("active");
  document.getElementById("waveform")?.classList.add("hidden");

  if (assistantActive) {
    setTimeout(() => safeStartRecognition(), 200);
  }
};

/* ================= VOICE RESULT ================= */
recognition.onresult = async (event) => {

  const transcript = event.results[0][0].transcript;
  document.getElementById("heardText").innerText = transcript;

  try {
    const res = await fetch("/process-voice", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ text: transcript })
    });

    const data = await res.json();

    if (data.data && Object.keys(data.data).length > 0) {

      Object.keys(data.data).forEach(key => {
        const field = fields.find(f => f.id === key);
        if (field) fillField(field, data.data[key]);
      });

      currentFieldIndex++;

    } else {
      speak("I didn't understand. Please repeat.", () => safeStartRecognition());
      return;
    }

  } catch (err) {
    speak("Connection error. Please repeat.", () => safeStartRecognition());
    return;
  }

  setTimeout(promptNextField, 120);
};

/* ================= ERROR ================= */
recognition.onerror = () => {
  if (!assistantActive) return;
  speak("Please repeat.", () => safeStartRecognition());
};

/* ================= PROGRESS ================= */
function updateProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  bar.style.width = ((currentFieldIndex / fields.length) * 100) + "%";
}

/* ================= SAVE ================= */
function saveData() {
  const data = {};

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) data[f.id] = el.value;
  });

  fetch("/save", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(data)
  });

  speak("Your form has been submitted successfully. Thank you.");
}

/* ================= INIT ================= */
window.onload = () => {
  // preload voices properly
  speechSynthesis.onvoiceschanged = () => {
    voices = speechSynthesis.getVoices();
  };
  voices = speechSynthesis.getVoices();

  // render dynamic form if using #userForm
  renderForm();

  document.getElementById("startAssistant").onclick = () => {
    assistantActive = true;
    currentFieldIndex = 0;

    speechSynthesis.cancel();

    recognition.lang = document.getElementById("lang").value;

    speak("Assistant started. Let's begin.", promptNextField);
  };

  document.getElementById("stopAssistant").onclick = () => {
    assistantActive = false;
    recognition.stop();
    speechSynthesis.cancel();
    document.getElementById("confirmation").innerText = "Assistant stopped.";
  };

  document.getElementById("muteBtn").onclick = () => {
    isMuted = !isMuted;

    if (isMuted) {
      speechSynthesis.cancel();
      recognition.stop();
      document.getElementById("confirmation").innerText = "Muted";
    } else {
      speak("Resuming.", promptNextField);
    }
  };
};