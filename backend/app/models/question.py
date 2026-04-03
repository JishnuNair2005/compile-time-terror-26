from pydantic import BaseModel
from typing import Optional

class QuestionPayload(BaseModel):
    sessionId: str
    deviceId: str
    text: str
    questionType: int
    computeMode: str = "openai"
    # 🔥 New fields expected from UserScreen.js
    teacherId: Optional[str] = "unknown"
    subject: Optional[str] = "General"
    topic: Optional[str] = "Unspecified"