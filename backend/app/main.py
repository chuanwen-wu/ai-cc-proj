from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, auth, users
from app.core.config import settings


def _validate_startup_config() -> None:
    """启动前自检配置一致性。任何不一致直接抛错让容器起不来。"""
    treasury = settings.PLATFORM_TREASURY_EMAIL
    if treasury:
        admins = settings.admin_emails_list
        if treasury.strip().lower() not in admins:
            raise RuntimeError(
                f"PLATFORM_TREASURY_EMAIL ({treasury}) must be included in ADMIN_EMAILS"
                f" ({settings.ADMIN_EMAILS})"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    _validate_startup_config()
    yield


app = FastAPI(title="ai-cc-proj", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
