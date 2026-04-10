from pydantic import BaseModel
from typing import List, Optional

class QuizAnswer(BaseModel):
    question_id: int
    selected_index: int
    options: List[str]

class QuizSubmission(BaseModel):
    answers: List[QuizAnswer]
    user_id: Optional[str] = None
    quiz_type: Optional[str] = "daily" # "daily" or "lesson"
    quiz_id: Optional[str] = None # UUID for daily, int for lesson
