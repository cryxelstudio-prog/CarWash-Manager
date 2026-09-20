================================================================================
CAR WASH MANAGER — MANAGER README (plain English)
Version 0.9.0 · South Africa (ZAR · Africa/Johannesburg)
================================================================================

This guide is for the owner / manager — not for developers.
Keep this file handy. Also open Help inside the app after you sign in.

--------------------------------------------------------------------------------
1. WHERE THE APP LIVES
--------------------------------------------------------------------------------

• On this PC: the software folder (often something like CarWash-Manager).
  Your data lives in a "data" folder next to it. Backups go in "backups".

• Local URL (this computer’s browser):
    http://localhost:8787
  or
    http://127.0.0.1:8787

• Phones on the same Wi‑Fi (LAN):
    Use Launch → Staff phone access. You’ll see a LAN address and a QR code.
    Example shape: http://192.168.x.x:8787/m

• Staff login (wash floor / reception / managers):
    /login   or mobile /m

• Customer portal (customers book themselves and see history):
    /portal/register   ·   /portal/login   ·   /portal

• Staff invite links (one-time, controlled):
    /invite/{token}   — created under Admin → Users → Invite staff

• Launch hub (QR, Outlook, Power Apps, SharePoint, public URL):
    Sign in as Admin/Manager → Launch

You do NOT need the internet for day-to-day washes. Microsoft / cloud tools are optional.

--------------------------------------------------------------------------------
2. HOSTING OPTIONS (when to use which)
--------------------------------------------------------------------------------

A) LOCAL STANDALONE (recommended start)
   Run on the wash PC / laptop. Staff open localhost. Phones on same Wi‑Fi use LAN URL.
   Required: this PC + Python/Node install (or your BUILD/Run scripts).
   Optional: nothing else.
   Best for: most car washes starting out.

B) LAN / COMPANY WI‑FI
   Same as local, but phones and tablets on the shop Wi‑Fi scan the Launch QR.
   Required: PC must stay on; Windows Firewall must allow port 8787.
   Optional: set a friendly Launch “public / LAN” base URL.
   Best for: floor staff with phones, no cloud needed.

C) OWN DOMAIN / SELF‑HOSTED WEB SERVER
   Put the app behind IIS, nginx, or a small VPS with your company domain
   (e.g. https://wash.yourcompany.co.za). Set Launch → Self-hosted / Custom URL.
   Required: someone who can reverse-proxy to port 8787; HTTPS certificate.
   Optional: still works offline-first locally if the server is on-site.
   Best for: multi-branch or wanting a clean customer URL for /portal.

D) SHAREPOINT
   Optional place for invoices / photos / documents.
   It does NOT replace this app. Day-to-day queue, bays, cash and bookings stay here.
   Configure under Launch / Integrations when you’re ready.
   Best for: companies already living in Microsoft 365 document libraries.

E) POWER APPS (companion)
   Optional phone screens that talk to our API (/api/v1). OpenAPI docs at /api/docs.
   Does not replace staff login or the bay board. Use CORS extras if needed.
   Best for: custom company apps that need wash data.

F) MICROSOFT 365 / OUTLOOK
   Optional: email the owner when a car is ready; optional calendar sync.
   If Outlook is not set up, the wash still runs — you get in-app notifications.
   Configure under Launch → Outlook Calendar / Owner alerts.
   Best for: managers who want email without changing floor workflow.

Summary: Local + LAN is enough. Domain, SharePoint, Power Apps, Outlook = optional polish.

More detail: docs/HOSTING_OPTIONS.txt and docs/LAUNCH_GUIDE.txt
(they point back here for the manager view).

--------------------------------------------------------------------------------
3. HOW TO CONFIGURE (checklist)
--------------------------------------------------------------------------------

1) First-run
   Open http://localhost:8787 → complete setup (admin user, company, branch, prices).
   Optional demo data if you want sample cars.

2) Branding
   Settings / Launch → logo, accent colour, company name, login background.
   Receipt footer text for customers.

3) Bays
   Wash Bays: Bay 1 & Bay 2 seed automatically. Add / rename / reorder as needed.
   Colours: green = free · amber = busy · blue = ready · grey = offline/closed.
   Dashboard and phone home show LIVE bays (auto-refresh).

4) Services & prices (ZAR)
   Services / Packages — set prices managers can edit. Staff see them on Quick Book.

5) Users & roles
   Admin → Users. Roles include Admin, Manager, Senior Tech, Reception, Operator, etc.
   Frontline staff do NOT see Settings / Launch / Admin.

6) Staff invites (safe onboarding)
   Admin → Users → Invite staff → pick role + expiry (e.g. 7 days) → copy link.
   Staff open /invite/... and set username + password. One-time use; you can revoke.
   There is NO open public staff signup.

7) Customer signup
   Customers use /portal/register (linked from staff login and Launch).
   They book and see history. They never see Admin / Settings / Launch.

8) Outlook / email (optional)
   Launch → Outlook + Owner alerts. Test connection. If it fails, washes still work.

9) Salary deduction
   Quick Book: Cash vs Salary deduction (employee number). Payroll CSV on Payments.
   Settings toggle: allow salary deduction; optional monthly soft cap.

