from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, draft, identities, platforms, publish, social
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.scheduler import dispatch_scheduled_posts, scheduler


app = FastAPI(title="Craftpost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list({settings.FRONTEND_URL, "http://localhost:3000"}),
    allow_methods=["*"],
    allow_headers=["*"],
)

protected_api = [Depends(get_current_user)]

app.include_router(auth.router, prefix="/api")
app.include_router(draft.router, prefix="/api", dependencies=protected_api)
app.include_router(identities.router, prefix="/api")
app.include_router(platforms.router, prefix="/api")
app.include_router(publish.router, prefix="/api")
app.include_router(social.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


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
