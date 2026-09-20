# Car Wash Management Platform

Local-first car wash operations software for South Africa (ZAR / Africa/Johannesburg).

**Version:** 0.9.0

Works with **zero** Microsoft 365 / SharePoint / Power Apps / payment-gateway configuration.

## Quick start (Windows)

1. Install Python 3.11+ and Node.js 18+.
2. Double-click `BUILD.cmd` (leaves the window open on failure).
3. Double-click `Run.cmd`.
4. Open http://localhost:8787
5. Complete first-run setup (admin, company, branch). Optional demo data available.

## Quick start (Linux / this box)

```bash
./scripts/build.sh
./scripts/dev_run.sh
# open http://127.0.0.1:8787
```

## Stack

- Backend: Python FastAPI + SQLAlchemy 2 + Alembic + SQLite (WAL) + Pydantic v2 + bcrypt sessions
- Frontend: React 18 + TypeScript + Vite + Tailwind
- Default port: **8787**
- Portable data directory: `./data`

## Features (implemented)

Customer self-signup portal + controlled staff invites, live bay board on Home/mobile, Done→customer ready email, bay colour states, role-gated Settings, Cash / salary-deduction payment intent + payroll export, local calendar + optional Outlook owner alerts, ticket-first vehicle ID (no plates by default), Easy / Simple Mode, Launch hub (QR staff access, Power Apps / SharePoint wizards), customisable bays & branding, Dashboard KPIs, customers, vehicles, services, packages, bookings, live wash queue (stage moves), calendar views, employees, attendance, payments, invoices/receipts (PDF), cash-up, inventory, suppliers, expenses, reports (CSV/Excel), branches, wash bays, notifications, branding/settings, integrations centre (all Not Configured), admin users, audit log, activity timeline, diagnostics, backup/restore, global search, first-run wizard, RBAC.

## Integrations

M365 auth/calendar, SharePoint, Power Apps, email/SMS/WhatsApp/Teams, card payments — **adapter interfaces with null implementations**. Status UI only. Never block startup.

## Scripts

| Windows | Purpose |
|---------|---------|
| BUILD.cmd | Install deps, build frontend, run tests |
| Run.cmd | Start server |
| Stop.cmd | Stop listener on 8787 |
| Backup.cmd / Restore.cmd | Backup & restore |
| Diagnostics.cmd | Environment checks |
| Repair.cmd / Install.cmd / Uninstall.cmd | Maintenance |

## API

- REST: `/api/v1/*`
- OpenAPI: `/api/docs`
- Health: `/health`

## Docs (start here)

**Managers:** read **[`docs/MANAGER_README.txt`](docs/MANAGER_README.txt)** first — where the app lives, hosting options, setup checklist, and FAQ in plain English.

Also: `docs/LAUNCH_GUIDE.txt`, `docs/HOSTING_OPTIONS.txt`, `docs/PORTAL_AND_INVITES.txt`, installation / admin / user / security / backup / API / architecture guides under `docs/`.
