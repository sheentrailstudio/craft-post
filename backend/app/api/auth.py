from fastapi import APIRouter, Depends

from app.core.auth import AuthUser, get_current_user


router = APIRouter()


@router.get("/auth/profile")
async def profile(user: AuthUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "plan": "free",
    }
