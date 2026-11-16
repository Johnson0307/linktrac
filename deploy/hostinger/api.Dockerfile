FROM node:24-bookworm-slim
WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

USER node
CMD ["node", "src/server.js"]
