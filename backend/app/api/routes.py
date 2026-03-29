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
def join_session(session_id: str):
    try:
        # Look for the exact document ID in the 'sessions' collection
        session_ref = db.collection('sessions').document(session_id)
        doc = session_ref.get()
        
        if doc.exists:
            # Increment the total joined count by 1 safely
            session_ref.update({
                'totalJoined': google_firestore.Increment(1)
            })
            return {"valid": True, "message": "Successfully joined session"}
        else:
            return {"valid": False, "message": "Session not found"}
            
    except Exception as e:
        print(f"Error joining session: {e}")
        raise HTTPException(status_code=500, detail="Failed to join session")


# --- ROUTE: Submit Question ---
@router.post("/questions")
def submit_question(payload: QuestionPayload):
    try:
        # Hand off the logic to the service layer
        result = process_question(payload)
        return result
    except Exception as e:
        print(f"Error processing question: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")

        # --- ROUTE: Get Student Count ---
# @router.get("/sessions/{session_id}/count")
# def get_session_count(session_id: str):
#     try:
#         session_ref = db.collection('sessions').document(session_id)
#         doc = session_ref.get()
        
#         if doc.exists:
#             data = doc.to_dict()
#             # Return the totalJoined count, default to 0 if it doesn't exist yet
#             return {"count": data.get("totalJoined", 0)}
#         else:
#             return {"count": 0, "message": "Session not found"}
            
#     except Exception as e:
#         print(f"Error fetching session count: {e}")
#         raise HTTPException(status_code=500, detail="Failed to fetch count")
@router.get("/sessions/{session_id}/count")
def get_session_count(session_id: str):
    try:
        session_ref = db.collection('sessions').document(session_id)
        doc = session_ref.get()
        if doc.exists:
            data = doc.to_dict()
            # totalJoined field se data uthayega
            return {"count": data.get("totalJoined", 0)}
        return {"count": 0, "message": "Session not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch count")