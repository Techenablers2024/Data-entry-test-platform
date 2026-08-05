# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o server ./cmd/server

# Run stage
FROM alpine:3.19
RUN apk add --no-cache tzdata ca-certificates
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/internal/db/migrations ./internal/db/migrations
EXPOSE 8080
CMD ["./server"]
