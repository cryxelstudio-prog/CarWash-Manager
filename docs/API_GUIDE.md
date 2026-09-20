# API Guide

Base URL: `http://localhost:8787/api/v1`

Auth: session cookie after `/auth/setup` or `/auth/login`. Send `X-CSRF-Token` on POST/PUT/DELETE.

Interactive docs: `/api/docs`

Key resources: auth, dashboard, customers, vehicles, services, packages, bookings (+ queue/stage/check-in), payments, invoices, cash-ups, employees, attendance, inventory, suppliers, expenses, branches, wash-bays, reports, settings, branding, integrations, audit-log, activity, notifications, search, backups, diagnostics, users.
