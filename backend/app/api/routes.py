from fastapi import APIRouter, HTTPException
from google.cloud import firestore as google_firestore
from app.models.question import QuestionPayload
from app.services.question_service import process_question
from app.core.config import db,openai_client

router = APIRouter()

from pydantic import BaseModel
import json
from datetime import datetime

@router.get("/sessions/{session_id}/summary")
def get_session_summary(session_id: str):
    try:
        # 1. Fetch all questions asked during this session
        questions_ref = db.collection('questions').where('sessionId', '==', session_id).stream()
        
        questions_data = []
        for doc in questions_ref:
            q = doc.to_dict()
            
            # Extract text and properly format the timestamp (converting from milliseconds)
            if q.get('text') and q['text'].strip() != "":
                time_str = "Unknown time"
                if 'timestamp' in q and q['timestamp']:
                    # Convert the millisecond timestamp saved by your question_service to a readable time
                    dt = datetime.fromtimestamp(q['timestamp'] / 1000.0)
                    time_str = dt.strftime('%I:%M %p') # e.g., "10:15 AM"
                
                questions_data.append(f"[{time_str}] Student asked: {q['text']}")

        # 2. Fallback if no questions were asked (Exactly as you requested!)
        if not questions_data:
            return {
                "success": True, 
                "data": {
                    "overallIdea": "The session was overall inactive. You need to make lectures more interactive to gauge student understanding.",
                    "topDoubt": "N/A - No questions asked",
                    "topics": [
                        {
                            "topic": "No inputs received", 
                            "doubtsLevel": "Low", 
                            "timestamps": "N/A", 
                            "summary": "No questions or confusion signals were submitted by the class."
                        }
                    ]
                }
            }

        # 3. Prepare the prompt for Llama
        raw_text = "\n".join(questions_data)
        prompt = f"""
        You are an expert teaching assistant. Here are the questions and confusion signals submitted by students during a live class, along with timestamps:
        
        {raw_text}
        
        Task:
        1. Write a 1-sentence 'overallIdea' summarizing how well the class understood the material based on the questions.
        2. Identify the 'topDoubt' - the single specific concept that had the most doubts/questions.
        3. Cluster the questions into 2 to 4 main topics of confusion.
        4. For each topic, identify the 'doubtsLevel' ("High", "Medium", or "Low") and note the specific timestamps when confusion spiked.
        
        Respond STRICTLY in valid JSON format. Do not include markdown tags like ```json. Use this EXACT structure:
        {{
          "overallIdea": "Brief overall summary of the class's performance...",
          "topDoubt": "Name of the most confusing concept",
          "topics": [
            {{
              "topic": "Concept Name",
              "doubtsLevel": "High/Medium/Low",
              "timestamps": "10:15 AM - 10:18 AM",
              "summary": "Brief 1-sentence explanation of what confused them."
            }}
          ]
        }}
        """

        # 4. Call local Llama
        chat_response = openai_client.chat.completions.create(
            model="llama3.2",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1, # Dropped slightly lower for strict JSON adherence
        )
        
        ai_response = chat_response.choices[0].message.content.strip()
        
        # 5. Clean and parse the JSON safely
        if ai_response.startswith("```json"):
            ai_response = ai_response[7:-3].strip()
        elif ai_response.startswith("```"):
            ai_response = ai_response[3:-3].strip()
            
        parsed_data = json.loads(ai_response)
        
        return {"success": True, "data": parsed_data}

    except Exception as e:
        print(f"Summary Generation Error: {e}")
        return {"success": False, "message": "Failed to generate summary", "data": None}
# Create a tiny model for the decrement payload
class DecrementPayload(BaseModel):
    questionType: int

# --- NEW ROUTE: Subtract from counter when timer ends ---
@router.post("/sessions/{session_id}/decrement")
def decrement_status(session_id: str, payload: DecrementPayload):
    try:
        field_map = { 2: 'gotIt', 0: 'sortOf', 1: 'lost' }
        field_to_decrement = field_map.get(payload.questionType)

        if not field_to_decrement:
            return {"valid": False, "message": "Invalid question type"}

        session_ref = db.collection('responses').document(session_id)
        
        # Safely subtract 1 from whichever button they originally pressed
        session_ref.update({
            field_to_decrement: google_firestore.Increment(-1)
        })
        
        return {"valid": True, "message": "Counter decremented"}
        
    except Exception as e:
        print(f"Error decrementing session: {e}")
        # We don't want to crash the frontend if this fails, just fail silently
        return {"valid": False, "message": "Failed to decrement"}

# --- ROUTE: Join Session & Increment Counter ---
@router.post("/sessions/{session_id}/join")
def join_session(session_id: str, payload: dict):
    # 🔥 CRITICAL FIX: Frontend se deviceId uthayega
    device_id = payload.get("deviceId")
    if not device_id:
        raise HTTPException(status_code=400, detail="Device ID missing in payload")

    try:
        session_ref = db.collection('sessions').document(session_id)
        
        # Unique ID for this specific student in this specific session
        participant_id = f"{session_id}_{device_id}" 
        p_ref = db.collection('session_participants').document(participant_id)
        
        participant_doc = p_ref.get()
        
        if participant_doc.exists:
            # ✅ RE-JOINING: DO NOT INCREMENT
            session_data = session_ref.get().to_dict()
            return {
                "valid": True, 
                "message": "Welcome back!", 
                "alreadyJoined": True,
                "subject": session_data.get("subject", "General")
            }

        session_doc = session_ref.get()
        if session_doc.exists:
            # ✅ NEW ENTRY: INCREMENT COUNTER
            session_ref.update({'totalJoined': google_firestore.Increment(1)})
            
            p_ref.set({
                'deviceId': device_id,
                'sessionId': session_id,
                'joinedAt': google_firestore.SERVER_TIMESTAMP
            })
            
            return {
                "valid": True, 
                "message": "First time join",
                "alreadyJoined": False,
                "subject": session_doc.to_dict().get("subject", "General")
            }
            
        return {"valid": False, "message": "Session not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ROUTE: Submit Question (Llama Bouncer & Tagging) ---
@router.post("/questions")
def submit_question(payload: QuestionPayload):
    """
    Processes questions with AI filtering and device tracking.
    """
    try:
        # Hand off the logic to service layer for spam score & concept tagging
        result = process_question(payload)
        return result
    except Exception as e:
        print(f"❌ Question Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")



# --- ROUTE: Get Student Count (Polling Support) ---
@router.get("/sessions/{session_id}/count")
def get_session_count(session_id: str):
    """
    Returns the real-time attendee count for the admin dashboard.
    """
    try:
        session_ref = db.collection('sessions').document(session_id)
        doc = session_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return {"count": data.get("totalJoined", 0)}
        return {"count": 0, "message": "Session not found"}
    except Exception as e:
        print(f"❌ Count Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch count")