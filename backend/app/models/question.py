from pydantic import BaseModel

class QuestionPayload(BaseModel):
    sessionId: str
    userId: str
    text: str
    questionType: int  # 0 for "Sort of", 1 for "Lost"
    computeMode: str
    deviceId: str