from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.dependencies import get_current_user

router = APIRouter()

class RegisterBody(BaseModel):
    email: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(body: RegisterBody):
    pass

@router.post("/login")
def login(body: LoginBody):
    pass

@router.post("/refresh")
def refresh():
    pass

@router.post("/logout")
def logout(user=Depends(get_current_user)):
    pass

@router.get("/me")
def me(user=Depends(get_current_user)):
    pass
