[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# TimeTracker

## Project Description

TimeTracker is a full-stack web application that lets individuals — students, freelancers, and researchers — track exactly how much time they spend on projects and activities.

**What it does:**

- **Register and log in** — create a personal account secured with JWT authentication and BCrypt-hashed passwords.
- **Start and stop a live timer** — one click starts a running timer; one click stops it and records the duration. Only one timer can run at a time.
- **Add tasks manually** — log past work by entering a description, start time, and end time directly.
- **Edit and delete tasks** — correct mistakes or remove entries at any time.
- **Organize with projects** — create projects (and nested subprojects) and link any task to one or more projects. Each project automatically tracks its total time, including time from subprojects.
- **Dashboard summary** — the Dashboard shows Today and This Week totals, the currently running task, and the top 5 projects ranked by time this week — all from a single `GET /api/dashboard/summary` call.
- **Weekly overview** — the Overview page shows all seven days of the selected week in a grid, with per-day totals, a week total, and prev/next navigation to browse past or future weeks.
- **Monthly overview** — the Overview page's Month tab shows a full calendar grid of the selected month. Each day cell displays its tracked total; clicking a day opens a panel listing that day's tasks with durations. Prev/next navigation and a monthly total are included.
- **Project time summary** — click any project name to open its detail page. A date-range picker (Today, This Week, This Month, All Time, Custom) filters the aggregation window. The page shows the project's rolled-up total (across the full subproject tree, with deduplication for shared tasks), each direct subproject's individual total, and a sorted task list with durations.
- **Search and filter tasks** — a filter panel above the task list lets you search by description keyword (debounced 300 ms), filter by project (includes all subprojects), and filter by date range. Filters combine with AND logic. A Reset button clears all filters at once.
- **Persistent timer** — a running timer survives page refreshes, tab closes, and browser restarts. On every page load the app calls `GET /api/tasks/active` to recompute elapsed time from `startTime` in the database. No browser storage is used for timer state. A live-updating banner in the top navigation bar shows the running task description and elapsed time on every page.
- **Change password** — update your account password securely at any time from the Settings page.
- **Data persistence** — all tasks, projects, subprojects, and user accounts are stored in a file-based H2 database (`jdbc:h2:file:./data/timetracker`). Data survives browser close, server restart, and logout/re-login. Schema is auto-created by Hibernate DDL-auto on first boot — no manual SQL steps needed.
- **Security** — passwords hashed with BCrypt (cost 10), stateless JWT Bearer auth on every protected endpoint, Bean Validation on all request DTOs, ownership checks prevent cross-user data access, JPA parameterised queries protect against SQL injection.

**What is expected (remaining stories):**

- Export of time data to CSV or PDF

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 (compiled) / Java 25 Temurin (runtime), Spring Boot 3.4.1, Spring Security 6, Spring Data JPA |
| Database | H2 — in-memory for tests, file-based for development (no external database required) |
| Frontend | React 19, Vite 6, React Router 7, Axios |
| Auth | Stateless JWT (jjwt 0.12.6) + BCrypt password hashing |
| Testing (backend) | JUnit 5, Mockito, Spring MockMvc (integration tests hit a real H2 instance) |
| Testing (frontend) | Vitest, @testing-library/react |
| CI | GitHub Actions — lint + unit + integration + system tests, Jacoco line coverage |

---

## Project Structure

```
.
├── backend/                          # Spring Boot Maven project
│   └── src/
│       ├── main/java/com/timetracker/
│       │   ├── config/               # SecurityConfig, CorsConfig, JwtConfig
│       │   ├── controller/           # REST controllers (Auth, Task, Project)
│       │   ├── dto/                  # Request/Response records
│       │   ├── entity/               # JPA entities: User, Project, Task
│       │   ├── exception/            # Custom exceptions + GlobalExceptionHandler
│       │   ├── repository/           # Spring Data JPA repositories
│       │   └── service/              # Business logic (AuthService, TaskService, ProjectService)
│       └── test/java/com/timetracker/
│           ├── controller/           # Integration tests (MockMvc + real H2)
│           └── service/              # Unit tests (Mockito)
└── frontend/                         # React + Vite SPA
    └── src/
        ├── api/                      # authApi.js, taskApi.js, projectApi.js (Axios)
        ├── context/                  # AuthContext (JWT storage + auth state), TimerContext (shared active task state)
        ├── pages/                    # LoginPage, DashboardPage, TasksPage, ProjectsPage, ProjectDetailPage, OverviewPage, SettingsPage
        └── components/               # Layout (topbar + navigation), ProtectedRoute
```

---

## Prerequisites

Make sure the following tools are installed before you begin.

| Tool | Minimum Version | How to check |
|---|---|---|
| Java | 21 | `java -version` |
| Maven | 3.9 | `mvn -version` |
| Node.js | 20 | `node -version` |
| npm | 10 | `npm -version` |
| Git | any | `git --version` |

> **Recommended:** use [sdkman](https://sdkman.io/) to manage Java versions. The repo ships a `.sdkmanrc` file — run `sdk env` inside the repo root to switch to the pinned Java 25 Temurin build automatically.

---

## Step-by-Step Setup and Run Guide

Follow these steps in order. Each step assumes you are starting from a fresh clone.

### Step 1 — Clone the repository

```bash
git clone https://github.com/se2p-classrooms/final-project-AliAkbarBaloch.git
cd final-project-AliAkbarBaloch
```

### Step 2 — (Optional) Set the Java version with sdkman

If you have sdkman installed:

```bash
sdk env
```

This reads `.sdkmanrc` and switches to Java 25.0.3 Temurin automatically. Skip this step if you already have Java 21+ in your `PATH`.

### Step 3 — Install backend dependencies and run backend tests

```bash
cd backend
./mvnw test
```

What this does:
- Downloads all Maven dependencies on first run (may take 1–2 minutes)
- Compiles the source code
- Runs all 232 unit and integration tests against an in-memory H2 database

Expected output at the end:
```
Tests run: 232, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

If you see `BUILD FAILURE`, check that your Java version is 21 or higher (`java -version`).

### Step 4 — Start the backend server

Still inside the `backend/` directory:

```bash
./mvnw spring-boot:run
```

The server starts on **http://localhost:8080**.

You should see a line like:
```
Started TimeTrackerApplication in X.XXX seconds
```

Leave this terminal open. The backend must stay running while you use the app.

> **H2 console** (optional, for inspecting the database):
> Open http://localhost:8080/h2-console in your browser.
> - JDBC URL: `jdbc:h2:file:./data/timetracker`
> - Username: `SA`
> - Password: *(leave blank)*

### Step 5 — Install frontend dependencies

Open a **new terminal** (keep the backend terminal running), then:

```bash
cd frontend
npm install
```

This installs all Node.js packages listed in `package.json` (React, Vite, Axios, testing libraries, etc.). It may take 30–60 seconds on first run.

### Step 6 — Run frontend tests

While still in the `frontend/` directory:

```bash
npx vitest run
```

Expected output:
```
Test Files  10 passed (10)
     Tests  174 passed (174)
```

### Step 7 — Start the frontend dev server

```bash
npm run dev
```

The frontend starts on **http://localhost:3000**.

You should see:
```
  VITE vX.X.X  ready in XXX ms
  ➜  Local:   http://localhost:3000/
```

All `/api/*` requests from the browser are automatically proxied to the backend at port 8080 (configured in `vite.config.js`), so you do not need to configure CORS or separate ports manually.

### Step 8 — Open the app and test it

1. Open **http://localhost:3000** in your browser.
2. Click **Register** and create a new account (email + password + display name).
3. You are logged in automatically. From here you can:
   - Press **Start** on the Dashboard to begin a timer. A live banner with the elapsed time appears in the top navigation bar immediately and stays visible on every page.
   - Press **Stop** to finish the timer. The task appears in the "Today" section immediately. Try refreshing the page while the timer is running — the elapsed time is recomputed from the database and continues from where it left off.
   - Open **Tasks** in the navigation to add tasks manually, edit, or delete them.
   - Open **Projects** to create projects and subprojects, then link tasks to them via the checkbox list in the task form. Click any project name to open its detail page with time totals and a date-range picker.
   - Open **Overview** to see your weekly breakdown. Use the prev/next arrows to navigate weeks.
   - Open **Settings** to change your password.

---

## Running with Docker Compose

If you prefer a containerised setup (no local Java or Node.js required):

```bash
docker compose up --build
```

- Backend: http://localhost:8080
- Frontend: http://localhost:3000

Data is persisted in a Docker volume (`timetracker-data`) across container restarts.

---

## Running Tests

### Backend

```bash
cd backend
./mvnw test
```

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
| `TaskControllerSearchFilterTest` | 10 | Keyword search (case-insensitive), project filter (incl. subprojects), combined filters, 401 |
| `ProjectControllerTest` | 7 | Create project, duplicate name, list, hierarchy |
| `ProjectControllerSubprojectTest` | 5 | Subproject creation, circular hierarchy guard |
| `ProjectControllerEditDeleteTest` | 11 | Edit project, delete with/without associations, force delete |
| `AuthServiceTest` | 8 | Registration, login, change password (unit) |
| `TaskServiceTest` | 32 | All task service operations including project association, date filtering, keyword search, projectId filter (unit) |
| `ProjectServiceTest` | 18 | All project service operations (unit) |
| `ProjectSummaryControllerTest` | 9 | GET /projects/{id}/summary — date range, deduplication, subproject totals, 401/404 |
| `DashboardControllerTest` | 10 | GET /api/dashboard/summary — today/week totals, running task, top projects, cross-user isolation, 401 |
| `DashboardServiceTest` | 9 | Dashboard service unit — empty state, today/week aggregation, running task, top 5 limit, subtree time, user not found |
| `SecurityNfrTest` | 33 | NFR-001 Security: BCrypt hash format/salting, JWT 401 on all protected endpoints, tampered token, public endpoints, cross-user isolation (403/404 for tasks/projects), Bean Validation 400 (blank/invalid fields), SQL injection inputs handled safely |
| `DataPersistenceTest` | 11 | US-021 Data Persistence: tasks/projects survive logout+re-login, running timer accessible after re-auth, subproject hierarchy persists, task-project join persists, multi-task retrieval, cross-user isolation after re-login, schema auto-created on first boot |

### Frontend

```bash
cd frontend
npx vitest run
```

| Test file | Count | What it covers |
|---|---|---|
| `LoginPage.test.jsx` | 5 | Register, login, tabs, error states |
| `DashboardPage.test.jsx` | 19 | Timer start/stop, active task display, summary cards (today/week), top projects list, running task info, refresh after timer actions |
| `SettingsPage.test.jsx` | 3 | Change password form, error display |
| `TasksPage.test.jsx` | 27 | Create, edit, delete tasks; project multi-select on create/edit; project display in task row |
| `ProjectsPage.test.jsx` | 18 | Create, edit, delete projects; tree view; collapse; force delete dialog |
| `OverviewPage.test.jsx` | 48 | Week view (day/week totals, nav, task grouping, click); month view (calendar cells, day totals, month total, selected-day panel, nav, loading) |
| `ProjectDetailPage.test.jsx` | 27 | Date-range presets, custom range form, project name/desc/total, subproject totals, task list, running task, error states, back navigation |
| `Layout.test.jsx` | 14 | Topbar timer visible/hidden, elapsed from startTime, timer on all pages, API called once on mount |
| `TasksPage.test.jsx (filter)` | 10 | Filter panel rendered, search debounce, project filter, date range, no-results message, reset |

---

## API Reference

All endpoints except `/api/auth/register` and `/api/auth/login` require the header:

```
Authorization: Bearer <your-JWT-token>
```

### Dashboard

| Method | Path | Response | Notes |
|---|---|---|---|
| GET | `/api/dashboard/summary` | 200 `DashboardSummaryResponse` | Single call returning today/week totals, running task, and top 5 projects by week time |

Dashboard summary response shape:
```json
{
  "todaySeconds": 3600,
  "weekSeconds": 14400,
  "runningTask": { "id": 5, "description": "Study", "startTime": "...", "endTime": null, "running": true, "projects": [] },
  "topProjects": [
    { "id": 2, "name": "Thesis", "weekSeconds": 10800 },
    { "id": 3, "name": "Side Project", "weekSeconds": 3600 }
  ]
}
```

### Auth

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName}` | 201 | Creates account; returns JWT |
| POST | `/api/auth/login` | `{email, password}` | 200 `{token}` | Returns JWT |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` | 204 | — |

### Tasks

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/tasks` | — | 200 `Task[]` | Optional: `?from=<ISO>&to=<ISO>` (date range), `?search=<text>` (description contains), `?projectId=<id>` (project + subtree) |
| GET | `/api/tasks/active` | — | 200 or 204 | 204 = no active timer |
| POST | `/api/tasks/start` | `{description?}` | 201 | Returns the new running task |
| POST | `/api/tasks/stop` | — | 200 | Returns the stopped task |
| POST | `/api/tasks` | `{description?, startTime, endTime, projectIds?}` | 201 | Manual task |
| PUT | `/api/tasks/{id}` | `{description?, startTime, endTime, projectIds?}` | 200 | Edit task |
| DELETE | `/api/tasks/{id}` | — | 204 | — |

Task response shape:
```json
{
  "id": 1,
  "description": "Study session",
  "startTime": "2026-06-30T10:00:00Z",
  "endTime": "2026-06-30T11:00:00Z",
  "running": false,
  "projects": [{"id": 2, "name": "Thesis"}]
}
```

### Projects

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/projects` | — | 200 `Project[]` | Returns root projects with nested subprojects |
| POST | `/api/projects` | `{name, description?, parentProjectId?}` | 201 | Creates project or subproject |
| PUT | `/api/projects/{id}` | `{name, description?}` | 200 | Rename / re-describe |
| DELETE | `/api/projects/{id}` | — | 204 or 409 | 409 if associations exist; add `?force=true` to override |
| GET | `/api/projects/{id}/summary` | — | 200 `ProjectSummaryResponse` | Add `?from=<ISO>&to=<ISO>` to filter by date range |

Project response shape:
```json
{
  "id": 5,
  "name": "Thesis",
  "description": "My master's thesis",
  "parentId": null,
  "subprojects": [
    {"id": 6, "name": "Literature Review", "subprojects": [], "totalSeconds": 3600, "createdAt": "..."}
  ],
  "totalSeconds": 7200,
  "createdAt": "2026-06-01T09:00:00Z"
}
```

---

## Key Design Decisions

- **Stateless JWT auth** — no server-side sessions; the token lives in `localStorage` and is sent as a Bearer header on every request.
- **H2 file-based DB in dev** — data persists across restarts with zero external setup. The `test` profile switches to an in-memory H2 instance that is wiped between test classes.
- **`@ManyToMany` task–project join table** (`task_projects`) — tasks can belong to multiple projects. Cascades are handled manually (e.g. clearing the join before delete) to avoid FK violations.
- **Recursive `totalSeconds` with deduplication** — if a task is linked to both a parent and child project, its duration is counted only once toward the parent's total using a `Set<Long>` of seen task IDs passed down the recursion.
- **Force-delete pattern** — deleting a project with associations returns 409 with counts. The frontend shows a confirmation dialog; confirming calls `DELETE ?force=true` which disassociates tasks and recursively removes subprojects.
- **Date-range filtering on task list** — `GET /api/tasks?from=<ISO>&to=<ISO>` reuses the existing `findByUserAndStartTimeBetweenOrderByStartTimeAsc` repository method. Daily and weekly views both call this same endpoint with appropriate bounds.
- **Security NFR** — BCrypt cost-10 hashing means each password hash is unique even for identical passwords (random salt per hash). JWT tokens use HMAC-SHA256 with a 256-bit+ secret and expire after 24 hours. CSRF is disabled intentionally because the API is stateless (no session cookies) — disabling it for a JWT/Bearer API is the correct and secure approach per Spring Security documentation.
