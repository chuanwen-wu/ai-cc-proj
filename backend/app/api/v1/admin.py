from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ping")
def admin_ping(current_user: User = Depends(get_current_admin)) -> dict[str, str]:
    return {"role": current_user.role, "email": current_user.email}
