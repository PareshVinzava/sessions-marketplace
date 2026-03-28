# Stage 1: Build
# Node 22 Active LTS on Debian Bookworm slim (NOT alpine — musl causes issues with some native modules)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build-time env vars (VITE_ prefix makes them available in the browser bundle)
ARG VITE_API_BASE_URL=/api
ARG VITE_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

# Install dependencies first (layer caching — only re-runs on package.json change)
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve
# Final image is ~25MB — node_modules never enter production
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
