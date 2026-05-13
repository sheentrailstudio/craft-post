from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import draft, platforms, publish, social
from app.core.config import settings
from app.core.scheduler import dispatch_scheduled_posts, scheduler


app = FastAPI(title="Craftpost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list({settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"}),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(draft.router, prefix="/api")
app.include_router(platforms.router, prefix="/api")
app.include_router(publish.router, prefix="/api")
app.include_router(social.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    if not scheduler.get_job("check_scheduled_posts"):
        scheduler.add_job(
            dispatch_scheduled_posts,
            "interval",
            minutes=1,
            id="check_scheduled_posts",
        )
    scheduler.start()


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
