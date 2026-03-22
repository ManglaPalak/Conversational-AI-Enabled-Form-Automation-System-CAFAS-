from flask import Flask, render_template, request, jsonify
import spacy
import re
from dateutil import parser as dateparser

app = Flask(__name__)
nlp = spacy.load("en_core_web_sm")

# 🔥 GLOBAL MEMORY (NEW)
conversation_memory = {}

# ---------------- TRANSCRIPT NORMALIZATION ----------------
def normalize_text(text):

    text = text.lower()

    text = text.replace(" at ", "@")
    text = text.replace(" dot ", ".")
    text = text.replace(" underscore ", "_")
    text = text.replace(" dash ", "-")

    fillers = ["uh", "um", "hello", "hi", "okay", "ok"]
    for f in fillers:
        text = text.replace(f, "")

    return text.strip()


# ---------------- NAME ----------------
def extract_name(text):
    match = re.search(r"(?:my name is|i am|i'm)\s([a-zA-Z ]{3,})", text)
    if match:
        return match.group(1).strip().title()

    doc = nlp(text.title())
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text

    return None


# ---------------- EMAIL ----------------
def extract_email(text):
    match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}", text)
    return match.group() if match else None


# ---------------- DOB ----------------
def extract_dob(text):

    patterns = [
        r"(?:born on|date of birth is|dob is|i was born on)\s(.+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                dt = dateparser.parse(match.group(1), fuzzy=True)
                return dt.strftime("%Y-%m-%d")
            except:
                pass

    try:
        dt = dateparser.parse(text, fuzzy=True)
        if dt.year < 2020:
            return dt.strftime("%Y-%m-%d")
    except:
        return None

    return None


# ---------------- GENDER ----------------
def extract_gender(text):
    if "female" in text:
        return "Female"
    if "male" in text:
        return "Male"
    if "other" in text:
        return "Other"
    return None


# ---------------- INTERESTS ----------------
def extract_interests(text):
    interests = []
    if "music" in text: interests.append("Music")
    if "sports" in text or "cricket" in text or "football" in text:
        interests.append("Sports")
    if "tech" in text or "coding" in text or "programming" in text:
        interests.append("Tech")
    return interests


# ---------------- RATING ----------------
def extract_rating(text):
    words = {"one":1,"two":2,"three":3,"four":4,"five":5}

    num = re.findall(r"\b[1-5]\b", text)
    if num:
        return int(num[0])

    for w,v in words.items():
        if w in text:
            return v

    return None


# ================= NEW: MULTI-FIELD EXTRACTION =================
def extract_all(text):

    data = {}

    name = extract_name(text)
    email = extract_email(text)
    dob = extract_dob(text)
    gender = extract_gender(text)
    interests = extract_interests(text)
    rating = extract_rating(text)

    if name: data["name"] = name
    if email: data["email"] = email
    if dob: data["dob"] = dob
    if gender: data["gender"] = gender
    if interests: data["interest"] = interests
    if rating: data["rating"] = rating

    return data


# ================= NEW: INTENT DETECTION =================
def detect_intent(text):
    if "change" in text or "update" in text:
        return "UPDATE"
    elif "submit" in text:
        return "SUBMIT"
    elif "my" in text or "i am" in text:
        return "PROVIDE_INFO"
    return "UNKNOWN"


# ================= NEW: MEMORY =================
def update_memory(new_data):
    global conversation_memory
    conversation_memory.update(new_data)
    return conversation_memory


# ---------------- ROUTE ----------------
@app.route('/')
def index():
    return render_template('index.html')


# ================= MAIN API =================
@app.route('/process-voice', methods=['POST'])
def process_voice():
    transcript = request.json.get('text', '')
    current_field = request.json.get('currentField')  # 👈 NEW

    clean_text = normalize_text(transcript)

    extracted = {}

    # ---------- NORMAL EXTRACTION ----------
    name = extract_name(clean_text)
    email = extract_email(clean_text)
    dob = extract_dob(clean_text)
    gender = extract_gender(clean_text)
    interests = extract_interests(clean_text)
    rating = extract_rating(clean_text)

    if name:
        extracted["name"] = name
    if email:
        extracted["email"] = email
    if dob:
        extracted["dob"] = dob
    if gender:
        extracted["gender"] = gender
    if interests:
        extracted["interest"] = interests
    if rating:
        extracted["rating"] = rating

    # ---------- 🔥 CONTEXT FALLBACK ----------
    if not extracted and current_field:

        if current_field == "name":
            extracted["name"] = clean_text.title()

        elif current_field == "email":
            extracted["email"] = clean_text

        elif current_field == "gender":
            if "male" in clean_text:
                extracted["gender"] = "Male"
            elif "female" in clean_text:
                extracted["gender"] = "Female"
            else:
                extracted["gender"] = "Other"

        elif current_field == "interest":
            extracted["interest"] = [clean_text.capitalize()]

        elif current_field == "rating":
            try:
                extracted["rating"] = int(clean_text)
            except:
                pass

    return jsonify({
        "data": extracted,
        "status": "Mapped successfully" if extracted else "No clear data found",
        "raw_transcript": transcript
    })


# ================= OPTIONAL SAVE ROUTE =================
@app.route('/save', methods=['POST'])
def save():
    data = request.json
    print("Saved Data:", data)
    return jsonify({"message": "Data saved successfully"})


if __name__ == '__main__':
    app.run(debug=True)