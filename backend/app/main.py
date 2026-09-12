"""FastAPI entrypoint: authoritative session/investigation state (spec section 4).

Inference logic itself lives in app.ai and is never imported into React.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

from .api.cases import router as cases_router
from .api.sessions import router as sessions_router
from .db.database import init_db


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
