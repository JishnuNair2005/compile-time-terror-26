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


def increment_false_count(device_id, subject):
    """
    Tracks students sending off-topic questions/spam.
    """
    if not device_id or not subject:
        return

    doc_id = f"{device_id}_{subject.replace(' ', '_')}"
    ref = db.collection("deviceSubjectStats").document(doc_id)

    try:
        ref.set({
            "deviceId": device_id,
            "subject": subject,
            "falseCount": google_firestore.Increment(1),
            "lastUpdated": int(time.time() * 1000)
        }, merge=True)
        print(f"🔥 Flagged device {device_id} for off-topic content.")
    except Exception as e:
        print(f"❌ Firestore Error (False Count): {e}")


def process_question(payload):
    """
    Main Logic: Filtering -> Counter Update -> Duplicate Merging -> Storage.
    """
    
    # 1. EMPTY TEXT HANDLING (Signals Only)
    if not payload.text or payload.text.strip() == "":
        update_session_counters(payload.sessionId, payload.questionType)
        return {
            "success": True, 
            "message": "Signal recorded. No text to process."
        }

    # 2. FETCH SESSION CONTEXT
    session_doc = db.collection('sessions').document(payload.sessionId).get()
    if not session_doc.exists:
        return {"success": False, "message": "Session not found."}
        
    session_data = session_doc.to_dict()
    subject = session_data.get('subject', 'General Learning')
    topic = session_data.get('topic', 'Ongoing Discussion') # Support for your new topic field

    # 3. AI BOUNCER (Llama 3.2 Filtering)
    # We provide Topic and Subject to the AI for high-accuracy filtering.
    prompt = f"""You are a strict teacher's assistant filtering spam. 
    Class Subject: "{subject}"
    Current Topic: "{topic}"
    Student Question: "{payload.text}"
    Is this question related to the topic, the subject, or classroom learning? 
    Answer ONLY YES or NO. Do not explain."""

    try:
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=5
        )
        ai_decision = chat_response.choices[0].message.content.strip().upper()
        
        if "NO" in ai_decision and "YES" not in ai_decision:
            print(f"🚫 AI Blocked: '{payload.text}' in Topic: {topic}")
            increment_false_count(payload.deviceId, subject)
            return {
                "success": False, 
                "message": f"Question rejected. Please stay on topic: {topic}."
            }
    except Exception as e:
        print(f"⚠️ AI Bouncer bypass due to error: {e}")

    # 4. UPDATE GLOBAL COUNTERS
    update_session_counters(payload.sessionId, payload.questionType)

    # 5. FETCH ACTIVE QUESTIONS FOR MERGING
    questions_ref = db.collection('questions')
    query_ref = questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True)
    existing_docs = list(query_ref.stream()) 

    merged = False
    SIMILARITY_THRESHOLD = 0.70 

    # 6. MERGING LOGIC: TF-IDF vs OLLAMA
    
    if payload.computeMode == 'tfidf':
        # --- TF-IDF PATH ---
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
                        relevant_docs[i-1].reference.update({
                            'count': google_firestore.Increment(1)
                        })
                        merged = True
                        print(f"✅ TF-IDF Merged (Score: {sim:.2f})")
                        break

    else:
        # --- LOCAL AI OLLAMA PATH ---
        response = openai_client.embeddings.create(
            input=payload.text,
            model="nomic-embed-text" 
        )
        new_embedding = response.data[0].embedding

        for doc in existing_docs:
            d = doc.to_dict()
            if 'embedding' in d and d.get('type') == payload.questionType:
                sim = calculate_similarity(new_embedding, d['embedding'])
                
                if sim >= SIMILARITY_THRESHOLD:
                    doc.reference.update({
                        'count': google_firestore.Increment(1)
                    })
                    merged = True
                    print(f"✅ Ollama Merged (Score: {sim:.2f})")
                    break

    # 7. FINAL ACTION: CREATE NEW ENTRY IF NOT MERGED
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
            'topic': topic
        }
        
        if payload.computeMode != 'tfidf':
            new_question['embedding'] = new_embedding

        questions_ref.add(new_question)
        print(f"🆕 Added New Question: {payload.text}")

        return {
            "success": True, 
            "message": f"Question {'merged' if merged else 'added'} successfully."
        }