FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download || true
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /server ./cmd/server

FROM eclipse-temurin:17-jre-alpine
RUN apk add --no-cache graphviz
WORKDIR /app
COPY --from=builder /server /app/server
RUN mkdir -p /data/models /examples
EXPOSE 3001
CMD ["/app/server"]
