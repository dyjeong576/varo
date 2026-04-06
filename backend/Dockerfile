FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json ./
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
COPY backend/prisma ./prisma
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
CMD ["npm", "run", "start"]
