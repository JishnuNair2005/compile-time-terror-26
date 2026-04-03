import time
from datetime import datetime, timezone, timedelta
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import firestore as google_firestore
from app.core.config import db, openai_client

# --- 1. MATHEMATICAL UTILITIES ---

def calculate_similarity(vec1, vec2):
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    if v1.shape != v2.shape: return 0.0 
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))


# --- 2. THE SMART SPAM PENALTY (devices) ---

def check_device_access(device_id):
    """
    Checks if the device is currently flagged or on cooldown.
    Returns (is_allowed, error_message)
    """
    if not device_id: return True, ""
    
    dev_ref = db.collection('devices').document(device_id)
    doc = dev_ref.get()
    
    if doc.exists:
        data = doc.to_dict()
        if data.get('isFlagged', False):
            return False, "Your device has been flagged for spamming."
            
        cooldown = data.get('cooldownUntil')
        # Check if cooldown exists and is in the future
        if cooldown and cooldown > datetime.now(timezone.utc):
            return False, "You are submitting too fast. Please wait a moment."
            
    return True, ""

def update_device_metrics(device_id, question_type, is_ai_spam=False):
    """
    Updates global device metrics. Triggers cooldowns if spamming.
    """
    if not device_id: return

    dev_ref = db.collection("devices").document(device_id)
    
    # Weighted Scoring: AI Rejections = +2 spam points, 'Lost' clicks = +1, 'Got It' = 0
    spam_increment = 2 if is_ai_spam else (1 if question_type == 1 else 0)

    try:
        snap = dev_ref.get()
        current_spam = 0
        
        if snap.exists:
            current_spam = snap.to_dict().get("spamScore", 0)

        # Baseline updates
        update_data = {
            "deviceId": device_id,
            "totalResponses": google_firestore.Increment(1),
            "spamScore": google_firestore.Increment(spam_increment),
            "lastUpdated": google_firestore.SERVER_TIMESTAMP
        }
        
        if question_type == 1:
            update_data["lostCount"] = google_firestore.Increment(1)

        # 🚨 PENALTY LOGIC: Flag them or put them on cooldown
        new_spam_score = current_spam + spam_increment
        if new_spam_score >= 10:
            update_data["isFlagged"] = True
            print(f"🚫 PERMA-BLOCK: Device {device_id} flagged.")
        elif new_spam_score >= 5:
            # 5 Minute cooldown
            update_data["cooldownUntil"] = datetime.now(timezone.utc) + timedelta(minutes=5)
            print(f"⏳ COOLDOWN: Device {device_id} blocked for 5 mins.")

        dev_ref.set(update_data, merge=True)
            
    except Exception as e:
        print(f"❌ Analytics Error in Firestore: {e}")


# --- 3. THE REAL-TIME PROGRESS BAR & TIMELINE (responses) ---

@google_firestore.transactional
def update_responses_txn(transaction, session_ref, question_type, previous_type=None):
    """
    Uses a Firestore transaction to safely increment counters, calculate emergency status, 
    and append the snapshot to the timeline array without race conditions.
    """
    snapshot = session_ref.get(transaction=transaction)
    
    # Default state if document doesn't exist
    data = snapshot.to_dict() if snapshot.exists else {'gotIt': 0, 'sortOf': 0, 'lost': 0, 'timeline': []}
    
    got_it = data.get('gotIt', 0)
    sort_of = data.get('sortOf', 0)
    lost = data.get('lost', 0)
    timeline = data.get('timeline', [])

    # Apply Increments
    if question_type == 2: got_it += 1
    elif question_type == 0: sort_of += 1
    elif question_type == 1: lost += 1

    # Apply Decrements (if user changed their mind)
    if previous_type == 2: got_it = max(0, got_it - 1)
    elif previous_type == 0: sort_of = max(0, sort_of - 1)
    elif previous_type == 1: lost = max(0, lost - 1)

    # 🔥 NEW: Emergency Detection Logic
    total = got_it + sort_of + lost
    lost_percent = (lost / total * 100) if total > 0 else 0
    is_emergency = lost_percent > 40 and total >= 10

    # Format the timeline entry (e.g., "10:14 AM")
    from datetime import datetime # Make sure this is imported at the top of your file
    time_str = datetime.now().strftime("%I:%M %p")
    
    # Optimization: Only append if the minute has changed
    if len(timeline) == 0 or timeline[-1].get('time') != time_str:
        timeline.append({
            "time": time_str,
            "gotIt": got_it,
            "sortOf": sort_of,
            "lost": lost
        })
    else:
        # Update the existing minute's snapshot
        timeline[-1] = {
            "time": time_str,
            "gotIt": got_it,
            "sortOf": sort_of,
            "lost": lost
        }

    # Save everything back to Firestore safely
    transaction.set(session_ref, {
        'gotIt': got_it,
        'sortOf': sort_of,
        'lost': lost,
        'emergencyAlert': is_emergency, # 🔥 This flag triggers the React Native UI
        'lastActiveAt': google_firestore.SERVER_TIMESTAMP,
        'timeline': timeline
    }, merge=True)


