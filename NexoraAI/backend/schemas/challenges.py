from pydantic import BaseModel


class ChallengeVerifyRequest(BaseModel):
    answer: str
