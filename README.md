# 📡 ClassPulse

> A real-time bi-directional classroom engagement platform — teachers see live comprehension signals, students get a voice, and AI handles the analysis.

---

## The Problem

In a lecture of 60 students, a teacher has no reliable way to know who is lost. Students don't raise hands out of social pressure. Questions pile up unasked. The teacher finishes the topic, moves on, and half the class is already three concepts behind.

ClassPulse fixes this with anonymous real-time feedback, a smart question queue, and AI-generated post-class analysis — so no one falls through the cracks.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         React Native + Expo (Frontend)       │
│         Teacher Dashboard + Student App      │
└───────────────┬─────────────────────────────┘
                │ REST + Firebase onSnapshot
┌───────────────▼─────────────────────────────┐
│           FastAPI Backend (Python)           │
│     AI routing, caching, business logic      │
└───────────┬─────────────────────────────────┘
            │                    │
┌───────────▼──────┐   ┌─────────▼──────────┐
│ Firebase Firestore│   │  Llama 3.2 via     │
│                   │   │  OpenAI-compatible │
│ onSnapshot for    │   │  API client        │
│ instant UI sync   │   │                    │
└───────────────────┘   └────────────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │  expo-print + sharing  │
                    │  HTML → PDF export     │
                    └────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| Mobile frontend | React Native + Expo |
| Backend | FastAPI (Python) |
| Database | Firebase Firestore (real-time `onSnapshot`) |
| AI engine | Llama 3.2 via OpenAI-compatible client |
| PDF export | expo-print + expo-sharing |

---

## How It Works

### Teacher flow

1. **Create a room** — specify subject, topic, and session duration. The app generates a 4-digit access code and a scannable QR code instantly.
2. **Live dashboard** — a real-time progress bar shows the exact ratio of students who are *Clear*, *Unsure*, or *Confused*, updating as students vote.
3. **Smart question queue** — written doubts from students appear in real time. The teacher can trigger **AI Smart Sort**, which sends the queue to Llama 3.2 to reorder questions pedagogically — foundational concepts surface first, advanced ones follow, and frequently asked doubts are grouped.
4. **Mark as Explained** — when a teacher resolves a question, it pushes a confirmation modal to the student who asked, closing the feedback loop.
5. **Post-class analytics** — on session end, the app generates a *Confusion Timeline* graph, logs all resolved and unresolved questions, and queries Llama 3.2 for an executive summary and *Top Roadblock* analysis. Everything exports as a clean PDF.

### Student flow

1. **Join** via 4-digit code — no account needed, fully anonymous.
2. **Vote** using three buttons: *Clear*, *Unsure*, or *Confused*. Tapping *Unsure* or *Confused* smoothly reveals a text box to describe exactly what they're stuck on.
3. **Feedback loop** — after submitting a doubt, the student's UI locks into *Clarification in Progress* for 90 seconds. When the teacher marks it as explained, a modal appears asking *"Did that clear things up?"* — the student re-votes and the live ratios update.

---

## Engineering Challenges

### The Bulletproof Heartbeat Timer
Mobile OSes (iOS and Android) aggressively suspend JavaScript `setTimeout` timers when an app is backgrounded to save battery. A backgrounded teacher's phone would cause the session timer to silently freeze, leaving 50 students stuck in an active room with no way out.

We fixed this by engineering a heartbeat timer that checks `Date.now()` against the session expiration timestamp every second, regardless of JS timer drift. The session terminates reliably even with the teacher's screen locked.

### Single Source of Truth Lifecycle
The naive approach — each of 50 student phones running its own local countdown — causes database race conditions at session end, with phones hitting Firestore at slightly different times and creating inconsistent state.

Instead, the **teacher's device acts as the sole timekeeper**. When the teacher's clock hits zero, it flips `isActive` to `false` in Firestore. All student devices catch this via `onSnapshot` and exit the room simultaneously, cleanly, with zero race conditions.

### Zero-DB Caching Guards (Cost Optimisation)
Students tapping the *Clear* button repeatedly would generate redundant Firestore reads and writes, inflating costs at scale. We implemented a strict client-side state comparison guard — `currentStatus === 'clear' && lastSubmittedStatus === 'clear'` — that intercepts redundant clicks before any API call is made, showing a friendly UI nudge instead. Zero unnecessary database hits.

### AI Response Caching
Querying Llama 3.2 for a post-class summary takes ~10 seconds. If a teacher views their session history later, re-running the query wastes time and API credits.

The FastAPI backend intercepts the summary request, checks whether `aiSummaryCache` already exists in Firestore, and returns it in ~0.1s if it does. First-time generation is cached immediately on completion.

### Multi-Resolution Modals
If a teacher rapidly resolved three questions back to back, the student UI would stack three overlapping modals simultaneously — unusable.

We refactored the Firebase listener to map all resolved questions into a single `resolvedQuestions` array, rendering one clean scrollable interface. Students can confirm multiple explanations at once without the UI breaking.

---

## Team

Built by a team of 4 as part of the BE (Artificial Intelligence) curriculum at Don Bosco Institute of Technology, Mumbai.
