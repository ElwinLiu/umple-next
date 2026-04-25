FROM oven/bun:1.2.21-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:1.29.6-alpine
ARG APK_SECURITY_REFRESH
RUN echo "Refreshing Alpine packages at ${APK_SECURITY_REFRESH}" && apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
