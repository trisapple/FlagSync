from pydantic import BaseModel


class EventAnalyticsResponse(BaseModel):
    total_registrations: int
    active_participants: int
    teams_formed: int
    submissions: int
    resource_downloads: int
