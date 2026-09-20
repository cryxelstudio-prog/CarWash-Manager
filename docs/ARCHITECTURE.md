# Architecture

```
React SPA (Vite)  ->  FastAPI (/api/v1)  ->  SQLAlchemy repositories/services  ->  SQLite WAL
                                      \->  Integration adapters (null by default)
```

- Local-first Mode 1 fully implemented.
- Integrations use interface + null adapter pattern; failures never crash the app.
- Frontend production build is served by FastAPI from `frontend/dist`.