10) Easy / Simple Mode
    Larger text and buttons — every role, including managers. Toggle on login or header.

11) Backups
    Backup page or Backup.cmd. Store copies off the PC (USB / OneDrive / NAS).
    Restore only from a known-good backup.

--------------------------------------------------------------------------------
4. FAQ (manager questions)
--------------------------------------------------------------------------------

Q: Do we need internet / Microsoft to run day-to-day?
A: No. Local SQLite + this app is enough. Microsoft is optional for email/docs/apps.

Q: How do staff get on phones?
A: Launch → Staff phone access → scan QR or open /m on the same Wi‑Fi. Sign in with
   staff username. Or send a controlled invite link from Admin → Users.

Q: How do customers create accounts?
A: /portal/register — name, phone, email, password. Then /portal to book and see history.
   Staff login page has “Customer sign up”.

Q: How do we invite staff safely?
A: Admin → Invite staff. One-time link with role + expiry. Revoke if unused.
   Staff cannot self-register without that link.

Q: Can we hide number plates?
A: Yes — plates are hidden by default. Ticket number (T-0001…) is the main ID.
   Settings: show / require registration if you really need plates.

Q: Cash vs salary deduction / payroll export?
A: At booking, choose Cash or Salary deduction (needs employee number).
   When wash is Done/Ready, salary jobs land on a pending ledger.
   Payments page → export CSV for payroll; optionally mark exported.

Q: What happens when a wash is Done?
A: Stage goes READY. Optional note to the car owner. If email is on and an address
   exists, “Your car is ready” is sent; otherwise a friendly in-app message.
   Owner alerts can also email you if Outlook is configured.

Q: Who can see Settings?
A: Admin / Manager (settings.manage). Senior Tech can manage users but not Launch/
   Settings backend. Reception / Operator / Detailer — ops only.

Q: How do we backup?
A: Backup in the app, or Backup.cmd. Keep copies somewhere safe. Test restore once.

Q: How do we put this on our company domain?
A: Host the app (or reverse-proxy port 8787), set HTTPS, then Launch → Custom URL
   so QR and portal links use https://yourdomain/...  See HOSTING_OPTIONS.txt.

Q: How does Power Apps connect?
A: Point a custom connector at /api/v1 (OpenAPI at /api/docs). Add CORS origins in
   Settings if needed. Power Apps is a companion — not a replacement.

Q: How does SharePoint fit?
A: Optional document home for invoices/photos. Configure site/library in Launch.
   Queue and cash still live in Car Wash Manager.

Q: What if Outlook isn’t set up?
A: Nothing breaks. Use in-app Notifications. Add Outlook later for email.

Q: Can elderly staff use it?
A: Yes — turn on Simple mode (larger text). Mobile /m leans Simple by default.

Q: Multi-bay / only 2 bays?
A: Defaults are Bay 1 & Bay 2. Add more under Wash Bays. Live board shows active bays.

Q: Windows firewall / phone can’t connect?
A: Allow inbound TCP 8787 on the wash PC. Phone must be on same Wi‑Fi (not guest
   isolation). Prefer LAN IP from Launch, not “localhost” on the phone.

Q: Updating the software?
A: Stop the app → replace/update files → BUILD.cmd → Run.cmd. Data folder is kept.
   Read docs/UPGRADE_GUIDE.txt. Version shows on Diagnostics / health.

Q: Support bundle / diagnostics?
A: Diagnostics page (managers): version, database OK, paths, user count.
   Check logs/ folder if something fails. Don’t email passwords.

Q: Can customers see staff screens?
A: No. Portal is separate. Staff stay on /login. Customers never get Admin/Settings.

Q: What if someone shares a staff invite?
A: Revoke it under Admin → Users. Create a new invite. Used invites can’t be reused.

Q: Multiple branches?
A: Yes — Branches page. Users/invites can be tied to a branch. Filter bookings by branch.

Q: Currency and time?
A: ZAR and Africa/Johannesburg by default. Change in Settings / first-run if needed.

Q: Card machines / payment gateways?
A: Optional. Cash and salary deduction work offline. Card/EFT can be recorded manually.

--------------------------------------------------------------------------------
5. DAILY RHYTHM (suggested)
--------------------------------------------------------------------------------

Morning: open app → check Live bays on Home → staff sign in on phones.
During day: Quick Book / Queue / Done when car ready.
End of day: Cash-up + Backup (or nightly automatic habit).
Weekly: review salary deduction export if you use it; revoke old invites.

--------------------------------------------------------------------------------
6. WHERE TO READ MORE
--------------------------------------------------------------------------------

• This file — docs/MANAGER_README.txt  (you are here)
• docs/LAUNCH_GUIDE.txt — QR, LAN, Outlook wizards
• docs/HOSTING_OPTIONS.txt — domain / IIS / nginx pointers
• docs/PORTAL_AND_INVITES.txt — customer portal + staff invites (short)
• docs/USER_GUIDE.txt / ADMIN_GUIDE.txt — deeper detail
• In-app Help — especially useful in Simple mode

Calm, local-first, ZAR-ready. Start simple; add Microsoft only when you need it.
================================================================================
