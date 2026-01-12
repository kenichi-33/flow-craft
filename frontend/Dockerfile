# Base stage
FROM node:24-alpine AS base
WORKDIR /app

# Development stage
FROM base AS development
COPY package.json package-lock.json ./
RUN npm ci

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Builder stage
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
# Add custom nginx config if necessary, for now default is okay for static serving
# but usually SPA needs try_files $uri /index.html. 
# We'll use a simple inline replacement or volume mount if needed later.
# For basic usage:
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
