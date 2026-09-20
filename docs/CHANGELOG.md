# Changelog

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
