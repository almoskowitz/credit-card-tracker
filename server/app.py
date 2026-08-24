"""
Credit Card Tracker API — top-level entrypoint.
Run: uvicorn server.app:app --host 127.0.0.1 --port 8101

Mounts:
  /api/health  liveness probe (SELECT 1 against Postgres)
  /api/state   GET/PUT the single state blob (server/state.py)
  /            built client, served static from server/static/ (mounted last)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from .db import close_pool, get_pool, init_pool
from .state import router as state_router


class ClientStaticFiles(StaticFiles):
    """The client is a single hashed-content file; a stale index.html is indistinguishable
    from a broken deploy, so it is never cached."""

    async def get_response(self, path: str, scope: Scope):
        response = await super().get_response(path, scope)
        # html=True resolves "/" and other directory paths to index.html *inside*
        # get_response, so check the response's resolved file path, not the input `path`.
        resolved = str(getattr(response, "path", ""))
        if resolved.endswith("index.html"):
            response.headers["Cache-Control"] = "no-cache"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Credit Card Tracker API",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
# No CORS middleware -- the client is served same-origin.

app.include_router(state_router)


@app.get("/api/health")
async def health():
    pool = get_pool()
    await pool.fetchval("SELECT 1")
    return {"ok": True}


# Mounted last so /api/* is never shadowed by the static catch-all.
app.mount("/", ClientStaticFiles(directory="server/static", html=True), name="client")
