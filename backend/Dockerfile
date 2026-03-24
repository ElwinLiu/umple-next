FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /server ./cmd/server

FROM eclipse-temurin:17-jdk-alpine

ARG GLIBC_VERSION=2.35-r1

RUN apk add --no-cache graphviz python3

# TXL (required for Python code generation) is a glibc binary.
# Install glibc compatibility layer for Alpine.
RUN wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub \
 && wget -q https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VERSION}/glibc-${GLIBC_VERSION}.apk \
 && apk add --no-cache --force-overwrite glibc-${GLIBC_VERSION}.apk \
 && rm glibc-${GLIBC_VERSION}.apk \
 && mkdir -p /lib64 \
 && ln -sf /usr/glibc-compat/lib/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2
WORKDIR /app
COPY --from=builder /server /app/server
RUN mkdir -p /data/models /examples
EXPOSE 3001
CMD ["/app/server"]
