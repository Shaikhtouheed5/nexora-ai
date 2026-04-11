from pydantic import BaseModel
from typing import Optional, List


class QuizSubmitRequest(BaseModel):
    answers: List[int]
    questions: List[dict]
