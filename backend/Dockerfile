FROM node:22-alpine AS base

# Development
FROM base AS development
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# Builder
FROM base AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS production
WORKDIR /usr/src/app
ENV NODE_ENV production

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

USER node

EXPOSE 8080
CMD ["node", "dist/main"]
