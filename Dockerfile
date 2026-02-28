# Backend only (frontend is on Netlify). Railway uses this when present.
FROM node:20-alpine

WORKDIR /app

# Build deps for better-sqlite3 (native addon); remove after install to keep image small
RUN apk add --no-cache python3 make g++

# Copy backend package files and install dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Optional: remove build deps (saves ~100MB). Uncomment if image size matters.
# RUN apk del python3 make g++

# Copy backend source
COPY backend/ ./

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
