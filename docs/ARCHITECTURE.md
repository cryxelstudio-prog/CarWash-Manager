# Architecture

```
React SPA (Vite)  ->  FastAPI (/api/v1)  ->  SQLAlchemy repositories/services  ->  SQLite WAL
                                      \->  Integration adapters (null by default)
```

- Local-first Mode 1 fully implemented.
- Integrations use interface + null adapter pattern; failures never crash the app.
- Frontend production build is served by FastAPI from `frontend/dist`.


## v0.9.0 — Customer portal & staff invites

**Design choice:** unified `users` table with role `customer` and `customer_id` FK to `customers`.

- Staff session cookie: `carwash_session` (salt `carwash-session`). Staff login rejects customer role.
- Portal session cookie: `carwash_portal_session` (salt `carwash-portal-session`). Portal deps require customer role / `customer_id`.
- Staff invites: `staff_invites` stores **hashed** tokens (`sha256`), `role_id`, optional `branch_id`, `expires_at`, `used_at`, `revoked_at`, `created_by_id`. Accept at `/invite/{token}` → creates staff User. Open `POST /api/v1/staff/register` is rejected.
- `list_users` / `setup_required` ignore portal customers.
- Live bay board data comes from dashboard `bays` payload; frontend auto-refreshes ~12s on Home and `/m`.

Manager-facing docs: `docs/MANAGER_README.txt`, `docs/PORTAL_AND_INVITES.txt`.
