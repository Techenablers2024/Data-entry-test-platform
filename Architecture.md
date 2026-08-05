# Data Entry Test Platform — Architecture

Version: 2.0 (reflects actual implementation)

---

## 1. Overview

A full-stack data entry testing platform. Admins import Excel batches of records; approved users work through them one at a time, with every field validated against expected values. Sessions are device-bound (one active device per user), capped at 4 hours each and 8 hours per day across two sessions.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22 + Gin + GORM |
| Database | PostgreSQL 16 |
| Admin / User Web | React 19 + Vite + Electron (Desktop) |
| Mobile | Expo SDK 57 + React Native 0.86 (TypeScript) |
| UI (Web) | Tailwind CSS 4.3 + Lucide icons |
| UI (Mobile) | NativeWind v4 |
| Auth | JWT (30 min) + device fingerprinting |
| Data Import | Excel (via excelize) |
| Containerisation | Docker + docker-compose |

> **Not in the implementation:** Redis, S3 storage, Kotlin/MVVM Android, Nginx (dev only).

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│  Clients                                            │
│                                                     │
│  Electron Web App          Expo React Native        │
│  (Admin + User portal)     (Android mobile)         │
└──────────────┬──────────────────────┬───────────────┘
               │  HTTP/JSON (JWT)      │
               ▼                      ▼
┌─────────────────────────────────────────────────────┐
│  Go Gin Backend  :8080                              │
│                                                     │
│  middleware: JWT auth · device check · admin role   │
│             rate limiting                           │
│                                                     │
│  handlers: auth · sessions · records · admin ·      │
│            reports                                  │
│                                                     │
│  services: auth · session · data · excel            │
└──────────────────────────┬──────────────────────────┘
                           │ GORM
                           ▼
               ┌───────────────────────┐
               │  PostgreSQL 16        │
               │  (Docker container)   │
               └───────────────────────┘
```

---

## 4. Backend

### 4.1 Directory Structure

```
backend/
├── cmd/server/
│   └── main.go              # Entry point — router, services, middleware wiring
├── internal/
│   ├── config/
│   │   └── config.go        # .env loading
│   ├── db/
│   │   ├── db.go            # GORM init + auto-migrate
│   │   ├── seed.go          # Admin user seeding on first run
│   │   └── migrations/
│   │       ├── 001_initial.sql
│   │       └── 002_validation.sql
│   ├── models/
│   │   ├── user.go
│   │   ├── batch.go
│   │   ├── field_config.go
│   │   ├── data_record.go
│   │   ├── user_session.go
│   │   └── user_submission.go
│   ├── handlers/
│   │   ├── auth_handler.go
│   │   ├── session_handler.go
│   │   ├── data_handler.go
│   │   ├── admin_handler.go
│   │   └── report_handler.go
│   ├── services/
│   │   ├── auth_service.go
│   │   ├── session_service.go
│   │   ├── data_service.go
│   │   └── excel_service.go
│   ├── middleware/
│   │   ├── auth.go          # JWT verification
│   │   ├── device.go        # Device-ID header extraction
│   │   ├── admin.go         # Admin role check
│   │   └── rate_limit.go
│   └── utils/
│       ├── jwt.go
│       ├── response.go      # Uniform JSON response
│       └── json.go
└── scripts/
    └── generate_sample_excel.go
```

### 4.2 Configuration (.env)

```
DB_DSN=host=localhost user=postgres password=secret dbname=dataentry port=5432 sslmode=disable TimeZone=Asia/Kolkata
JWT_SECRET=<long-random-string>
PORT=8080
ADMIN_NAME=Admin
ADMIN_MOBILE=9999999999
ADMIN_PASSWORD=Admin@123
```

### 4.3 REST API

All routes under `/api/v1`.

**Auth (public)**

| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Self-register (status → pending) |
| POST | `/auth/login` | Phone + password → JWT |

**Auth (JWT required)**

| Method | Path | Description |
|---|---|---|
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Current user info |

**Sessions (JWT + device header)**

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/start` | Start session (session_number 1 or 2) |
| GET | `/sessions/active` | Get current active session |
| GET | `/sessions/today` | Today's session summary |
| POST | `/sessions/:id/heartbeat` | Tick elapsed time |

