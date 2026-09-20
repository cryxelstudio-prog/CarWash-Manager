# Car Wash Management Platform — Full Requirements

## Project name
Car Wash Management Platform (commercial-grade, NOT a POC)

## Critical rule
THE APPLICATION MUST WORK BEFORE ANY CLOUD OR MICROSOFT 365 CONFIGURATION EXISTS.

User must be able to: extract → BUILD.cmd → Run.cmd → open browser → first-run admin setup → full CRUD for customers/vehicles/bookings/employees/services → dashboard → reports → branding → settings — ALL without SharePoint, Power Apps, Graph, Azure, Entra, external DB, SMTP, payment gateways, or API keys.

Cloud integrations = OPTIONAL MODULES. Never block startup.

## Technology stack (MANDATORY)
- Backend: Python 3.11+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2
- Auth: session cookies + bcrypt password hashing; local auth always available
- Database: SQLite for standalone (WAL mode); repository pattern so PostgreSQL/SQL Server can be added later
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS; professional commercial UI (not generic admin template)
- API: versioned REST under /api/v1/; OpenAPI/Swagger at /api/docs
- Package manager: backend pip/venv; frontend npm
- Version: start at 0.1.0 (semver)
- Defaults (SA): currency ZAR, timezone Africa/Johannesburg, date DD/MM/YYYY — all configurable

## Architecture
CORE + LOCAL DB + WEB UI + optional connectors (M365, SharePoint, Power Apps, Calendar, Email/SMS/WhatsApp, Payments).
Use interfaces/adapters: IMicrosoftCalendarService, ISharePointService, IMicrosoftAuthenticationService, IPowerPlatformService, INotificationService, IPaymentProvider.
Null/disabled implementations by default. Integration failures never crash the app.

## Deployment modes (design for all; implement Mode 1 fully)
1. LOCAL STANDALONE (DEFAULT) — http://localhost:PORT
2. LAN / internal server — firewall helpers in docs/scripts
3. Self-hosted web — env/config based
4. Microsoft 365 / SharePoint — adapters only for now
5. Power Apps — clean REST API boundary

## Windows scripts (root of repo) — MUST WORK
BUILD.cmd, Build-And-Validate.ps1, Install.cmd, Run.cmd, Stop.cmd, Repair.cmd, Backup.cmd, Restore.cmd, Diagnostics.cmd, Uninstall.cmd
On failure: show error, log path, PAUSE so window stays open.
Data dir default concept: ProgramData\CarWashManager\ (or ./data in portable/dev mode)
Install target concept: Program Files\CarWashManager\ (Install.cmd)
Portable/dev mode must work from extracted folder without install.

## First-run wizard (no internet)
If no admin exists: create admin → company info → first branch → initial services → optional demo data → finish.
Do NOT ask for Microsoft 365 during setup.

## UI — polished commercial software
Sidebar nav: Dashboard, Bookings, Live Wash Queue, Calendar, Customers, Vehicles, Services, Packages, Employees, Attendance, Payments, Expenses, Inventory, Reports, Notifications, Branches, Microsoft 365, Integrations, Admin, Settings, Help
Touch-friendly, responsive (desktop/tablet/phone), light/dark/system themes, configurable accent with contrast protection.
Branding settings (no hardcoded customer-facing product name): app name, company, logos, favicon, colours, receipt/invoice logos, footer, contacts.

## Modules to IMPLEMENT (real working code, no fake buttons)

### Dashboard KPIs (real data)
Today's bookings, waiting, washing, completed, ready for collection, cancelled, no-shows, revenue today/week/month, cash/card/outstanding, vehicles washed, avg wash/wait time, customer counts, returning/new, attendance, working employees, low stock, upcoming bookings, recent activity, system health, integration status. KPI cards + charts.

### Live wash board
Stages: BOOKED → ARRIVED → CHECK-IN → WAITING → PRE-WASH → WASHING → INTERIOR → DETAILING → QUALITY CHECK → READY → COLLECTED
Drag-and-drop AND buttons. Cards: customer, vehicle, reg, service, package, arrival, stage, assignee, ETA, payment status, instructions, priority, colour status.

### Bookings
Full CRUD + move/cancel/reschedule/duplicate/check-in/no-show/complete/search/filter.
Fields: customer, phones, email, vehicle, reg, type, service, package, extras, date/time, duration, branch, staff, statuses, notes, internal notes, source (Walk-in, Telephone, Website, Staff, Power Apps, Microsoft 365, SharePoint, Imported).

### Calendar
Day/Week/Month/Agenda; bookings on calendar; per-branch calendars; local works first.

### Customers & Vehicles
Full fields as specified. Multiple vehicles per customer. Search/filter.

### Vehicle check-in / inspection
Scratches, dents, cracks, wheels, interior, valuables, photos, acknowledgement, timestamp, employee → condition record.

### Services / Packages / Extras / Vehicle-size pricing
Admin-configurable (NOT hardcoded). Categories, prices, duration, tax, staff/stock requirements, upsells. Packages combine services. Size pricing: Small, Sedan, Hatchback, SUV, Bakkie, Van, Minibus, Commercial, Custom.

