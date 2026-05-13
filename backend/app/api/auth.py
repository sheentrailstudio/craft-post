from fastapi import APIRouter, Depends

from app.api.deps import get_profile
from app.core.auth import AuthUser, get_current_user
from app.core.database import SupabaseServiceClient, get_supabase_service


router = APIRouter()


@router.get("/auth/profile")
async def profile(
    user: AuthUser = Depends(get_current_user),
    db: SupabaseServiceClient = Depends(get_supabase_service),
):
    user_profile = await get_profile(db, user)
    return {
        "id": user.id,
        "email": user.email,
        "plan": user_profile.get("plan", "free"),
    }
