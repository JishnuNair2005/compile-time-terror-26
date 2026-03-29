import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import firestore as google_firestore
from app.core.config import db, openai_client

def calculate_similarity(vec1, vec2):
    """
    Calculates cosine similarity between two embedding vectors.
    Used for local AI (Ollama) merging.
    """
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    if v1.shape != v2.shape:
        print(f"⚠️ Dimension mismatch: {v1.shape} vs {v2.shape}")
        return 0.0 
        
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))


def update_session_counters(session_id, question_type):
    """
    Increments the global counters (Got It, Sort Of, Lost) in the 'responses' collection.
    """
    field_map = {
        2: 'gotIt',
        0: 'sortOf',
        1: 'lost'
    }
    
    field_to_increment = field_map.get(question_type)
    if not field_to_increment:
        return
        
    session_ref = db.collection('responses').document(session_id)
    session_ref.set({
        field_to_increment: google_firestore.Increment(1),
        'lastActiveAt': int(time.time() * 1000)
    }, merge=True)


def update_device_metrics(device_id, subject, question_type, is_spam=False):
    """
    🔥 NEW: Track genuine vs spam activity per device and subject.
    Updates 'deviceSubjectStats' with auto-flagging.
    """
    if not device_id or not subject:
        return

    doc_id = f"{device_id}_{subject.replace(' ', '_')}"
    ref = db.collection("deviceSubjectStats").document(doc_id)

    update_data = {
        "deviceId": device_id,
        "subject": subject,
        "totalResponses": google_firestore.Increment(1),
        "lastUpdated": google_firestore.SERVER_TIMESTAMP
    }

    # Tracking 'Lost' counts specifically as per your schema
    if question_type == 1:
        update_data["lostCount"] = google_firestore.Increment(1)

    if is_spam:
        update_data["spamScore"] = google_firestore.Increment(1)
        # Auto-flagging logic if spam score crosses threshold
        update_data["isFlagged"] = True
    
    try:
        ref.set(update_data, merge=True)
        # Legacy support for deviceStat collection if needed
        db.collection("deviceStat").document(doc_id).set({
            "deviceId": device_id,
            "subject": subject,
            "falseCount": google_firestore.Increment(1 if is_spam else 0),
            "lastUpdated": int(time.time() * 1000)
        }, merge=True)
    except Exception as e:
        print(f"❌ Analytics Error: {e}")


def process_question(payload):
    """
    Main Logic: Filtering -> Counter Update -> Duplicate Merging -> Storage.
    """
    
    # 1. FETCH SESSION CONTEXT EARLY
    session_doc = db.collection('sessions').document(payload.sessionId).get()
    if not session_doc.exists:
        return {"success": False, "message": "Session not found."}
        
    session_data = session_doc.to_dict()
    subject = session_data.get('subject', 'General Learning')
    topic = session_data.get('topic', 'Ongoing Discussion')

    # 2. EMPTY TEXT HANDLING (Signals Only)
    if not payload.text or payload.text.strip() == "":
        update_session_counters(payload.sessionId, payload.questionType)
        # Track genuine signal
        update_device_metrics(payload.deviceId, subject, payload.questionType, is_spam=False)
        return {
            "success": True, 
            "message": "Signal recorded. No text to process."
        }

    # 3. AI BOUNCER & CONCEPT TAGGING (Llama 3.2)
    # Combined prompt to get both filter decision and concept tag
    prompt = f"""You are a strict teacher's assistant. 
    Subject: "{subject}", Topic: "{topic}"
    Student Question: "{payload.text}"
    
    Tasks:
    1. Is this relevant to learning? Answer YES or NO.
    2. Identify the sub-concept/topic (e.g., 'Array Bounds', 'Complexity').
    
    Format: [DECISION] | [CONCEPT]"""

    ai_tag = "General"
    try:
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=20
        )
        ai_output = chat_response.choices[0].message.content.strip().upper()
        
        if "|" in ai_output:
            decision, ai_tag = ai_output.split("|")
            decision = decision.strip()
            ai_tag = ai_tag.strip().title()
        else:
            decision = ai_output

        if "NO" in decision and "YES" not in decision:
            print(f"🚫 AI Blocked: '{payload.text}'")
            # Track spam activity
            update_device_metrics(payload.deviceId, subject, payload.questionType, is_spam=True)
            return {
                "success": False, 
                "message": f"Question rejected. Please stay on topic: {topic}."
            }
    except Exception as e:
        print(f"⚠️ AI Bouncer bypass: {e}")

    # 4. UPDATE GLOBAL COUNTERS & DEVICE ANALYTICS
    update_session_counters(payload.sessionId, payload.questionType)
    update_device_metrics(payload.deviceId, subject, payload.questionType, is_spam=False)

    # 5. FETCH ACTIVE QUESTIONS FOR MERGING
    questions_ref = db.collection('questions')
    query_ref = questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True)
    existing_docs = list(query_ref.stream()) 

    merged = False
    SIMILARITY_THRESHOLD = 0.70 

    # 6. MERGING LOGIC: TF-IDF vs OLLAMA
    if payload.computeMode == 'tfidf':
        if len(existing_docs) > 0:
            corpus = [payload.text.lower()] 
            relevant_docs = []
            for doc in existing_docs:
                d = doc.to_dict()
                if d.get('type') == payload.questionType:
                    corpus.append(d.get('normalized', d.get('text', '')).lower())
                    relevant_docs.append(doc)

            if len(corpus) > 1:
                vectorizer = TfidfVectorizer().fit_transform(corpus)
                vectors = vectorizer.toarray()
                for i in range(1, len(vectors)):
                    sim = cosine_similarity([vectors[0]], [vectors[i]])[0][0]
                    if sim >= SIMILARITY_THRESHOLD:
                        relevant_docs[i-1].reference.update({'count': google_firestore.Increment(1)})
                        merged = True
                        break
    else:
        response = openai_client.embeddings.create(input=payload.text, model="nomic-embed-text")
        new_embedding = response.data[0].embedding
        for doc in existing_docs:
            d = doc.to_dict()
            if 'embedding' in d and d.get('type') == payload.questionType:
                sim = calculate_similarity(new_embedding, d['embedding'])
                if sim >= SIMILARITY_THRESHOLD:
                    doc.reference.update({'count': google_firestore.Increment(1)})
                    merged = True
                    break

    # 7. FINAL ACTION: CREATE NEW ENTRY WITH CONCEPT TAG
    if not merged:
        new_question = {
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
            'conceptTag': ai_tag # 🔥 For Concept-based sorting in Admin UI
        }
        if payload.computeMode != 'tfidf':
            new_question['embedding'] = new_embedding

        questions_ref.add(new_question)
        print(f"🆕 Added New Question in [{ai_tag}]: {payload.text}")

    return {
        "success": True, 
        "message": f"Question {'merged' if merged else 'added'} successfully."
    }