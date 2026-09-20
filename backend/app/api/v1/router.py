"""Aggregate API v1 router."""
from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    bookings,
    branches,
    customers,
    dashboard,
    employees,
    inventory,
    payments,
    reports,
    services_api,
    vehicles,
    portal,
    invites,
)

api_router = APIRouter(prefix='/api/v1')

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(customers.router)
api_router.include_router(vehicles.router)
api_router.include_router(services_api.router)
api_router.include_router(bookings.router)
api_router.include_router(payments.router)
api_router.include_router(employees.router)
api_router.include_router(inventory.router)
api_router.include_router(branches.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(portal.router)
api_router.include_router(invites.router)
