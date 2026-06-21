# Session relay (WebSocket). Runs the TypeScript entry directly with tsx.
# Build context = repo root (the server imports shared types from src/core).

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY server ./server
COPY src/core ./src/core
EXPOSE 8787
ENV PORT=8787
CMD ["npx", "tsx", "server/index.ts"]
