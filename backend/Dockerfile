# SherlockAI backend: FastAPI + symbolic inference engine.
# Build from the repo root:  docker build -f backend/Dockerfile .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

# NOTE: Docker COPY copies a source dir's CONTENTS (like `cp -r src/. dest`),
# so each package dir needs an explicit dest subdir.
COPY backend/pyproject.toml ./backend/
COPY backend/app ./backend/app/
COPY backend/data ./backend/data
COPY cases ./cases
RUN pip install --no-cache-dir ./backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
