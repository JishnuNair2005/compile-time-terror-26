from fastapi import APIRouter, HTTPException
from google.cloud import firestore as google_firestore
from app.models.question import QuestionPayload
from app.services.question_service import process_question
from app.core.config import db

router = APIRouter()

from pydantic import BaseModel

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