from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import GoogleLoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _expected_role(email: str) -> str:
    """根据当前 ADMIN_EMAILS 配置决定该 email 的角色。"""
    if email.strip().lower() in settings.admin_emails_list:
        return UserRole.admin.value
    return UserRole.user.value


@router.post("/google", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """前端拿到 Google ID Token 后调这个接口，换取后端 JWT。"""
    try:
        info = google_id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {e}",
        ) from e

    sub = info["sub"]
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    desired_role = _expected_role(email)
    user = db.query(User).filter(User.google_sub == sub).one_or_none()
    if user is None:
        user = User(
            google_sub=sub,
            email=email,
            name=info.get("name"),
            avatar_url=info.get("picture"),
            role=desired_role,
        )
        db.add(user)
    else:
        # 每次登录按当前 ADMIN_EMAILS 同步 role（升 / 降）
        if user.role != desired_role:
            user.role = desired_role
        # 同步可能变化的资料
        user.name = info.get("name")
        user.avatar_url = info.get("picture")

    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        subject=str(user.id), extra={"email": user.email, "role": user.role}
    )
    return TokenResponse(access_token=access_token)
