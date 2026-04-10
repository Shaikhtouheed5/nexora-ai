from pydantic import BaseModel
from typing import List, Optional

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    xp_reward: int = 10
    topic: str

class QuizAnswerRequest(BaseModel):
    question_id: str
    selected_index: int

class QuizAnswerResponse(BaseModel):
    correct: bool
    correct_index: int
    explanation: str
    xp_earned: int
