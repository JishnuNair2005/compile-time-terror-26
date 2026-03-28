import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from google.cloud import firestore as google_firestore
from app.core.config import db, openai_client

def calculate_similarity(vec1, vec2):
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

def update_session_counters(session_id, question_type):
    # Map the integers to the exact field names in your database
    field_map = {
        2: 'gotItCount',
        0: 'sortOfCount',
        1: 'lostCount'
    }
    
    field_to_increment = field_map.get(question_type)
    if not field_to_increment:
        return
        
    session_ref = db.collection('responses').document(session_id)
    
    # set(merge=True) is magic: It creates the document if it's the 
    # first student to vote, or updates the existing one if it already exists!
    session_ref.set({
        field_to_increment: google_firestore.Increment(1),
        'lastActiveAt': int(time.time() * 1000)
    }, merge=True)


def process_question(payload):
    # 1. ALWAYS update the overall session counters first
    update_session_counters(payload.sessionId, payload.questionType)

    # 2. If there is no text (e.g., "Got It" pressed), stop here.
    if not payload.text or payload.text.strip() == "":
        return {
            "success": True, 
            "message": "Signal recorded. No question text to merge."
        }

    # 3. Text exists! Fetch existing questions to check for duplicates
    questions_ref = db.collection('questions')
    query = questions_ref.where('sessionId', '==', payload.sessionId).where('isActive', '==', True)
    
    # Convert stream to a list so we can loop through it easily
    existing_questions = list(query.stream()) 

    merged = False
    SIMILARITY_THRESHOLD = 0.70 # Good threshold for both OpenAI and TF-IDF

    # --- OFFLINE MODE: TF-IDF ---
    if payload.computeMode == 'tfidf':
        if len(existing_questions) > 0:
            # Gather all existing question texts of the same type
            corpus = [payload.text.lower()] # Our new text is at index 0
            doc_ids = []
            
            for doc in existing_questions:
                data = doc.to_dict()
                if data.get('type') == payload.questionType:
                    corpus.append(data.get('normalized', data.get('text', '')).lower())
                    doc_ids.append(doc)

            # If there is at least one other question to compare to
            if len(corpus) > 1:
                # Calculate TF-IDF matrix
                vectorizer = TfidfVectorizer().fit_transform(corpus)
                vectors = vectorizer.toarray()
                new_vec = vectors[0] # The new question's vector
                
                # Compare new question against all others
                for i in range(1, len(vectors)):
                    sim = cosine_similarity([new_vec], [vectors[i]])[0][0]
                    if sim >= SIMILARITY_THRESHOLD:
                        doc_ids[i-1].reference.update({
                            'count': google_firestore.Increment(1)
                        })
                        merged = True
                        print(f"[TF-IDF] Merged with existing question ID: {doc_ids[i-1].id} (Score: {sim:.2f})")
                        break


    # --- ONLINE MODE: OPENAI ---
    else:
        # Get embedding from OpenAI
        response = openai_client.embeddings.create(
            input=payload.text,
            model="text-embedding-3-small"
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
                    print(f"[OpenAI] Merged with existing question ID: {doc.id} (Score: {sim:.2f})")
                    break


    # 4. If no match was found (or if it was the first question), create it
    if not merged:
        new_question_data = {
            'count': 1, # Start at 1 person asking
            'isActive': True,
            'normalized': payload.text.strip().lower(),
            'sessionId': payload.sessionId,
            'text': payload.text,
            'type': payload.questionType,
            'timestamp': int(time.time() * 1000),
            'userId': payload.userId
        }
        
        # Only save the giant embedding array if we used OpenAI
        if payload.computeMode == 'openai':
            new_question_data['embedding'] = new_embedding

        questions_ref.add(new_question_data)
        print(f"Added new distinct question using {payload.computeMode.upper()}: {payload.text}")

    return {
        "success": True, 
        "message": f"Question {'merged' if merged else 'added'} via {payload.computeMode.upper()}"
    }