import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import firestore as google_firestore
from app.core.config import db, openai_client

# --- 1. MATHEMATICAL UTILITIES ---

def calculate_similarity(vec1, vec2):
    """
    Calculates cosine similarity between two embedding vectors manually.
    Essential for Nomic-Embed-Text comparisons via Ollama.
    """
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    if v1.shape != v2.shape:
        print(f"⚠️ Dimension mismatch in embeddings: {v1.shape} vs {v2.shape}")
        return 0.0 
        
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    
    return dot_product / (norm_v1 * norm_v2)

# --- 2. ANALYTICS & SPAM BOUNCER LOGIC ---

def update_device_metrics(device_id, subject, question_type, is_ai_spam=False):
    """
    🔥 ADVANCED TRACKING: Monitors spamScore and lostCount per device.
    If spamScore >= 5, it triggers the 'isFlagged' status to freeze student UI.
    """
    if not device_id or not subject:
        return

    # Document ID follows the format: deviceId_SubjectName
    doc_id = f"{device_id}_{subject.replace(' ', '_')}"
    ref = db.collection("deviceSubjectStats").document(doc_id)
    
    # Weighted Scoring: AI Rejections are penalized more heavily (+2) than simple Lost clicks.
    spam_increment = 2 if is_ai_spam else (1 if question_type == 1 else 0)

    update_data = {
        "deviceId": device_id,
        "subject": subject,
        "spamScore": google_firestore.Increment(spam_increment),
        "totalResponses": google_firestore.Increment(1),
        "lastUpdated": google_firestore.SERVER_TIMESTAMP
    }

    # Tracking specific 'Lost' interactions as requested in the schema
    if question_type == 1:
        update_data["lostCount"] = google_firestore.Increment(1)

    try:
        # Check current threshold before applying update
        snap = ref.get()
        if snap.exists:
            current_stats = snap.to_dict()
            current_spam = current_stats.get("spamScore", 0)
            
            # Auto-Flagging Logic: Freeze user if they hit the threshold
            if current_spam + spam_increment >= 5:
                update_data["isFlagged"] = True
                print(f"🚫 SPAM ALERT: Device {device_id} has been flagged and frozen.")

        ref.set(update_data, merge=True)
        
        # Legacy support for deviceStat (falseCount tracking)
        if is_ai_spam:
            db.collection("deviceStat").document(doc_id).set({
                "deviceId": device_id,
                "subject": subject,
                "falseCount": google_firestore.Increment(1),
                "lastUpdated": int(time.time() * 1000)
            }, merge=True)
            
    except Exception as e:
        print(f"❌ Analytics Error in Firestore: {e}")

def update_session_counters(session_id, question_type, previous_type=None):
    """
    Updates the real-time 'responses' collection for the teacher's progress bars.
    Handles both increments and decrements (if a user changes their mind).
    """
    field_map = {
        2: 'gotIt',
        0: 'sortOf',
        1: 'lost'
    }
    
    updates = { 'lastActiveAt': int(time.time() * 1000) }
    
    # Increment new choice
    new_field = field_map.get(question_type)
    if new_field:
        updates[new_field] = google_firestore.Increment(1)

    # Decrement previous choice to maintain accurate unique-user count
    if previous_type is not None:
        old_field = field_map.get(previous_type)
        if old_field and old_field != new_field:
            updates[old_field] = google_firestore.Increment(-1)
        elif old_field == new_field:
            # User voted the same thing; cancel the increment
            if new_field in updates: del updates[new_field]
                
    if len(updates) > 1:
        db.collection('responses').document(session_id).set(updates, merge=True)

# --- 3. MAIN PROCESSING ENGINE ---

def process_question(payload):
    """
    The Core Engine: Context Fetching -> AI Filtering -> Merging -> Storage.
    """
    # Step 1: Fetch Session Metadata
    session_ref = db.collection('sessions').document(payload.sessionId)
    session_doc = session_ref.get()
    
    if not session_doc.exists:
        return {"success": False, "message": "Session not found."}
        
    session_data = session_doc.to_dict()
    subject = session_data.get('subject', 'General Learning')
    topic = session_data.get('topic', 'Ongoing Discussion')

    # Step 2: Signal Handling (Empty Text)
    if not payload.text or payload.text.strip() == "":
        update_session_counters(payload.sessionId, payload.questionType)
        update_device_metrics(payload.deviceId, subject, payload.questionType, is_ai_spam=False)
        return {"success": True, "message": "Signal recorded."}

    # Step 3: AI Bouncer & Concept Tagging (Llama 3.2 via Ollama)
    prompt = f"""You are a strict teacher's assistant for {subject}.
    Topic: {topic}. 
    Analyze the question: "{payload.text}"
    
    1. Is it relevant to the topic? (YES/NO)
    2. What is the core sub-concept? (Max 2 words, e.g., 'Array Overflow')
    
    Response format: [DECISION] | [CONCEPT]"""

    ai_tag = "General"
    try:
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=25
        )
        ai_output = chat_response.choices[0].message.content.strip().upper()
        
        if "|" in ai_output:
            decision, ai_tag = ai_output.split("|")
            decision = decision.strip()
            ai_tag = ai_tag.strip().title()
        else:
            decision = ai_output

        # If AI rejects the question, flag it as spam
        if "NO" in decision and "YES" not in decision:
            print(f"🚫 AI Bouncer Rejection: {payload.text}")
            update_device_metrics(payload.deviceId, subject, payload.questionType, is_ai_spam=True)
            return {"success": False, "message": f"Stay focused on {topic}."}
            
    except Exception as e:
        print(f"⚠️ AI Bouncer bypass due to error: {e}")

    # Step 4: Final Verification Passed - Update Metrics
    update_session_counters(payload.sessionId, payload.questionType)
    update_device_metrics(payload.deviceId, subject, payload.questionType, is_ai_spam=False)

    # Step 5: Duplicate Merging Logic (TF-IDF or Embeddings)
    questions_ref = db.collection('questions')
    active_questions = list(questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True).stream())
    
    merged = False
    SIMILARITY_THRESHOLD = 0.70 

    if payload.computeMode == 'tfidf':
        # --- TF-IDF MERGING ---
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
        # --- OLLAMA EMBEDDING MERGING ---
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

    # Step 6: Create New Entry if not merged
    if not merged:
        new_q = {
            'count': 1,
            'isActive': True,
            'text': payload.text,
            'normalized': payload.text.strip().lower(),
            'sessionId': payload.sessionId,
            'type': payload.questionType,
            'timestamp': int(time.time() * 1000),
            'deviceId': payload.deviceId,
            'subject': subject,
            'topic': topic,
            'conceptTag': ai_tag # Categorization for Admin Dashboard
        }
        if payload.computeMode != 'tfidf':
            new_q['embedding'] = new_emb

        questions_ref.add(new_q)
        print(f"🆕 Added New Question in {ai_tag}: {payload.text}")

    return {
        "success": True, 
        "message": f"Question {'merged' if merged else 'added'} successfully."
    }