from pydantic import BaseModel
from typing import Optional

class QuestionPayload(BaseModel):
    sessionId: str
    deviceId: str
    text: str
    questionType: int
    previousQuestionType: Optional[int] = None  # <--- NEW
    computeMode: str