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


# ... (keep your calculate_similarity and increment_false_count functions exactly as they are) ...

def update_session_counters(session_id, question_type, previous_question_type=None):
    field_map = {
        2: 'gotIt',
        0: 'sortOf',
        1: 'lost'
    }
    
    updates = {
        'lastActiveAt': int(time.time() * 1000)
    }
    
    # 1. Add to the new choice
    field_to_increment = field_map.get(question_type)
    if field_to_increment:
        updates[field_to_increment] = google_firestore.Increment(1)

    # 2. Subtract from the old choice (if it exists)
    if previous_question_type is not None:
        field_to_decrement = field_map.get(previous_question_type)
        
        if field_to_decrement:
            if field_to_decrement == field_to_increment:
                # They voted the exact same thing again! Net change is 0. Cancel the increment.
                if field_to_increment in updates:
                    del updates[field_to_increment]
            else:
                # Subtract from the old column
                updates[field_to_decrement] = google_firestore.Increment(-1)
                
    if len(updates) > 1: # Only save if we actually have math to do
        session_ref = db.collection('responses').document(session_id)
        session_ref.set(updates, merge=True)


def process_question(payload):
    # 1. If there is no text (e.g., "Got It" pressed), update counters and stop.
    if not payload.text or payload.text.strip() == "":
        # Pass the previousQuestionType here!
        update_session_counters(payload.sessionId, payload.questionType, payload.previousQuestionType)
        return {
            "success": True, 
            "message": "Signal recorded. No question text to merge."
        }

    # 2. Text exists! Fetch the session.
    session_doc = db.collection('sessions').document(payload.sessionId).get()
    
    if not session_doc.exists:
        return {"success": False, "message": "Session not found."}
        
    subject = session_doc.to_dict().get('subject', '')
    if not subject or subject.strip() == "":
        subject = "General Learning"

    # 3. AI Bouncer
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
        
        if "NO" in ai_decision and "YES" not in ai_decision:
            print(f"[AI Bouncer] Blocked off-topic question: '{payload.text}'")
            try:
                increment_false_count(payload.deviceId, subject)
            except Exception as e:
                pass
            return {"success": False, "message": f"Question rejected: Keep it related to {subject}."}
            
    except Exception as e:
        print(f"AI Topic validation error: {e}")

    # 4. Validation Passed! Update the counters (Pass the previousQuestionType here too!)
    update_session_counters(payload.sessionId, payload.questionType, payload.previousQuestionType)
    # ... (Keep the rest of your process_question TF-IDF/Ollama logic EXACTLY the same) ...
    

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
            
        }
        if payload.computeMode != 'tfidf':
            new_question['embedding'] = new_embedding

        questions_ref.add(new_question)
       

    return {
        "success": True, 
        "message": f"Question {'merged' if merged else 'added'} successfully."
    }