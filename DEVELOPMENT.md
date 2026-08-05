# DataEntry Pro

A data entry testing platform with a desktop app (Electron), mobile app (Android), and Go backend.

---

## Project Structure

```
TypingLearning/
├── backend/          # Go + Gin REST API
├── web/              # Electron + React desktop app
├── mobile/           # Expo React Native Android app
├── docker-compose.yml
└── Makefile
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Go](https://golang.org/dl/) | 1.22+ | Backend API |
| [Node.js](https://nodejs.org/) | 20+ | Web + Mobile toolchain |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Any | PostgreSQL database |
| [Android Studio](https://developer.android.com/studio) | Any | Android emulator (optional — physical phone works too) |

---

## Quick Start (Local Development)

### 1. Start the database

```bash
make db-up
# or directly:
docker compose up postgres -d
```

This starts PostgreSQL on `localhost:5432`.

---

### 2. Configure and start the backend

```bash
cd backend
cp .env.example .env   # only needed the first time
```

The default `.env` values work out of the box with the Docker database:

```env
DB_DSN=host=localhost user=postgres password=secret dbname=dataentry port=5432 sslmode=disable TimeZone=Asia/Kolkata
JWT_SECRET=change-me-to-a-long-random-string
PORT=8080
ADMIN_NAME=Admin
ADMIN_MOBILE=9999999999
ADMIN_PASSWORD=Admin@123
```

Start the server:

```bash
make dev-backend
# or:
cd backend && go run ./cmd/server
```

The API starts on `http://localhost:8080`.  
On first start it runs migrations and seeds the admin user automatically.

---

### 3. Start the desktop app (Electron + React)

```bash
cd web
npm install          # first time only
cp .env.example .env # first time only
npm run electron:dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron window pointing to the Vite server (hot-reload works)

**Default `.env`:**
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

---

### 4. Start the mobile app (Android)

```bash
cd mobile
npm install          # first time only
npx expo start --android
```

- **Physical phone**: Install the [Expo Go](https://expo.dev/go) app and scan the QR code.
- **Emulator**: Press `a` after `npx expo start` to open in the Android emulator.

> **Note:** The mobile app uses `10.0.2.2` as the API host (Android emulator's alias for `localhost`). If using a physical phone on the same Wi-Fi, update `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to your machine's local IP (e.g. `http://192.168.1.5:8080/api/v1`).

---

## All Three Running Together

Open 3 terminals:

```bash
# Terminal 1
make db-up && make dev-backend

# Terminal 2
make dev-web

# Terminal 3
make dev-mobile
```

---

## First Login

**Admin credentials (from `backend/.env`):**
- Mobile: `9999999999`
- Password: `Admin@123`

> Change these in `.env` before deploying to production.

---

## Admin Workflow

1. Log in with admin credentials
2. Go to **Admin Panel → Users** — approve new user signups
3. Go to **Admin Panel → Data Upload** — upload an Excel file

### Excel Upload Format

| Row | Content |
|-----|---------|
| Row 1 | Column display labels |
| Row 2 | Type codes (see below) |
| Row 3+ | Data rows |

**Type codes for Row 2:**

| Code | Description |
|------|-------------|
| `display` | Reference data shown on the left (read-only) |
| `text` | Free-text input |
| `number` | Numeric input |
| `date` | Date picker |
| `dropdown:A\|B\|C` | Dropdown with pipe-separated options |

**Example:**

```
Row 1: Employee Name | Employee ID | Enter Full Name  | Department            | Salary | Join Date
Row 2: display       | display     | text             | dropdown:HR|Finance|IT | number | date
Row 3: John Smith    | EMP-1001    |                  |                       |        |
```

---

## Session Rules

- **2 sessions per day** (calendar day = 12:00 AM – 11:59 PM IST)
- **Max 4 hours per session**, **8 hours total per day**
- Sessions are tracked server-side — UI timer is display-only
- Sessions are device-locked — logging in from a second device shows a conflict warning
- Sessions auto-expire at midnight IST

---

## Available Make Commands

```bash
make db-up          # Start PostgreSQL via Docker
make db-down        # Stop PostgreSQL
make dev-backend    # Run Go backend (hot-reload via go run)
make dev-web        # Run Electron + Vite (hot-reload)
make dev-mobile     # Run Expo Android
make docker-up      # Build and start backend + db via Docker
make docker-down    # Stop Docker stack
make build-backend  # Compile Go binary
make tidy           # Run go mod tidy
```

---

## API Base URL

| Environment | URL |
|-------------|-----|
| Local development | `http://localhost:8080/api/v1` |
| Android emulator | `http://10.0.2.2:8080/api/v1` |
| Physical Android (same Wi-Fi) | `http://<your-local-ip>:8080/api/v1` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22, Gin, GORM, PostgreSQL, excelize, bcrypt, JWT |
| Desktop | Electron, React 19, TypeScript, Vite, Tailwind CSS, React Query |
| Mobile | Expo SDK 57, React Native 0.86, NativeWind v4, expo-router |
| Database | PostgreSQL 16 |
