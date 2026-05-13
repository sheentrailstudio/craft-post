from typing import List, Optional

from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.services.ai.refine import refine_with_claude


router = APIRouter()


class RefineRequest(BaseModel):
    draft: str = Field(..., min_length=1, max_length=5000)
    user_subprompt: Optional[str] = Field(None, max_length=300)
    media_urls: List[str] = []


class RefineResponse(BaseModel):
    post_id: str
    refined: str


@router.post("/draft/refine", response_model=RefineResponse)
async def refine(body: RefineRequest):
    refined = await refine_with_claude(body.draft, body.user_subprompt)
    return RefineResponse(post_id="unsaved", refined=refined)
