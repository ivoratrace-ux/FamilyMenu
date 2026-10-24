FROM node:24-bookworm-slim AS verified
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend ./backend
COPY src/extra8.js ./src/extra8.js
COPY scripts/catalog-seed.mjs ./scripts/catalog-seed.mjs
RUN npm ci --ignore-scripts && npm test

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=verified --chown=node:node /app/package.json ./
COPY --from=verified --chown=node:node /app/backend/server ./backend/server
COPY --from=verified --chown=node:node /app/src/extra8.js ./src/extra8.js
COPY --from=verified --chown=node:node /app/backend/plan.mjs ./backend/plan.mjs
COPY --from=verified --chown=node:node /app/backend/public ./backend/public
USER node
EXPOSE 8000
CMD ["npm", "start"]
