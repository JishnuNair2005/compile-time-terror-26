import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import firestore as google_firestore
from app.core.config import db, openai_client

def calculate_similarity(vec1, vec2):
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    if v1.shape != v2.shape:
        print(f"Dimension mismatch ignored: {v1.shape} vs {v2.shape}")
        return 0.0 
        
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))


# 🔥 Restored this function back where it belongs!
def update_session_counters(session_id, question_type):
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
    print(f"🔥 increment called: {device_id}, {subject}")

    if not device_id or device_id.strip() == "":
        print("❌ deviceId EMPTY")
        return

    if not subject or subject.strip() == "":
        print("❌ subject EMPTY")
        return

    doc_id = f"{device_id}_{subject}"
    ref = db.collection("deviceSubjectStats").document(doc_id)

    try:
        ref.set({
            "deviceId": device_id,
            "subject": subject,
            "falseCount": google_firestore.Increment(1),
            "lastUpdated": int(time.time() * 1000)
        }, merge=True)
        print("✅ Firestore write SUCCESS")

    except Exception as e:
        print(f"❌ Firestore error: {e}")


def process_question(payload):
    # 1. If there is no text (e.g., "Got It" pressed), update counters and stop.
    if not payload.text or payload.text.strip() == "":
        update_session_counters(payload.sessionId, payload.questionType)
        return {
            "success": True, 
            "message": "Signal recorded. No question text to merge."
        }

    # 2. Text exists! Fetch the session.
    session_doc = db.collection('sessions').document(payload.sessionId).get()
    
    if not session_doc.exists:
        return {"success": False, "message": "Session not found."}
        
    # Safely get the subject
    subject = session_doc.to_dict().get('subject', '')
    if not subject or subject.strip() == "":
        subject = "General Learning"

    # 3. AI Bouncer: Ask local Llama 3.2 if the question is relevant
    prompt = f"""You are a strict teacher's assistant filtering spam. 
    The current class subject is: "{subject}".
    A student asked: "{payload.text}".
    Is this question related to the subject or general classroom learning? 
    Answer ONLY with the word YES or NO. Do not explain."""

    try:
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=5
        )
        ai_decision = chat_response.choices[0].message.content.strip().upper()
        
        # If the AI says NO, reject the payload entirely!
        if "NO" in ai_decision and "YES" not in ai_decision:
            print(f"[AI Bouncer] Blocked off-topic question: '{payload.text}' (Subject: {subject})")

            try:
                increment_false_count(payload.deviceId, subject)
            except Exception as e:
                print(f"Error updating false count: {e}")

            return {
                "success": False, 
                "message": f"Question rejected: Please keep questions related to {subject}."
            }
            
    except Exception as e:
        print(f"AI Topic validation error: {e}")

    # 4. Validation Passed! Update the counters.
    update_session_counters(payload.sessionId, payload.questionType)

    # 5. Fetch existing questions to check for duplicates
    questions_ref = db.collection('questions')
    query = questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True)
    existing_questions = list(query.stream()) 

    merged = False
    SIMILARITY_THRESHOLD = 0.70 

    # --- OFFLINE MODE: TF-IDF ---
    if payload.computeMode == 'tfidf':
        if len(existing_questions) > 0:
            corpus = [payload.text.lower()] 
            doc_ids = []
            
            for doc in existing_questions:
                data = doc.to_dict()
                if data.get('type') == payload.questionType:
                    corpus.append(data.get('normalized', data.get('text', '')).lower())
                    doc_ids.append(doc)

            if len(corpus) > 1:
                vectorizer = TfidfVectorizer().fit_transform(corpus)
                vectors = vectorizer.toarray()
                new_vec = vectors[0] 
                
                for i in range(1, len(vectors)):
                    sim = cosine_similarity([new_vec], [vectors[i]])[0][0]
                    if sim >= SIMILARITY_THRESHOLD:
                        doc_ids[i-1].reference.update({
                            'count': google_firestore.Increment(1)
                        })
                        merged = True
                        print(f"[TF-IDF] Merged with existing question ID: {doc_ids[i-1].id} (Score: {sim:.2f})")
                        break

    # --- LOCAL AI MODE: OLLAMA EMBEDDINGS ---
    else:
        response = openai_client.embeddings.create(
            input=payload.text,
            model="nomic-embed-text" 
        )
        new_embedding = response.data[0].embedding

        for doc in existing_questions:
            existing_data = doc.to_dict()
            if 'embedding' in existing_data:
                sim = calculate_similarity(new_embedding, existing_data['embedding'])
                
                if sim >= SIMILARITY_THRESHOLD and existing_data.get('type') == payload.questionType:
                    doc.reference.update({
                        'count': google_firestore.Increment(1)
                    })
                    merged = True
                    print(f"[Ollama] Merged with existing question ID: {doc.id} (Score: {sim:.2f})")
                    break

    # 6. If no match was found, create it
    if not merged:
        new_question_data = {
            'count': 1, 
            'isActive': True,
            'normalized': payload.text.strip().lower(),
            'sessionId': payload.sessionId,
            'text': payload.text,
            'type': payload.questionType,
            'timestamp': int(time.time() * 1000),
            'deviceId': payload.deviceId  
        }
        
        if payload.computeMode != 'tfidf':
            new_question_data['embedding'] = new_embedding

        questions_ref.add(new_question_data)
        
        display_mode = "OLLAMA" if payload.computeMode == 'openai' else payload.computeMode.upper()
        print(f"Added new distinct question using {display_mode}: {payload.text}")

    return {
        "success": True, 
        "message": f"Question {'merged' if merged else 'added'} successfully."
    }