FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY index.html ./
COPY vite.config.* ./
COPY public ./public
COPY src ./src
ENV VITE_API_URL=/api
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