# --- 4. MAIN PROCESSING ENGINE ---

def process_question(payload):
    # Step 1: Pre-Flight Check (Spam Bouncer)
    is_allowed, error_msg = check_device_access(payload.deviceId)
    if not is_allowed:
        return {"success": False, "message": error_msg}

    # Step 2: Fetch Session Metadata (or rely on payload to save DB reads)
    subject = getattr(payload, 'subject', 'General Learning')
    topic = getattr(payload, 'topic', 'Ongoing Discussion')
    teacher_id = getattr(payload, 'teacherId', 'unknown')

    # Step 3: Signal Handling (Empty Text / Just clicking 'Got It')
    if not payload.text or payload.text.strip() == "":
        txn = db.transaction()
        update_responses_txn(txn, db.collection('responses').document(payload.sessionId), payload.questionType)
        update_device_metrics(payload.deviceId, payload.questionType, is_ai_spam=False)
        return {"success": True, "message": "Signal recorded."}

    # Step 4: AI Concept Tagging & Relevancy Filter
    prompt = f"""You are a strict teacher's assistant for {subject}.
    Topic: {topic}. 
    Analyze the question: "{payload.text}"
    
    1. Is it relevant to the topic? (YES/NO)
    2. What is the core sub-concept? (Max 2 words, e.g., 'Array Overflow')
    
    Response format: [DECISION] | [CONCEPT]"""

    ai_tag = "General Clarification"
    try:
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=25
        )
        ai_output = chat_response.choices[0].message.content.strip().upper()
        
        if "|" in ai_output:
            decision, extracted_tag = ai_output.split("|")
            decision = decision.strip()
            ai_tag = extracted_tag.strip().title()
        else:
            decision = ai_output

        # If AI rejects the question, penalize the device
        if "NO" in decision and "YES" not in decision:
            print(f"🚫 AI Bouncer Rejection: {payload.text}")
            update_device_metrics(payload.deviceId, payload.questionType, is_ai_spam=True)
            return {"success": False, "message": f"Stay focused on {topic}."}
            
    except Exception as e:
        print(f"⚠️ AI Bouncer bypass due to error: {e}")

    # Step 5: Update Metrics (Transaction + Device Log)
    txn = db.transaction()
    update_responses_txn(txn, db.collection('responses').document(payload.sessionId), payload.questionType)
    update_device_metrics(payload.deviceId, payload.questionType, is_ai_spam=False)

    # Step 6: Duplicate Clustering (The questions collection)
    questions_ref = db.collection('questions')
    active_questions = list(questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True).stream())
    
    merged = False
    SIMILARITY_THRESHOLD = 0.70 

    if payload.computeMode == 'tfidf':
        if len(active_questions) > 0:
            corpus = [payload.text.lower()]
            map_docs = []
            for doc in active_questions:
                d = doc.to_dict()
                if d.get('type') == payload.questionType:
                    corpus.append(d.get('normalized', d.get('text', '')).lower())
                    map_docs.append(doc)

            if len(corpus) > 1:
                vec = TfidfVectorizer().fit_transform(corpus)
                sim_matrix = cosine_similarity(vec[0:1], vec[1:])
                max_sim_idx = np.argmax(sim_matrix)
                
                if sim_matrix[0][max_sim_idx] >= SIMILARITY_THRESHOLD:
                    map_docs[max_sim_idx].reference.update({'count': google_firestore.Increment(1)})
                    merged = True
    else:
        # Nomic Embedding logic
        emb_res = openai_client.embeddings.create(input=payload.text, model="nomic-embed-text")
        new_emb = emb_res.data[0].embedding
        
        for doc in active_questions:
            d = doc.to_dict()
            if 'embedding' in d and d.get('type') == payload.questionType:
                sim = calculate_similarity(new_emb, d['embedding'])
                if sim >= SIMILARITY_THRESHOLD:
                    doc.reference.update({'count': google_firestore.Increment(1)})
                    merged = True
                    break

    # Step 7: Final Schema Writing
    if not merged:
        new_q = {
            'sessionId': payload.sessionId,
            'deviceId': payload.deviceId,
            'teacherId': teacher_id,
            'subject': subject,
            'topic': topic,
            'text': payload.text,
            'normalized': payload.text.strip().lower(),
            'type': payload.questionType,
            'count': 1,
            'isActive': True,
            'conceptTag': ai_tag,
            'timestamp': google_firestore.SERVER_TIMESTAMP # 🔥 Using true Firestore Timestamps
        }
        if payload.computeMode != 'tfidf':
            new_q['embedding'] = new_emb

        questions_ref.add(new_q)
        print(f"🆕 Added New Question [{ai_tag}]: {payload.text}")

    return {
        "success": True, 
        "message": "Feedback recorded."
    }