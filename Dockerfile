# syntax=docker/dockerfile:1.7
FROM docker.io/library/node:22-alpine AS runner
RUN apk add --no-cache bubblewrap

WORKDIR /app/src/ideNew

COPY LICENSE NOTICE THIRD_PARTY_NOTICES.md /app/
COPY licenses /app/licenses


ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_PROGRESS=false
ENV NPM_CONFIG_PREFER_OFFLINE=true
ENV NPM_CONFIG_FETCH_RETRIES=10
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=30000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=300000
ENV NPM_CONFIG_FETCH_TIMEOUT=1800000

COPY .docker-build/ideNew/src/packages/shared /app/src/packages/shared
COPY .docker-build/ideNew/package.json ./
COPY .docker-build/ideNew/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
RUN mkdir -p /app/src \
    && ln -s /app/src/ideNew/node_modules /app/src/node_modules

COPY .docker-build/ideNew/.next ./.next
COPY .docker-build/ideNew/public ./public
COPY .docker-build/ideNew/next.config.mjs ./next.config.mjs

ENV PORT=3000

RUN chown -R node:node /app/src/ideNew

USER node

CMD ["npm", "run", "start"]
