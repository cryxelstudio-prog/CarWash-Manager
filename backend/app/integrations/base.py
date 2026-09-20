"""Integration interfaces — null implementations by default."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class IMicrosoftAuthenticationService(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...


class IMicrosoftCalendarService(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...
    @abstractmethod
    def sync_booking(self, booking_id: int, event: dict[str, Any] | None = None) -> dict: ...


class ISharePointService(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...


class IPowerPlatformService(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...


class INotificationService(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...
    @abstractmethod
    def send(self, channel: str, to: str, subject: str, body: str) -> dict: ...


class IPaymentProvider(ABC):
    @abstractmethod
    def is_configured(self) -> bool: ...
    @abstractmethod
    def status(self) -> dict: ...
    @abstractmethod
    def charge(self, amount: float, currency: str, meta: dict[str, Any] | None = None) -> dict: ...


class NullMicrosoftAuth(IMicrosoftAuthenticationService):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {"status": "NOT_CONFIGURED", "message": "Microsoft 365 authentication is not configured"}


class NullMicrosoftCalendar(IMicrosoftCalendarService):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {"status": "NOT_CONFIGURED", "message": "Outlook calendar sync is optional — local calendar is primary"}
    def sync_booking(self, booking_id: int, event: dict[str, Any] | None = None) -> dict:
        return {"ok": False, "reason": "not_configured"}


class NullSharePoint(ISharePointService):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {"status": "NOT_CONFIGURED", "message": "SharePoint is not configured"}


class NullPowerPlatform(IPowerPlatformService):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {"status": "NOT_CONFIGURED", "message": "Power Apps is not configured"}


class NullNotification(INotificationService):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {
            "status": "NOT_CONFIGURED",
            "message": "External email not configured; in-app owner alerts still work",
        }
    def send(self, channel: str, to: str, subject: str, body: str) -> dict:
        return {"ok": False, "reason": "not_configured", "channel": channel}


class NullPaymentProvider(IPaymentProvider):
    def is_configured(self) -> bool:
        return False
    def status(self) -> dict:
        return {
            "status": "NOT_CONFIGURED",
            "message": "External card payment provider is not configured; local cash/card/EFT recording works",
        }
    def charge(self, amount: float, currency: str, meta: dict[str, Any] | None = None) -> dict:
        return {"ok": False, "reason": "not_configured"}


# Singletons used by the app (live Outlook adapters are resolved per-request from settings)
microsoft_auth = NullMicrosoftAuth()
microsoft_calendar = NullMicrosoftCalendar()
sharepoint = NullSharePoint()
power_platform = NullPowerPlatform()
notifications = NullNotification()
payment_provider = NullPaymentProvider()
