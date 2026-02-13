let schemaData = null;
let currentFieldIndex = 0;
let awaitingConfirmation = false;
let lastTranscript = "";
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = false;

// Load form schema
async function loadForm() {
  try {
    const response = await fetch("./formSchema.json");
    schemaData = await response.json();
  } catch (error) {
    console.error("Could not load schema, using fallback:", error);
    schemaData = {
      fields: [
        {type: "text", id: "name", label: "Name"},
        {type: "date", id: "dob", label: "Date of Birth"}
      ]
    };
  }
  renderForm(schemaData);
  promptNextField();
}

// Render form (same as before)
function renderForm(schema) {
  const form = document.getElementById("userForm");
  form.innerHTML = "";
  schema.fields.forEach(field => {
    const label = document.createElement("label");
    label.innerText = field.label + ": ";
    const input = document.createElement("input");
    input.type = "text"; // simplified for chatbot flow
    input.id = field.id;
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(document.createElement("br"));
  });
  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.innerText = "Submit";
  form.appendChild(submitBtn);
}

// Speak prompt aloud
function speakPrompt(text) {
  const selectedLang = document.getElementById("lang").value;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedLang;

  // Ensure voices are loaded
  let voices = speechSynthesis.getVoices();
  if (!voices.length) {
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === selectedLang) || voices[0];
      utterance.voice = voice;
      speechSynthesis.speak(utterance);
    };
  } else {
    const voice = voices.find(v => v.lang === selectedLang) || voices[0];
    utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }
}

// Prompt next field
function promptNextField() {
  if (currentFieldIndex < schemaData.fields.length) {
    const field = schemaData.fields[currentFieldIndex];
    const promptText = `Please say your ${field.label}.`;
    document.getElementById("confirmation").innerText = promptText;
    speakPrompt(promptText);
    recognition.lang = document.getElementById("lang").value;
    recognition.start();
  } else {
    const doneText = "All fields completed. Please review and submit.";
    document.getElementById("confirmation").innerText = doneText;
    speakPrompt(doneText);
  }
}

// Handle ambiguity
function interpretResponse(transcript, fieldId) {
  if (fieldId === "dob" && transcript.toLowerCase().includes("next monday")) {
    const clarifyText = "Did you mean Monday, February 16, 2026? Please say Yes or No.";
    document.getElementById("confirmation").innerText = clarifyText;
    speakPrompt(clarifyText);
    awaitingConfirmation = true;
    lastTranscript = "2026-02-16";
    return null;
  }
  return transcript;
}

// Handle speech result
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  const field = schemaData.fields[currentFieldIndex];

  if (awaitingConfirmation) {
    const normalized = transcript.toLowerCase().trim();

    if (normalized.startsWith("yes") || normalized.startsWith("yeah") || normalized.startsWith("yep")) {
      document.getElementById(field.id).value = lastTranscript;
      awaitingConfirmation = false;
      currentFieldIndex++;
      setTimeout(promptNextField, 1500); // move to next prompt
    } else if (normalized.startsWith("no")) {
      const retryText = "Okay, please repeat your answer.";
      document.getElementById("confirmation").innerText = retryText;
      speakPrompt(retryText);
      awaitingConfirmation = false;
      recognition.start();
    } else {
      const unclearText = "I didn’t catch that. Please say Yes or No.";
      document.getElementById("confirmation").innerText = unclearText;
      speakPrompt(unclearText);
      recognition.start();
    }
    return; // important: stop here so it doesn’t process as a normal answer
  }

  // Normal answer handling continues here...
  const interpreted = interpretResponse(transcript, field.id);
  if (interpreted) {
    document.getElementById(field.id).value = interpreted;
    const confirmText = `You said: "${interpreted}" for ${field.label}. Is this correct? Please say Yes or No.`;
    document.getElementById("confirmation").innerText = confirmText;
    speakPrompt(confirmText);
    awaitingConfirmation = true;
    lastTranscript = interpreted;
  }
};

recognition.onerror = (event) => {
  document.getElementById("confirmation").innerText = "Error: " + event.error;
};

window.onload = loadForm;
