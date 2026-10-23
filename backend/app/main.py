"""FastAPI entrypoint: authoritative session/investigation state (spec section 4).

Inference logic itself lives in app.ai and is never imported into React.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from .api.cases import router as cases_router
from .api.sessions import router as sessions_router
from .db.database import get_engine, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="SherlockAI API", version="0.1.0", lifespan=lifespan)
app.include_router(cases_router)
app.include_router(sessions_router)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="sherlock-ai-backend", version="0.1.0")


@app.get("/ready", response_model=HealthResponse)
def readiness() -> HealthResponse:
    """Readiness check used by Compose after the database has been initialized."""
    try:
        engine = get_engine()
        with engine.connect() as connection:
            if not inspect(connection).has_table("sessions"):
                raise RuntimeError("sessions table is missing")
            connection.execute(text("SELECT 1"))
    except (SQLAlchemyError, RuntimeError) as exc:
        logger.exception("Database readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return HealthResponse(status="ready", service="sherlock-ai-backend", version="0.1.0")
