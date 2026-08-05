.PHONY: dev dev-backend dev-web dev-mobile docker-up docker-down

# Start everything locally (3 terminals)
dev-backend:
	cd backend && go run ./cmd/server

dev-web:
	cd web && npm run electron:dev

dev-mobile:
	cd mobile && npx expo start --android

# Docker: start only the database
db-up:
	docker compose up postgres -d

db-down:
	docker compose down

# Docker: start full stack (backend + db)
docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

# Backend utilities
tidy:
	cd backend && go mod tidy

build-backend:
	cd backend && go build ./...
