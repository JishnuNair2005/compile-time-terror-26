# 🎓 ClassPulse  
### Live Classroom Comprehension Tool  

🚀 A smart, real-time classroom feedback system that helps teachers instantly understand student comprehension — anonymously, efficiently, and intelligently.

---

## 🌍 Problem Statement
In classrooms with large student counts, teachers struggle to identify who has understood the concept and who hasn’t. Students hesitate to speak up due to fear or hesitation, leading to learning gaps.

---

## 💡 Our Solution
**ClassPulse** enables students to send instant, anonymous comprehension signals:
- ✅ Got It  
- 🤔 Sort Of  
- ❌ Lost  

Teachers receive **live aggregated insights** and can adjust their teaching in real-time.

---

## ✨ Key Features

### 👨‍🎓 Student Side
- Join session using **4-digit code or QR scan**
- One-tap feedback system (Got it / Sort of / Lost)
- Submit **anonymous questions**
- Timer-based response locking
- Works with **low interaction effort (1 tap)**

---

### 👩‍🏫 Teacher Side
- Real-time **class comprehension dashboard**
- Live distribution of responses
- Anonymous **question queue**
- Detect confusion spikes instantly
- Session summary insights

---

## 🧠 Smart Features (USP)

### 🤖 AI Bouncer (LLM-Based Filtering)
- Filters **irrelevant or spam questions**
- Ensures only subject-related queries reach teacher

---

### 📊 Device-Level Behavior Tracking
- Each user assigned a **unique deviceId**
- Tracks:
  - Repeated "Lost" signals
  - Spam questions
- Maintains **anonymity + accountability**

---

### 🚫 Spam Detection System
- Detects:
  - Off-topic questions
  - Repeated spam inputs
- Maintains **falseCount per device per subject**
- Enables **automatic flagging**

---

### 🔁 Question Deduplication
- Uses:
  - TF-IDF (offline)
  - Embeddings (AI)
- Merges similar questions
- Prevents clutter in teacher dashboard

---

## 🏗️ Tech Stack

### 📱 Frontend
- React Native (Expo)
- AsyncStorage (device tracking)
- Expo Camera (QR scanning)
- Animated UI + Custom Alerts

---

### ⚙️ Backend
- Python (FastAPI / Flask)
- REST APIs
- AI Integration (LLM + Embeddings)

---

### ☁️ Database
- Firestore (NoSQL)
- Collections:
  - sessions
  - responses
  - questions
  - deviceSubjectStats

---

### 🧠 AI & ML
- LLM for question validation
- TF-IDF for offline similarity
- Embeddings for semantic matching

---

## 🔄 System Flow

1. Student joins session  
2. Sends comprehension signal  
3. (Optional) submits question  
4. AI validates relevance  
5. Backend:
   - Updates counters
   - Detects spam
   - Merges similar questions  
6. Teacher sees real-time insights  

---

## 🔐 Privacy & Design Philosophy
- ❌ No login required  
- ❌ No personal data stored  
- ✅ Anonymous participation  
- ✅ Device-level tracking only  

---

## 🚀 How to Run

### 📱 Frontend
```bash
npm install
npx expo start

 ####  Backend
```bash
uvicorn 