# Backend only (frontend is on Netlify). Railway uses this when present.
FROM node:20-alpine

WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
