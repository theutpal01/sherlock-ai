# SherlockAI frontend: Vite build served statically by nginx, with /api
# proxied to the backend service (see nginx.conf next to this file).
# Build from the repo root:  docker build -f frontend/Dockerfile .
FROM node:22-slim AS build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:stable-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
