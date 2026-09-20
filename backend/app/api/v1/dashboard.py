"""Dashboard KPIs."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.entities import DashboardOut
from app.security.deps import AuthContext, CSRFUser, require_permission
from app.services.dashboard import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(branch_id: int | None = None, db: Session = Depends(get_db), ctx: AuthContext = Depends(require_permission("dashboard.view"))):
    return get_dashboard(db, branch_id=branch_id)