**Records (JWT + device header)**

| Method | Path | Description |
|---|---|---|
| GET | `/records/next` | Fetch next unsubmitted record |
| GET | `/records/:id` | Fetch specific record |
| POST | `/records/:id/submit` | Submit entered values |

**Admin (JWT + admin role)**

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| PUT | `/admin/users/:id/approve` | Approve pending user |
| PUT | `/admin/users/:id/status` | Enable / disable user |
| PUT | `/admin/users/:id/password` | Reset password |
| GET | `/admin/batches` | List batches |
| POST | `/admin/batches` | Upload Excel batch |
| DELETE | `/admin/batches/:id` | Delete batch |
| GET | `/admin/records` | List records (with filter) |
| PUT | `/admin/records/:id/status` | Enable / disable record |
| GET | `/admin/users/:id/sessions` | User session history |

**Reports**

| Method | Path | Description |
|---|---|---|
| GET | `/report/my` | Authenticated user's submission report |
| GET | `/report/admin/users/:id` | Admin: detailed user analytics |

---

## 5. Database Design

### Enums

```
user_status  : pending | active | disabled
field_type   : display | text | number | date | dropdown
record_status: active | disabled
session_status: active | ended | expired
```

### Tables

**users**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | |
| mobile | text UNIQUE | login identifier |
| email | text | optional |
| password_hash | text | bcrypt |
| status | user_status | default pending |
| is_admin | bool | |
| created_at | timestamptz | |
| approved_at | timestamptz | nullable |

**batches**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| filename | text | original upload name |
| uploaded_by | UUID FK → users | |
| record_count | int | |
| uploaded_at | timestamptz | |

**field_configs**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| batch_id | UUID FK → batches | |
| column_key | text | key in record JSONB |
| label | text | display name |
| field_type | field_type | |
| dropdown_options | text[] | for dropdown type |
| sort_order | int | display order |

**data_records**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| global_sequence | int UNIQUE (when active) | assignment order |
| batch_id | UUID FK → batches | |
| values | JSONB | expected field values |
| status | record_status | |

**user_sessions**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| session_number | int | 1 or 2 (max 2/day) |
| session_date | date | |
| device_id | text | locked to first device |
| elapsed_seconds | int | incremented by heartbeat |
| status | session_status | |

**user_submissions**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| data_record_id | UUID FK → data_records | |
| session_id | UUID FK → user_sessions | |
| input_values | JSONB | user-entered values |
| validation | JSONB | per-field correct/wrong |
| accuracy | numeric | correct fields / total fields |
| submitted_at | timestamptz | |

**sequence_counter** — singleton row, `next_val int`, ensures sequential record assignment.

**View: v_user_daily_usage** — per-user per-date totals: sessions used, elapsed_seconds, remaining_seconds.

### ER Diagram

```
users ──< user_sessions
users ──< user_submissions
batches ──< field_configs
batches ──< data_records
data_records ──< user_submissions
user_sessions ──< user_submissions
```

---

## 6. Session & Timer Logic

```
User requests session start
         │
         ▼
  Today's sessions < 2  AND  daily elapsed < 28800s (8 h)?
         │ YES
         ▼
  Create user_session (session_number = 1 or 2, device_id locked)
         │
         ▼
  Client sends heartbeat every N seconds → elapsed_seconds++
         │
         ▼
  elapsed_seconds >= 14400 (4 h)?
  ┌──YES──────────────────────────────────────────────────────┐
  │  session status → expired                                 │
  │  total daily >= 28800 (8 h)?                              │
  │    YES → locked until next calendar day                   │
  │    NO  → user may start session 2                         │
  └───────────────────────────────────────────────────────────┘

Device conflict:
  If a second device hits /sessions/start, the existing session
  is invalidated and a new one is created for the new device.
```

