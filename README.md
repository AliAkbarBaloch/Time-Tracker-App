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

## Running the Application

### Option A — Docker Compose (recommended)

```bash
# Clone and enter the repo
git clone https://github.com/se2p-classrooms/final-project-AliAkbarBaloch.git
cd final-project-AliAkbarBaloch

# Build images and start both services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (React SPA) | http://localhost:3000 |
| Backend (REST API) | http://localhost:8080 |
| Health check | http://localhost:8080/api/health |

Data is persisted in a Docker volume (`timetracker-data`) — it survives container restarts. To start fresh:

```bash
docker compose down -v   # removes the volume
docker compose up --build
```

### Option B — Local development

```bash
# Terminal 1 — Backend
cd backend
./mvnw spring-boot:run
# Starts on http://localhost:8080

# Terminal 2 — Frontend
cd frontend
npm install        # first run only
npm run dev
# Starts on http://localhost:3000  (proxies /api/* → :8080 automatically)
```

---

## Running the Test Suite

All commands assume you are in the repository root.

### Backend — unit + integration tests

```bash
cd backend
./mvnw test
```

Expected: **457 tests, 0 failures, 0 errors.**

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

Expected: **326 tests, 0 failures.**

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

**31 spec files** — one per user story / NFR:

| Spec file | Coverage |
|-----------|----------|
| `us001-registration.spec.ts` | Happy path, duplicate email, empty form, password mismatch, short password |
| `us002-login.spec.ts` | Valid credentials, wrong password, non-existent email, empty form, invalid token |
| `us003-logout.spec.ts` | Logout → /login, localStorage cleared, protected routes redirect |
| `us005-start-timer.spec.ts` | Start shows elapsed timer, live counter, persists after reload |
| `us006-stop-timer.spec.ts` | Stop restores Start button, today-total non-zero, 404 on no active timer |
| `us007-add-task-manually.spec.ts` | Manual task saved, start ≥ end validation |
| `us008-edit-task.spec.ts` | Description change persists, end-before-start alert, non-owner 403/404 |
| `us009-delete-task.spec.ts` | Delete removes task, empty state, non-owner 403/404 |
| `us010-create-project.spec.ts` | Unique project saved, duplicate name error, 100-char name |
| `us011-create-subproject.spec.ts` | Nested under parent, circular parent rejected |
| `us012-edit-delete-project.spec.ts` | Rename, delete warning dialog, non-owner blocked |
| `us013-associate-tasks-projects.spec.ts` | Project chip on task, remove association, own projects only |
| `us014-daily-overview.spec.ts` | Daily total, running task on dashboard |
| `us015-weekly-overview.spec.ts` | 7 day columns, weekly total, prev-week navigation |
| `us016-monthly-overview.spec.ts` | Calendar grid, day cell total, month navigation |
| `us017-project-summary.spec.ts` | Rolled-up total, preset filter, empty project |
| `us018-persistent-timer.spec.ts` | Timer after refresh, topbar on all pages, second context |
| `us019-search-filter-tasks.spec.ts` | Keyword search, date range, AND logic, reset |
| `us020-dashboard-summary.spec.ts` | Today/week totals, running task, top projects |
| `us021-data-persistence.spec.ts` | Data after logout+re-login, hierarchy persists |
| `us022-project-sharing.spec.ts` | Invite member, shared badge, unknown email 404, duplicate 409 |
| `us023-shared-project-overview.spec.ts` | Contributions array, userId filter, non-member 403 |
| `us024-export-project-tasks.spec.ts` | CSV and JSON download, month filter, non-member 403 |
| `us025-time-zones.spec.ts` | Default UTC, PUT updates timezone, invalid IANA 400 |
| `us026-project-budgets.spec.ts` | Budget stored, ON_TRACK/OVER_BUDGET status, progress bar |
| `us027-task-templates.spec.ts` | Create, start-from-template, double-start 409, cross-user isolation |
| `us028-productivity-analytics.spec.ts` | Heatmap cells, weekly pattern 7 bars, year selector, 401 without JWT |
| `nfr001-security.spec.ts` | 401 without JWT, tampered token, cross-user isolation, SQL injection |
| `nfr002-performance.spec.ts` | Dashboard < 1 s, API summary < 1 s |
| `nfr003-usability.spec.ts` | 1-click timer, 2-click task form, topbar on all pages, layout at 1024/1280/1440 px |
| `nfr004-local-deployability.spec.ts` | /api/health 200, SPA routing, H2 console not exposed |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21 / Spring Boot 3.4.1 / Spring Security 6 / Spring Data JPA |
| Database | H2 — file-based in dev/Docker, in-memory for tests |
| Frontend | React 19, Vite 6, React Router 7, Axios |
| Auth | Stateless JWT (jjwt 0.12.6) + BCrypt |
| Backend testing | JUnit 5, Mockito, Spring MockMvc — 457 tests |
| Backend coverage | JaCoCo ≥ 90% line coverage |
| Mutation testing | PITest ≥ 80% test strength (service layer) |
| Frontend testing | Vitest + @testing-library/react — 326 tests, ≥ 90% line coverage |
| Linting | Checkstyle (backend), oxlint (frontend) |
| E2E tests | Playwright 1.61.1 — 31 spec files (Chromium) |
| CI | GitHub Actions — backend, frontend, and Playwright jobs |

---

## Backend Test Classes (457 tests total)

| Test class | Count | What it covers |
|---|---|---|
| `AuthControllerTest` | 10 | Register + login happy paths, duplicate email, wrong password |
| `ChangePasswordTest` | 5 | Change password valid, wrong current, unauthenticated |
| `LogoutAndProtectedRoutesTest` | 6 | JWT-protected endpoints return 401 without token |
| `TaskControllerStartTest` | 6 | Start timer, duplicate timer, authentication |
| `TaskControllerStopTest` | 5 | Stop timer, no active timer, authentication |
| `TaskControllerManualTest` | 6 | Create task, list tasks, validation |
| `TaskControllerEditTest` | 5 | Update task, ownership, validation |
| `TaskControllerDeleteTest` | 5 | Delete task, ownership, authentication |
| `TaskControllerAssociateProjectsTest` | 8 | Create/update task with projects, invalid project ID, project totals |
| `TaskControllerListFilterTest` | 6 | List tasks with/without date-range params, sort order, 401 |
| `TaskControllerSearchFilterTest` | 13 | Keyword search (case-insensitive), project filter (incl. subprojects), combined filters, from-only, to-only, 401 |
| `ProjectControllerTest` | 7 | Create project, duplicate name, list, hierarchy |
| `ProjectControllerSubprojectTest` | 5 | Subproject creation, circular hierarchy guard |
| `ProjectControllerEditDeleteTest` | 11 | Edit project, delete with/without associations, force delete |
| `AuthServiceTest` | 8 | Registration, login, change password (unit) |
| `TaskServiceTest` | 41 | All task service operations, project association, date/keyword/projectId filtering, ArgumentCaptor mutation-kill tests, accumulated-seconds field |
| `ProjectServiceTest` | 24 | All project service operations including member management (unit) |
| `TaskTemplateServiceTest` | 17 | Create/list/update/delete template, startFromTemplate, accumulated previous-session seconds |
| `AnalyticsServiceTest` | 30 | Heatmap grouping by timezone-aware day, weekly-pattern averaging, shared breakdown percentages, future-year zero results, mutation-kill tests |
| `ProjectExportServiceTest` | 16 | CSV columns, JSON structure, subtree recursion, month filter, hierarchy path, running-timer exclusion |
| `UserProfileServiceTest` | 12 | Get/update profile, IANA timezone validation, displayName-only update |
| `ProjectSummaryControllerTest` | 9 | GET /projects/{id}/summary — date range, deduplication, subproject totals, 401/404 |
| `DashboardControllerTest` | 10 | GET /api/dashboard/summary — today/week totals, running task, top projects, cross-user isolation, 401 |
| `DashboardServiceTest` | 11 | Empty state, today/week aggregation, running task, top-5 limit, subtree time, budget verification |
| `SecurityNfrTest` | 33 | BCrypt hash uniqueness, JWT 401 on all endpoints, tampered token, cross-user isolation, Bean Validation 400, SQL injection |
| `DataPersistenceTest` | 11 | Tasks/projects survive logout+re-login, subproject hierarchy, task-project join, cross-user isolation |
| `UsabilityNfrTest` | 16 | Field-level 400 errors, human-readable messages, 1-API-call timer start/stop, active task endpoint |
| `LocalDeployabilityTest` | 15 | Health endpoint, file-based H2, DDL-auto update, H2 console disabled, SPA fallback, docker-compose.yml present |
| `PerformanceNfrTest` | 11 | DB indexes in INFORMATION_SCHEMA, dashboard single-call, N+1-free task lists |
| `ProjectSharingTest` | 17 | Invite, shared=true, unknown email 404, duplicate 409, non-member 404, remove member, owner self-remove 400 |
| `SharedProjectSummaryTest` | 12 | Contributions array, userId filter, non-member 403, combined total correctness |
| `ProjectExportTest` | 14 | CSV/JSON attachment headers, CSV columns, subtree inclusion, month filter, non-member 404 |
| `UserProfileTest` | 13 | GET/PUT profile, timezone validation, displayName-only update, login/register timezone fields |
| `ProjectBudgetTest` | 9 | budgetHours stored, ON_TRACK/WARNING/OVER_BUDGET thresholds, null clears budget |
| `TaskTemplateTest` | 12 | Create, list own, update, delete, start-from-template, 409 if running, cross-user 404, accumulated sessions |
| `AnalyticsControllerTest` | 17 | Heatmap aggregation, weekly pattern, future/past year boundaries, shared-breakdown 401/empty/percentages/scoping |
| `TimeTrackerApplicationTests` | 1 | Application context loads |

---

## Frontend Test Files (326 tests total)

| Test file | Count | What it covers |
|---|---|---|
| `LoginPage.test.jsx` | 17 | Register/login tabs, confirm-password, client-side validation, field-level errors, general banner |
| `DashboardPage.test.jsx` | 31 | Timer start/stop, summary cards, top projects, template list, Start/Running/disabled states, CRUD forms |
| `SettingsPage.test.jsx` | 11 | Timezone selector, updateProfile, success/error messages, change password |
| `dateUtils.test.js` | 22 | formatInZone, toDatetimeLocalInTz, nowInTz, getDateStrInTz, localDateToUtcIso across DST zones |
| `TasksPage.test.jsx` | 38 | Create/edit/delete, project multi-select, field-level errors, filter panel, search debounce, URL param pre-fill |
| `ProjectsPage.test.jsx` | 30 | Create/edit/delete, tree view, force-delete dialog, shared badge, budget bar colour coding |
| `OverviewPage.test.jsx` | 48 | Week view totals/nav/click, month calendar cells/totals/panel/nav |
| `ProjectDetailPage.test.jsx` | 51 | Date presets, subproject totals, members section, contributors card, user-filter, export modal |
| `Layout.test.jsx` | 14 | Topbar timer visible/hidden, elapsed from startTime, timer on all pages |
| `AnalyticsPage.test.jsx` | 20 | Heatmap grid/cells/colours/tooltip, year selector, weekly pattern chart, breakdown section |
