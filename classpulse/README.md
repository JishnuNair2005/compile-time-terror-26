# 📚 ClassPulse  
### Live Classroom Comprehension Tool for Under-Resourced Schools  

🚀 **ClassPulse** is a real-time classroom feedback system that allows students to silently and anonymously indicate their level of understanding during a lesson. It empowers teachers with live insights to make better teaching decisions.

---

## 🎯 Problem Statement

In classrooms with large student numbers, teachers struggle to identify who has understood the lesson and who has not. Students often hesitate to ask questions due to fear or embarrassment.

ClassPulse solves this by:
- Giving students a **voice without speaking**
- Providing teachers with **real-time comprehension insights**

---

## 🌍 SDG Alignment  
**SDG 4: Quality Education**

---

## 💡 Key Features

### 🟢 Core Features
- 🔐 **Session Creation** (4-digit code / QR)
- 📱 **No Login Student Join (PWA)**
- ⚡ **1-Tap Comprehension Buttons**
  - ✅ Got it  
  - 😐 Sort of  
  - ❌ Lost  
- 📊 **Real-Time Dashboard for Teachers**
- 🚨 **Automatic Alerts (e.g., 40% Lost)**

---

### 🟡 Intermediate Features
- 💬 **Anonymous Question Queue**
- 📈 **Session Summary (Comprehension Over Time)**
- 📷 **QR Code Join System**
- 📊 **Live Polling (MCQ)**

---

### 🔴 Advanced Features
- 📴 **Offline Mode (Local Network Support)**
- 💓 **Live Pulse Visualization (Classroom “Heartbeat”)**
- 🧠 **Smart Teaching Suggestions**
- 🔥 **Confusion Heatmap**
- 🌐 **Multi-language Support**

---

## 🛠️ Tech Stack

### Frontend
- React (PWA)
- Tailwind CSS
- Chart.js / Recharts

### Backend
- Firebase (Firestore - real-time database)
- Firebase Hosting

### Additional Tools
- QR Code Generator
- Service Workers (Offline Support)
- Web APIs (Vibration, Speech-to-Text)

---


---

## 🚀 How It Works

1. 👩‍🏫 Teacher starts a session  
2. 🔢 A unique code / QR is generated  
3. 📱 Students join instantly (no login)  
4. 👆 Students tap their understanding level  
5. 📊 Teacher sees live class comprehension  
6. 🚨 Alerts trigger if many students are confused  
7. 💬 Students can send anonymous questions  

---

## 📸 Demo Flow

- Create session  
- Students join  
- Live responses update  
- Trigger confusion spike  
- Show alert  
- Display questions  
- Show session summary  

---

## 🧠 Innovation & Impact

- Encourages **silent participation**
- Works in **low-resource environments**
- Enables **data-driven teaching**
- Reduces **learning gaps in classrooms**

---

## 🏆 Why ClassPulse?

> “ClassPulse turns silent confusion into visible data.”

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/classpulse.git
cd classpulse
