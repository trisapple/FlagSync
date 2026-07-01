import uuid

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    score: int
    solves: int
    entrant_id: uuid.UUID


class LeaderboardResponse(BaseModel):
    mode: str  # "team" or "user"
    entries: list[LeaderboardEntry]
