from pydantic import BaseModel, EmailStr, Field

class UserRegistration(BaseModel):
    # EmailStr automatically verifies that the input is a valid email format
    email: EmailStr = Field(
        ..., 
        description="Must be a valid email address format."
    )
    
    # Restrict to alphanumeric and underscores. Blocks spaces, quotes, and script tags.
    username: str = Field(
        ...,
        min_length=3, 
        max_length=30, 
        pattern=r"^[a-zA-Z0-9_]+$",
        description="Alphanumeric characters and underscores only to prevent injection."
    )
    
    # Enforce strong password policy required by Deliverable 2
    password: str = Field(
        ...,
        min_length=12, 
        description="Password must be at least 12 characters long."
    )
    
class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., description="User's password")