[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# TimeTracker

A full-stack time-tracking web application. Users register, start/stop a live timer, log manual tasks, organise work into nested projects, and view daily/weekly/monthly overviews. Additional features include project sharing (multi-user collaboration), CSV/JSON export, preferred time zones, project budgets, task templates, and a productivity analytics page with an activity heatmap and shared-project contributor breakdown.

**Report:** [`report/report.pdf`](report/report.pdf)

---

## Prerequisites

### To run with Docker (recommended — no local SDK needed)

| Tool | Minimum version | Check |
|------|----------------|-------|
| Docker | 24 | `docker --version` |
| Docker Compose | v2 (bundled with Docker Desktop) | `docker compose version` |

### To run locally (alternative)

| Tool | Minimum version | Check |
|------|----------------|-------|
| Java | 21 | `java -version` |
| Maven | 3.9 (wrapper included) | `./mvnw --version` |
| Node.js | 20 | `node --version` |
| npm | 10 | `npm --version` |

> **Java version manager:** the repo ships `.sdkmanrc` (Java 25 Temurin). If you use [sdkman](https://sdkman.io/), run `sdk env` in the repo root to switch automatically. Java 21+ from any distribution works fine.

---

## Running the Application — from scratch

### Option A — Docker Compose (recommended)

```bash
# 1. Clone and enter the repo
git clone https://github.com/se2p-classrooms/final-project-AliAkbarBaloch.git
cd final-project-AliAkbarBaloch

# 2. Build images and start both services
docker compose up --build
```

Once both services are healthy, open **http://localhost:3000** in your browser, click **Register**, and create your account.

| Service | URL |
|---------|-----|
| Frontend (React SPA) | http://localhost:3000 |
| Backend (REST API) | http://localhost:8080 |
| Health check | http://localhost:8080/api/health |

**JWT secret:** The app always signs and verifies JWT tokens using a secret key. If you do not set `JWT_SECRET`, the app falls back to a hardcoded default (visible in the source code). That default is fine for local development, but it is a security risk in production — anyone who reads the source code knows the secret and could forge tokens to impersonate any user.

| Environment | What to do |
|-------------|-----------|
| Local dev / CI | Do nothing — the built-in default works |
| Production | Set `JWT_SECRET` to a random 32+ character string that only you know |

```bash
# Inline (one-off):
JWT_SECRET=my-strong-secret-at-least-32-chars docker compose up --build

# Or export it first:
export JWT_SECRET=my-strong-secret-at-least-32-chars
docker compose up --build
```

**Fresh start — wipe all data:**

```bash
docker compose down -v   # removes the persistent volume
docker compose up --build
```

After a fresh start, register a new account — all previous users and tasks are gone.

---

### Option B — Local development

```bash
# Terminal 1 — Backend
cd backend
./mvnw spring-boot:run
# Starts on http://localhost:8080 — wait for "Started TimeTrackerApplication"

# Terminal 2 — Frontend
cd frontend
npm install        # first run only
npm run dev
# Starts on http://localhost:3000  (proxies /api/* → :8080 automatically)
```

Open **http://localhost:3000** and register.

**JWT secret:** Same rule as above — skip it for local dev, set it for production:

```bash
export JWT_SECRET=my-strong-secret-at-least-32-chars
cd backend && ./mvnw spring-boot:run
```

**Fresh start — wipe all data:**

```bash
rm -f backend/data/timetracker.mv.db backend/data/timetracker.trace.db
# Then restart the backend — the schema is recreated automatically
```

---

## Running the Test Suite

All commands assume you are in the repository root.

### Backend — unit + integration tests

```bash
cd backend
./mvnw test
```

Expected: **535 tests, 0 failures, 0 errors.**

### Backend — full quality gates (coverage + linter + tests)

```bash
cd backend
./mvnw verify
```

This runs all tests **plus**:
- **JaCoCo** line coverage ≥ 90% (report: `backend/target/site/jacoco/index.html`)
- **Checkstyle** — 0 violations (no-tabs, Java naming conventions, 250-char line limit)

### Backend — mutation testing (PITest)

```bash
cd backend
./mvnw org.pitest:pitest-maven:mutationCoverage
```

Expected: test strength ≥ 80% on `com.timetracker.service.*` classes.
Report: `backend/target/pit-reports/index.html`

### Frontend — unit tests

```bash
cd frontend
npm install   # first run only
npm test
```

Expected: **339 tests, 0 failures.**

### Frontend — unit tests + coverage

```bash
cd frontend
npm run test:coverage
```

Enforces: Lines ≥ 90%, Statements ≥ 90%, Functions ≥ 85%, Branches ≥ 80%.
Report: `frontend/coverage/index.html`

### Frontend — linter

```bash
cd frontend
npm run lint
```

Expected: 0 errors, 0 warnings.

### E2E system tests (Playwright)

The full application stack must be running before starting Playwright tests. The easiest way is Docker Compose:

```bash
# Step 1 — start the stack (in a separate terminal or detached)
docker compose up --build -d

# Step 2 — install Playwright browsers (first run only)
cd frontend
npx playwright install chromium

# Step 3 — run all E2E specs
npx playwright test
```

Or, if you are running locally (not Docker):

```bash
# Start backend and frontend as shown in Option B above, then:
cd frontend
npx playwright test
```

Playwright report (HTML): `frontend/playwright-report/index.html`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21 / Spring Boot 3.4.1 / Spring Security 6 / Spring Data JPA |
| Database | H2 — file-based in dev/Docker, in-memory for tests |
| Frontend | React 19, Vite 6, React Router 7, Axios |
| Auth | Stateless JWT (jjwt 0.12.6) + BCrypt; secret from `JWT_SECRET` env var |
| Backend testing | JUnit 5, Mockito, Spring MockMvc — 535 tests |
| Backend coverage | JaCoCo ≥ 90% line coverage |
| Mutation testing | PITest ≥ 80% test strength (service layer) |
| Frontend testing | Vitest + @testing-library/react — 339 tests, ≥ 90% line coverage |
| Linting | Checkstyle (backend), oxlint (frontend) |
| E2E tests | Playwright 1.61.1 — 31 spec files (Chromium) |
| CI | GitHub Actions — backend, frontend, and Playwright jobs |