### Employees, roles, RBAC, attendance, job assignment
Roles: Super Admin, Owner, Manager, Supervisor, Reception, Cashier, Operator, Detailer, Finance, Reports Only, Custom. Configurable permissions. Clock in/out/breaks. Assign to workers/teams/bays/branches.

### Payments, invoices, receipts, cash-up
Methods: Cash, Card, EFT, Account, Voucher, Other (admin-extendable). No raw card processing without provider. Professional PDF receipts/invoices. Daily cash-up with variance and manager sign-off.

### Expenses, inventory, suppliers
Full CRUD. Low stock alerts. Optional auto-consume stock from services.

### Loyalty, memberships, fleet/corporate
Configurable points/rewards/codes; memberships; company accounts with multi-vehicle, monthly billing, statements.

### Reports + export
All listed sales/ops/staff/inventory reports. Filters. Export CSV, Excel-compatible, PDF where practical.

### Branches, wash bays, notifications (internal first)
Multi-branch. Bay assignment. Internal notification engine; adapters for email/SMS/WhatsApp/Teams later.

### Integrations centre
All start DISABLED. Status cards: Not configured / Configured / Connected / Failed / Disabled. Never crash on failure.

### Admin, branding, settings, booking rules, security
Comprehensive admin. Audit log. Activity timeline. Global search. Backup/restore with validation. Migrations with versioning. Diagnostics + support bundle (redact secrets). Logging (app/security/integration/db/auth/startup) without secrets. Health at /health.

### API
/api/v1/ auth, bookings, customers, vehicles, services, packages, employees, schedules, payments, inventory, branches, dashboard, reports, integrations, health. Documented OpenAPI.

### PWA basics
manifest, icons, responsive, installable shell.

### QR preparation
Booking/vehicle/receipt/job/loyalty lookup without embedding secrets.

### Optional future: customer portal + public booking
Architect boundaries only; admin app must not depend on them.

## Data model (implement with migrations)
User, Role, Permission, Employee, Branch, Customer, Vehicle, Booking, BookingItem, Service, Package, Payment, Invoice, Expense, InventoryItem, Supplier, Attendance, WashBay, JobStage, VehicleInspection, Attachment, LoyaltyAccount, Membership, FleetAccount, Notification, AuditLog, Activity, Integration, ApplicationSetting — proper relationships, soft-delete/archive where appropriate, validation (no negative prices/stock, valid transitions, etc.)

## Testing (automated)
Unit, API, DB, auth, permissions, booking, payment, migration, backup/restore, validation, smoke, startup. BUILD.cmd runs tests and health check.

## Documentation (create all)
README.md, INSTALLATION_GUIDE.txt, ADMIN_GUIDE.txt, USER_GUIDE.txt, MICROSOFT_365_SETUP.txt, SHAREPOINT_SETUP.txt, POWER_APPS_INTEGRATION.txt, BACKUP_RESTORE_GUIDE.txt, UPGRADE_GUIDE.txt, TROUBLESHOOTING.txt, SECURITY_GUIDE.txt, API_GUIDE.md, ARCHITECTURE.md, CHANGELOG.md

## Acceptance (must pass before claiming done)
Fresh extract → BUILD.cmd succeeds → tests pass → Run.cmd → first-run → login → create customer/vehicle/service/booking → check-in → move stages → payment → complete → dashboard updates → receipt → report → backup → stop → restart → data persists → M365/SharePoint NOT configured → app still works.

## Build philosophy
No empty pages, fake buttons, TODOs as features, or placeholder modules. Real implementations. Work phase by phase but deliver a launchable app ASAP then expand. Keep last working state before risky changes.

## Suggested layout
/backend (app, models, repositories, services, api, security, integrations, migrations)
/frontend (React app)
/scripts (Windows cmd/ps1 helpers if not all at root)
/docs
/tests
/data (dev default, gitignored)
/uploads, /logs, /backups (gitignored with .gitkeep)
Root: BUILD.cmd, Run.cmd, etc., README.md, pyproject.toml or requirements.txt, package.json workspace or frontend/package.json

## Priority order
Phase 1 Architecture + bootable foundation
Phase 2 DB + auth + first-run
Phase 3 Customers + vehicles + services + bookings
Phase 4 Calendar + live wash workflow
Phase 5 Employees + roles + permissions
Phase 6 Payments + invoices + receipts + cash-up
Phase 7 Inventory + suppliers + expenses
Phase 8 Reports + dashboards
Phase 9 Branding + branches + configuration
Phase 10 Backup + restore + audit + diagnostics
Phase 11 REST API polish + docs
Phase 12 M365 + SharePoint + Power Apps adapter stubs + Integrations UI
Phase 13 Automated tests + security validation
Phase 14 Windows installer/build/update scripts
Phase 15 Complete docs + acceptance testing

GO ALL OUT. Build the actual application.