---

## 7. Evaluation Logic

On `POST /records/:id/submit`:

```
For each field_key in field_configs:
    expected = data_record.values[field_key]
    entered  = input_values[field_key]
    matched  = (normalise(entered) == normalise(expected))

accuracy = matched_count / total_fields * 100
```

Results stored in `user_submissions.validation` (JSONB) and `accuracy` column.

---

## 8. Web Application (Electron + React)

### Stack

- React 19 + React Router v7 + TanStack React Query v5
- Vite (bundler) + Electron (desktop wrapper)
- Tailwind CSS 4.3

### Route Map

```
/login                          LoginPage
/signup                         SignupPage
/pending                        PendingApprovalPage
/session                        SessionStartPage      (protected)
/data-entry                     DataEntryPage         (protected)
/admin
  /admin/users                  UsersPage
  /admin/batches                BatchUploadPage
  /admin/records                RecordsPage
  /admin/reports/:id            UserReportPage
/                               → redirect /session
```

### Key Files

```
web/src/
├── context/
│   ├── AuthContext.tsx          JWT + user state (localStorage)
│   └── SessionContext.tsx       Active session state
├── api/
│   ├── client.ts                Axios instance; injects JWT + device_id headers
│   ├── auth.ts / sessions.ts / data.ts / admin.ts
├── components/
│   ├── layout/AppLayout.tsx     Protected wrapper + AppHeader
│   └── session/SessionTimer.tsx Display-only countdown
└── pages/
    ├── DataEntryPage.tsx        Core user flow
    └── admin/                   Admin panel pages
```

---

## 9. Mobile Application (Expo / React Native)

### Stack

- Expo SDK 57 + React Native 0.86 (TypeScript)
- Expo Router (file-based routing)
- NativeWind v4 (Tailwind for RN)
- expo-secure-store (token storage)
- expo-media-library + expo-sharing (screenshots)

### Route Map

```
(auth)/login
(auth)/signup
(app)/index                     Home / dashboard
(app)/data-entry                Data entry screen
(app)/admin                     Admin panel
```

### Key Files

```
mobile/
├── api/          Mirrors web/api: client.ts, auth.ts, sessions.ts, data.ts
├── context/      AuthContext, SessionContext
├── hooks/        useScreenshot.ts
└── lib/
    ├── deviceId.ts   UUID generated + persisted as device fingerprint
    └── storage.ts    expo-secure-store wrapper
```

Mobile API base: `http://10.0.2.2:8080/api/v1` (Android emulator loopback to host).

---

## 10. Infrastructure & Deployment

### docker-compose.yml

```
services:
  postgres:    postgres:16-alpine  → :5432
  backend:     ./backend Dockerfile → :8080   depends_on: postgres (healthy)
```

### Backend Dockerfile (multi-stage)

```dockerfile
FROM golang:1.22-alpine AS builder
  go build -o server ./cmd/server

FROM alpine:3.19
  COPY server + migrations
  EXPOSE 8080
  CMD ["./server"]
```

### Makefile Targets

| Target | Action |
|---|---|
| `dev-backend` | `go run ./cmd/server` |
| `dev-web` | `npm run electron:dev` (web/) |
| `dev-mobile` | `npx expo start --android` (mobile/) |
| `db-up` | `docker compose up postgres -d` |
| `db-down` | `docker compose down` |
| `docker-up` | `docker compose up --build -d` |
| `docker-down` | `docker compose down` |
| `tidy` | `go mod tidy` |
| `build-backend` | `go build ./...` |

---

## 11. Security

- Passwords hashed with bcrypt
- JWT (30 min expiry) carried in `Authorization: Bearer` header
- Device ID sent in custom `X-Device-ID` header; enforced on session and record routes
- Device conflict: new login from a different device expires the previous session
- Admin routes protected by `admin` middleware (role check post-JWT)
- Rate limiting by IP via `rate_limit` middleware
- SQL injection prevention via GORM parameterised queries
- Users self-register but start in `pending` status until an admin approves
