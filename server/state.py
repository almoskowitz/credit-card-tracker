"""GET/PUT /api/state -- single-row optimistic-concurrency state store.

See openspec/changes/rebuild-v3/specs/state-service/spec.md and design.md §3.
updatedAt is an opaque ISO-8601 string end to end: serialized once from the column and
never parsed, reformatted, or compared with an inequality.
"""
import json
from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from .db import get_pool

router = APIRouter(prefix="/api")

STATE_KEY = "card-tracker"

SELECT_SQL = "SELECT value, updated_at FROM app_state WHERE key = $1"

# $1::text::timestamptz (not a bare ::timestamptz): asyncpg infers each parameter's wire
# type from how it's used in the query, and a direct ::timestamptz cast makes it demand a
# native datetime object. Routing through ::text first keeps $1 a plain string end to end
# on the Python side -- Postgres alone parses it, against the same column it came from, so
# the equality is exact.
UPDATE_SQL = """
UPDATE app_state
   SET value = $2::jsonb, updated_at = now()
 WHERE key = $3
   AND updated_at = $1::text::timestamptz
RETURNING updated_at
"""

INSERT_SQL = """
INSERT INTO app_state (key, value)
VALUES ($1, $2::jsonb)
ON CONFLICT (key) DO NOTHING
RETURNING updated_at
"""


class StatePut(BaseModel):
    updatedAt: str | None
    state: dict[str, Any]


def _iso(dt) -> str:
    return dt.isoformat()


async def _current() -> dict[str, Any]:
    pool = get_pool()
    row = await pool.fetchrow(SELECT_SQL, STATE_KEY)
    if row is None:
        return {"updatedAt": None, "state": None}
    return {"updatedAt": _iso(row["updated_at"]), "state": json.loads(row["value"])}


@router.get("/state")
async def get_state():
    return await _current()


@router.put("/state")
async def put_state(body: StatePut, response: Response):
    pool = get_pool()
    payload = json.dumps(body.state)

    if body.updatedAt is not None:
        row = await pool.fetchrow(UPDATE_SQL, body.updatedAt, payload, STATE_KEY)
        if row is not None:
            return {"updatedAt": _iso(row["updated_at"])}
        response.status_code = 409
        return await _current()

    row = await pool.fetchrow(INSERT_SQL, STATE_KEY, payload)
    if row is not None:
        return {"updatedAt": _iso(row["updated_at"])}
    response.status_code = 409
    return await _current()
