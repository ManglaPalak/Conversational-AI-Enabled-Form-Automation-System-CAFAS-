let schemaData = null;
let currentFieldIndex = 0;
let awaitingConfirmation = false;
let lastTranscript = "";
let isMuted = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;
recognition.continuous = true; // keep listening until explicitly stopped

let voices = [];
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

function speak(text) {
  if (isMuted) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = document.getElementById("lang").value;
  const voice = voices.find(v => v.lang === utterance.lang) || voices[0];
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

async function loadForm() {
  const response = await fetch("./formSchema.json");
  schemaData = await response.json();
  renderForm(schemaData);
  initProgressBar(schemaData.fields.length);
  promptNextField();
}

function renderForm(schema) {
  const form = document.getElementById("userForm");
  form.innerHTML = "";
  schema.fields.forEach(field => {
    const label = document.createElement("label");
    label.innerText = field.label + ": ";
    form.appendChild(label);

    if (field.type === "checkbox") {
      field.options.forEach(opt => {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = opt;
        cb.name = field.id;
        cb.id = field.id + "_" + opt;
        form.appendChild(cb);
        form.appendChild(document.createTextNode(opt));
      });
    } else if (field.type === "radio") {
      field.options.forEach(opt => {
        const rb = document.createElement("input");
        rb.type = "radio";
        rb.value = opt;
        rb.name = field.id;
        rb.id = field.id + "_" + opt;
        form.appendChild(rb);
        form.appendChild(document.createTextNode(opt));
      });
    } else if (field.type === "rating") {
      const ratingDiv = document.createElement("div");
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement("span");
        star.innerText = "★";
        star.className = "star";
        star.dataset.value = i;
        star.onclick = () => {
          document.getElementById(field.id).value = i;
          updateRatingBar(i);
        };
        ratingDiv.appendChild(star);
      }
      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.id = field.id;
      ratingDiv.appendChild(hiddenInput);
      form.appendChild(ratingDiv);

      const ratingBar = document.createElement("div");
      ratingBar.className = "progress-bar";
      ratingBar.id = "ratingBar";
      form.appendChild(ratingBar);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.id = field.id;
      form.appendChild(input);
    }
    form.appendChild(document.createElement("br"));
  });
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.innerText = "Submit";
  form.appendChild(submitBtn);
}

function updateRatingBar(value) {
  const bar = document.getElementById("ratingBar");
  bar.style.width = (value * 20) + "%";
}

function promptNextField() {
  updateProgressBar();
  if (currentFieldIndex < schemaData.fields.length) {
    const field = schemaData.fields[currentFieldIndex];
    let promptText;
    if (field.type === "rating") {
      promptText = "On a scale of 1 to 5, how satisfied are you?";
    } else if (field.type === "checkbox" || field.type === "radio") {
      promptText = `Please say your ${field.label}. Options are: ${field.options.join(", ")}.`;
    } else {
      promptText = `Please say your ${field.label}.`;
    }
    document.getElementById("confirmation").innerText = promptText;
    speak(promptText);
    recognition.lang = document.getElementById("lang").value;
    setTimeout(() => recognition.start(), 2000);
  } else {
    const doneText = "Thank you! All fields are completed. Please review and submit.";
    document.getElementById("confirmation").innerText = doneText;
    speak(doneText);
    recognition.stop();
  }
}

recognition.onresult = (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript;
  const field = schemaData.fields[currentFieldIndex];

  if (awaitingConfirmation) {
    const normalized = transcript.toLowerCase().trim();
    if (normalized.includes("yes")) {
      // Save last transcript into the correct field
      if (field.type === "checkbox") {
        field.options.forEach(opt => {
          if (lastTranscript.toLowerCase().includes(opt.toLowerCase())) {
            document.getElementById(field.id + "_" + opt).checked = true;
          }
        });
      } else if (field.type === "radio") {
        field.options.forEach(opt => {
          if (lastTranscript.toLowerCase().includes(opt.toLowerCase())) {
            document.getElementById(field.id + "_" + opt).checked = true;
          }
        });
      } else if (field.type === "rating") {
        const ratingValue = parseInt(lastTranscript.match(/\d+/)?.[0]);
        if (ratingValue >= 1 && ratingValue <= 5) {
          document.getElementById(field.id).value = ratingValue;
          updateRatingBar(ratingValue);
        }
      } else {
        document.getElementById(field.id).value = lastTranscript;
      }

      awaitingConfirmation = false;
      currentFieldIndex++;

      if (currentFieldIndex < schemaData.fields.length) {
        const nextField = schemaData.fields[currentFieldIndex];
        const transitionText = `Thank you for giving your ${field.label}. Now, please state your ${nextField.label}.`;
        document.getElementById("confirmation").innerText = transitionText;
        speak(transitionText);
        setTimeout(() => recognition.start(), 2000);
      } else {
        const doneText = "Thank you! All fields are completed. Please review and submit.";
        document.getElementById("confirmation").innerText = doneText;
        speak(doneText);
        recognition.stop();
      }
    } else if (normalized.includes("no")) {
      const retryText = `Okay, let's try again. Please say your ${field.label}.`;
      document.getElementById("confirmation").innerText = retryText;
      speak(retryText);
      awaitingConfirmation = false;
      setTimeout(() => recognition.start(), 2000);
    } else {
      const unclearText = "I didn’t catch that. Please say Yes or No.";
      document.getElementById("confirmation").innerText = unclearText;
      speak(unclearText);
      setTimeout(() => recognition.start(), 2000);
    }
    return;
  }

  // Save transcript temporarily
  lastTranscript = transcript;

  const confirmText = `You said: "${transcript}" for ${field.label}. Is this correct? Please say Yes or No.`;
  document.getElementById("confirmation").innerText = confirmText;
  speak(confirmText);
  awaitingConfirmation = true;
};

recognition.onstart = () => {
  document.getElementById("micIndicator").classList.add("active");
};
recognition.onend = () => {
  document.getElementById("micIndicator").classList.remove("active");
  if (!awaitingConfirmation && currentFieldIndex < schemaData.fields.length) {
    setTimeout(() => recognition.start(), 500);
  }
};
recognition.onerror = (event) => {
  document.getElementById("confirmation").innerText = "Error: " + event.error;
};

function initProgressBar(totalFields) {
  const barContainer = document.createElement("div");
  barContainer.className = "progress-container";
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  bar.id = "progressBar";
  barContainer.appendChild(bar);
  document.body.insertBefore(barContainer, document.getElementById("userForm"));
  bar.dataset.total = totalFields;
}

function updateProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  const total = parseInt(bar.dataset.total);
  const progress = (currentFieldIndex / total) * 100;
  bar.style.width = progress + "%";
}

window.onload = () => {
  document.getElementById("startBtn").addEventListener("click", () => {
    // Continue from current progress
    awaitingConfirmation = false;
    updateProgressBar();
    loadForm();
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    // Restart from beginning
    currentFieldIndex = 0;
    awaitingConfirmation = false;
    const bar = document.getElementById("progressBar");
    if (bar) bar.style.width = "0%";
    loadForm();
  });

  document.getElementById("muteBtn").addEventListener("click", () => {
    isMuted = !isMuted;
    document.getElementById("muteBtn").innerText = isMuted ? "Unmute Voice" : "Mute Voice";
  });
};
  