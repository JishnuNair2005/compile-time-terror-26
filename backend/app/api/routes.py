from fastapi import APIRouter, HTTPException
from app.models.question import QuestionPayload
from app.services.question_service import process_question
from app.core.config import db

router = APIRouter()

@router.get("/sessions/{session_id}")
def verify_session(session_id: str):
    try:
        # Look for the exact document ID in the 'sessions' collection
        session_ref = db.collection('sessions').document(session_id)
        doc = session_ref.get()
        
        if doc.exists:
            return {"valid": True, "message": "Session found"}
        else:
            return {"valid": False, "message": "Session not found"}
            
    except Exception as e:
        print(f"Error verifying session: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify session")

@router.post("/questions")
def submit_question(payload: QuestionPayload):
    try:
        # Hand off the logic to the service layer
        result = process_question(payload)
        return result
    except Exception as e:
        print(f"Error processing question: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")