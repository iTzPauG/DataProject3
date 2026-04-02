# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-bullseye AS builder

WORKDIR /app

# Install dependencies first (copy lockfile too for better cache invalidation)
COPY main/frontend/package.json main/frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source
COPY main/frontend/ .

# Railway passes Variables as ARGs during build if configured.
# We declare them here.
ARG EXPO_PUBLIC_BACKEND_URL
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY

# We also check if they are already available as ENV (some builders do this)
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL} \
    EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL} \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY} \
    NODE_ENV=production \
    CI=1

# Debug and create .env
RUN echo "=== GADO BUILD DEBUG ===" && \
    echo "Checking Variables..." && \
    # Logic to fix missing https://
    FINAL_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL && \
    if [ -n "$FINAL_BACKEND_URL" ] && ! echo "$FINAL_BACKEND_URL" | grep -q "://"; then \
        FINAL_BACKEND_URL="https://$FINAL_BACKEND_URL"; \
    fi && \
    # Create the .env file regardless, to avoid Metro errors
    echo "EXPO_PUBLIC_BACKEND_URL=$FINAL_BACKEND_URL" > .env && \
    echo "EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL" >> .env && \
    echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY" >> .env && \
    echo "Build environment prepared." && \
    # Only fail if SUPABASE_URL is truly missing (critical)
    if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then \
        echo "FATAL: EXPO_PUBLIC_SUPABASE_URL is missing."; \
        exit 1; \
    fi && \
    npx expo export --platform web

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY main/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
