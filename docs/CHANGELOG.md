# Changelog

## 0.8.0 — 2026-09-20
- **Mobile polish** — `/m`, Easy Mode, Queue, Quick Book and Bays: cleaner cards, professional header with logo, soft empty states (“No cars waiting — nice and quiet”), large touch targets kept.
- **Done / Mark complete** — primary Done on Queue cards, Bay board and mobile jobs. Optional message to car owner → confirm “Yes, car is ready” → stage READY + wash complete.
- **Customer email** — if booking/customer has email (optional Quick Book field) and **Email car owner when wash done** is ON, sends “Your car is ready” via existing Graph/SMTP adapters; always creates in-app notification; friendly “Saved — no customer email on file” when absent. Offline-first (Done succeeds even if email fails).
- **Bay colours** — Available green · Busy/booked amber with pulse · Ready blue · Offline/Closed grey. Easy labels: Bay free / Bay busy / Ready.
- **Roles & permissions** — Admin, Manager, Senior Tech (Supervisor), Reception, Operator, Detailer, etc. User management (create/edit/activate) for Admin / Manager / Senior Tech. Settings, Launch, Integrations, Admin, Diagnostics, Reports API-gated — frontline staff never see backend settings on mobile/Easy Mode.
- Version bump to 0.8.0.

## 0.7.0 — 2026-09-20
- **Booking payment intent** — Quick Book, Easy Mode and `/m` require **How will you pay?** with large **Cash** / **Salary deduction** buttons (More… for card / EFT / account / other).
- **Anyone can use salary deduction** (including walk-ins) if they enter an **employee number**; cash does not need one. Validated server-side with a clear error when missing.
- **Salary deduction ledger** — on wash READY/COLLECTED, auto-creates payment `PENDING_SALARY` / unpaid invoice; customer view shows outstanding salary balance; manager can mark batch deducted/paid.
- **Payroll export** — Payments page: date-range CSV (default current month) with employee_number, name, phone, tickets, dates, amounts, total; optional mark `exported_at` + re-include toggle.
- **Settings** — Allow salary deduction (default ON); optional soft monthly cap warning per employee number.
- **UX** — Receipt/PDF: “Salary deduction – billed at month end” / “Cash – pay at bay”; queue & bay cards show **CASH** / **SALARY** badges.
- Offline-first; no external payment gateway required. Full backend still supports card/EFT/account/voucher.
- Version bump to 0.7.0.

## 0.6.0 — 2026-09-20
- **Local calendar authoritative** — Day/Week/Month/Agenda shows ticket + vehicle description; click for details; colour by status/bay; branch filter; **Add to calendar (.ics)** without Outlook.
- **Owner alerts** — Launch + Settings: owner name/email and toggles (car ready / completed / booking / cancelled / no-show). Stage → READY/COLLECTED (and create/cancel/no-show) creates in-app notification and best-effort outbound email.
- **Offline-first** — if Outlook/Graph/SMTP fails, booking still succeeds; Notifications show pending/failed outbound.
- **Launch → Outlook Calendar** wizard (non-technical): Connect toggle, owner email, optional sync, email-when-ready, Graph vs Simple SMTP fields, Save + Test connection / Send test alert, friendly status.
- Integrations: `outlook_notifications` + calendar sync stub via Microsoft Graph; SMTP fallback; null when disabled.
- Easy Mode: confirm “Tell owner car is ready?” when moving to READY.
- Docs: OUTLOOK_SETUP.txt; LAUNCH/HOSTING updated.
- Version bump to 0.6.0.

## 0.5.0 — 2026-09-20
- **Boss rule:** registration plates are **not** the primary staff identifier (hidden by default).
- **Wash ticket / claim number** auto-generated on booking (`T-0001`…); shown large on queue cards, bay board, receipts.
- **Customer name + phone** remain the primary lookup; search also matches ticket and vehicle description.
- **Vehicle description** (colour + make + model) required — displayed as e.g. "White Polo".
- Registration optional, behind Quick Book "Advanced details"; Settings toggles:
  - **Show registration plates** (default OFF)
  - **Require registration** (default OFF / `require_registration=false`, `hide_registration=true`)
- Updated: vehicles model/API, Quick Book, Bookings, Queue, Bay cards, global search, Easy Mode labels, receipts/PDFs, demo data.
- Optional check-in inspection photos remain supported.
- Version bump to 0.5.0.


## 0.4.0 — 2026-09-20
- **Easy / Simple Mode** for accessibility (elderly-friendly and clear for all staff):
  - Larger text (~18–28px), huge tap targets (~60px), calmer spacing, optional high contrast, reduced motion.
  - Simpler nav: Home, Book a wash, Queue, Bays, Help.
  - Managers in Easy Mode still get large buttons for Prices, Today's money, Staff, Settings — not a stripped toy UI.
  - Available to **every role** (Owner / Manager / Admin / Reception / Operator). No role is locked to Full Mode.
  - Login checkbox: "Simple mode (larger text)"; preference stored per user (`easy_mode`) with localStorage backup.
  - Obvious header / sidebar **Full mode** ↔ **Simple mode** toggle.
  - Mobile `/m` leans Easy by default.
  - Clear booking confirmations: "Yes, book it" / "Cancel".
  - Bay labels: "Bay free" / "Bay busy".
  - Help page tips for Simple Mode.
- API: `PATCH /api/v1/auth/me` (`easy_mode`, `theme`); login accepts optional `easy_mode`.
- Version bump to 0.4.0.

## 0.3.0 — 2026-09-20
- Staff phone access: scannable QR + copyable invite/mobile links (LAN hostname & IP helpers) on Launch.
- Launch hub: Local, LAN, Power Apps, SharePoint, Self-hosted wizards with persisted settings.
- Customisable wash bays: add / rename / reorder / enable-disable (defaults still seed Bay 1 & 2).
- Branding: logo upload, accent colour, login background, polished commercial theme.
- Mobile entry route `/m` for compact staff login + quick ops.
- Docs: LAUNCH_GUIDE.txt; HOSTING_OPTIONS updated.

## 0.2.0 — 2026-09-20
- Phone-first shell: bottom nav (Home, Book, Queue, Bays, Customers, More) + polished SaaS UI.
- Live Bay Board for exactly two default bays (Bay 1 / Bay 2) with Available / Busy / Offline / Closed, auto Busy when a wash is assigned, manager overrides.
- Quick Book flow (dropdowns, few taps) plus advanced booking kept for power users.
- Dashboard: clearer KPIs, bay widgets, queue length, better empty states.
- Services / Packages: card UI with clear ZAR price editing and active toggle (Manager/Owner only).
- Hosting options doc + Settings tip; CORS extras for Power Apps / LAN via env.
- Version bump to 0.2.0.

## 0.1.0 — 2026-09-20
- Initial production-capable local release.
- First-run wizard, RBAC, bookings + wash queue, payments/PDF, inventory, reports, backup/restore.
- Integration centre with Not Configured adapters for M365/SharePoint/Power Apps/notifications/payments.

## 0.7.1
- Hotfix: allow bookings without registration plates (SQLite migration makes vehicles.registration nullable).
