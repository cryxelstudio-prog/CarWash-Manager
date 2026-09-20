"""Auth and setup schemas."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    username: str
    email: str | None = None
    full_name: str
    phone: str | None = None
    role_id: int
    role_name: str | None = None
    branch_id: int | None = None
    is_super_admin: bool = False
    theme: str = "system"
    permissions: list[str] = []


class SessionOut(BaseModel):
    user: UserOut
    csrf_token: str
    setup_required: bool = False


class SetupAdminIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)
    email: str | None = None


class SetupCompanyIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    currency: str = "ZAR"
    timezone: str = "Africa/Johannesburg"
    tax_rate: float = 15.0


class SetupBranchIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=32)
    phone: str | None = None
    address: str | None = None
    city: str | None = None


class SetupServiceIn(BaseModel):
    name: str
    code: str
    base_price: float
    duration_minutes: int = 30
    category: str = "WASH"


class SetupCompleteIn(BaseModel):
    admin: SetupAdminIn
    company: SetupCompanyIn
    branch: SetupBranchIn
    services: list[SetupServiceIn] = []
    load_demo_data: bool = False
