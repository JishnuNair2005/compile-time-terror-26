from fastapi import APIRouter, HTTPException
from app.models.question import QuestionPayload
from app.services.question_service import process_question

router = APIRouter()

@router.post("/questions")
def submit_question(payload: QuestionPayload):
    try:
        # Hand off the logic to the service layer
        result = process_question(payload)
        return result
    except Exception as e:
        print(f"Error processing question: {e}")
        raise HTTPException(status_code=500, detail="Failed to process question")