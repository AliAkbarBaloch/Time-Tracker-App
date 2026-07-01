[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# TimeTracker

A full-stack time tracking web application for individuals (students, freelancers, researchers) to track time spent on projects, lectures, and activities.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 (compiled) / Java 25 Temurin (runtime), Spring Boot 3.4.1, Spring Security 6, Spring Data JPA |
| Database | H2 (in-memory for tests, file-based for dev) — no external DB required |
| Frontend | React 19, Vite 6, React Router 7, Axios |
| Auth | Stateless JWT (jjwt 0.12.6) + BCrypt password hashing |
| Testing (backend) | JUnit 5, Mockito, Spring MockMvc |
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
        ├── context/                  # AuthContext (JWT storage + auth state)
        ├── pages/                    # LoginPage, DashboardPage, TasksPage, ProjectsPage, SettingsPage
        └── components/               # Layout (topbar + navigation), ProtectedRoute
```

---

## Implemented User Stories

| # | Story | Status |
|---|---|---|
| US-001 | User Registration | Done |
| US-002 | User Login | Done |
| US-003 | User Logout | Done |
| US-004 | Change Password | Done |
| US-005 | Start Timer | Done |
| US-006 | Stop Timer | Done |
| US-007 | Add a Task Manually | Done |
| US-008 | Edit a Task | Done |
| US-009 | Delete a Task | Done |
| US-010 | Create a Project | Done |
| US-011 | Create a Subproject (Project Hierarchy) | Done |
| US-012 | Edit and Delete a Project | Done |
| US-013 | Associate Tasks with Projects | Done |
| US-014 | View Daily Task Overview (Dashboard) | Done |
| US-015 | View Weekly Task Overview | Done |

### What each story delivers

**US-001 – User Registration**  
`POST /api/auth/register` — accepts email, password, displayName. Validates uniqueness. Password stored as BCrypt hash. Returns 201 Created.

**US-002 – User Login**  
`POST /api/auth/login` — validates credentials, returns a signed JWT valid for 24 hours.

**US-003 – User Logout**  
Frontend clears the JWT from localStorage. All protected API endpoints require `Authorization: Bearer <token>`.

**US-004 – Change Password**  
`POST /api/auth/change-password` — verifies current password, sets new BCrypt hash. Returns 204 No Content.

**US-005 – Start Timer**  
`POST /api/tasks/start` — starts a running task (no end time). Only one timer can run at a time; returns 409 if one is already active.

**US-006 – Stop Timer**  
`POST /api/tasks/stop` — sets `endTime = now` on the running task. Returns 404 if no timer is active.

**US-007 – Add a Task Manually**  
`POST /api/tasks` — creates a completed task with explicit `startTime`, `endTime`, optional description, and optional `projectIds`.

**US-008 – Edit a Task**  
`PUT /api/tasks/{id}` — updates description, start/end times, and project associations. Returns 403 if the task belongs to another user.

**US-009 – Delete a Task**  
`DELETE /api/tasks/{id}` — permanently removes the task. Clears join-table entries first to avoid FK violations.

**US-010 – Create a Project**  
`POST /api/projects` — creates a project with name (unique per user, case-insensitive) and optional description.

**US-011 – Create a Subproject (Project Hierarchy)**  
`POST /api/projects` with `parentProjectId` — creates a child project. `GET /api/projects` returns the full tree with recursive `totalSeconds` (deduplicating tasks counted in multiple projects).

**US-012 – Edit and Delete a Project**  
`PUT /api/projects/{id}` — rename/re-describe a project.  
`DELETE /api/projects/{id}` — if the project has tasks or subprojects, returns 409 with counts. Pass `?force=true` to disassociate all tasks and recursively delete subprojects.

**US-013 – Associate Tasks with Projects**  
Create and edit forms show a tree-indented multi-select checkbox list of the user's projects. Selecting a project on create (`POST /api/tasks`) or update (`PUT /api/tasks/{id}`) stores associations in the `task_projects` join table. `GET /api/tasks` now returns `projects: [{id, name}]` in each task response. Project `totalSeconds` updates immediately when associations change.

**US-014 – View Daily Task Overview (Dashboard)**  
The Dashboard now shows a "Today" section below the timer. It calls `GET /api/tasks?from=<midnight>&to=<next-midnight>` to fetch only today's tasks. Each task row shows its description, start time, duration, and associated projects. A live daily total (HH:MM:SS) updates every second while a task is running. The task list refreshes automatically after starting or stopping a timer.  
Backend: `GET /api/tasks` gained optional `from`/`to` ISO-8601 query params; the service dispatches to `findByUserAndStartTimeBetweenOrderByStartTimeAsc` when both are present.

**US-015 – View Weekly Task Overview**  
The Overview page shows the current week (Monday–Sunday) as a 7-column grid. Each column displays the day name, date, per-day total, and a list of tasks for that day. A "Week Total" footer sums all days. Prev/Next buttons navigate between weeks by re-fetching from the same `GET /api/tasks?from=&to=` endpoint. Tasks are attributed to a day by the local date of their `startTime`. Clicking any task navigates to the Tasks page. The Month tab shows a placeholder for the upcoming monthly view.

---

## Prerequisites

| Tool | Version |
|---|---|
| Java | 21 or 25 (Temurin recommended) |
| Maven | 3.9+ (or use the `./mvnw` wrapper) |
| Node.js | 20+ |
| npm | 10+ |

> **sdkman users**: the repo has a `.sdkmanrc` file at the root — run `sdk env` inside the repo to switch to the pinned Java version automatically.

---

## Running Locally (Development)

### 1. Clone the repository

```bash
git clone <repo-url>
cd final-project-AliAkbarBaloch
```

### 2. Start the backend

```bash
cd backend
./mvnw spring-boot:run
```

The backend starts on **http://localhost:8080**.

- H2 console: http://localhost:8080/h2-console  
  JDBC URL: `jdbc:h2:file:./data/timetracker`, username `SA`, no password

> If your shell's default Java is not 21+, set it explicitly:
> ```bash
> JAVA_HOME="$(/usr/libexec/java_home -v 21)" ./mvnw spring-boot:run
> ```
> Or with sdkman: `sdk use java 25.0.3-tem && ./mvnw spring-boot:run`

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:3000**.  
All `/api/*` requests are proxied to the backend at port 8080 (configured in `vite.config.js`).

### 4. Open the app

Navigate to **http://localhost:3000** in your browser. Register a new account and start tracking time.

---

## Running with Docker Compose (recommended for production-like setup)

```bash
docker compose up --build
# Backend:  http://localhost:8080
# Frontend: http://localhost:3000
```

Data is persisted in a Docker volume (`timetracker-data`) across container restarts.

---

## Running Tests

### Backend tests

```bash
cd backend
./mvnw test
```

This runs all unit tests (Mockito) and integration tests (MockMvc + in-memory H2 with `@ActiveProfiles("test")`).

Expected output:
```
Tests run: 139, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

> With sdkman: `source ~/.sdkman/bin/sdkman-init.sh && sdk use java 25.0.3-tem && ./mvnw test`

**Test structure:**

| File | Tests | What it covers |
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
| `ProjectControllerTest` | 7 | Create project, duplicate name, list, hierarchy |
| `ProjectControllerSubprojectTest` | 5 | Subproject creation, circular hierarchy guard |
| `ProjectControllerEditDeleteTest` | 11 | Edit project, delete with/without associations, force delete |
| `AuthServiceTest` | 8 | Registration, login, change password (unit) |
| `TaskServiceTest` | 27 | All task service operations including project association and date filtering (unit) |
| `ProjectServiceTest` | 18 | All project service operations (unit) |

### Frontend tests

```bash
cd frontend
npm test
# or to run once without watch mode:
npx vitest run
```

Expected output:
```
Tests  100 passed (100)
```

**Test structure:**

| File | Tests | What it covers |
|---|---|---|
| `LoginPage.test.jsx` | 5 | Register, login, tabs, error states |
| `DashboardPage.test.jsx` | 16 | Timer start/stop, active task display, today section, daily total, running task highlight |
| `SettingsPage.test.jsx` | 3 | Change password form, error display |
| `TasksPage.test.jsx` | 27 | Create, edit, delete tasks; project multi-select on create/edit; project display in task row |
| `ProjectsPage.test.jsx` | 18 | Create, edit, delete projects; tree view; collapse; force delete dialog |
| `OverviewPage.test.jsx` | 26 | Week view columns, day/week totals, prev/next navigation, task grouping by day, task click, month placeholder |

---

## API Reference

All endpoints (except register and login) require `Authorization: Bearer <JWT>`.

### Auth

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName}` | 201 | Create account |
| POST | `/api/auth/login` | `{email, password}` | 200 `{token}` | Get JWT |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` | 204 | Change password |

### Tasks

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| GET | `/api/tasks` | — | 200 `Task[]` | List tasks (add `?from=<ISO>&to=<ISO>` for date-range filter) |
| POST | `/api/tasks/start` | `{description?}` | 201 | Start a running timer |
| POST | `/api/tasks/stop` | — | 200 | Stop the running timer |
| GET | `/api/tasks/active` | — | 200 or 204 | Get the active timer |
| POST | `/api/tasks` | `{description?, startTime, endTime, projectIds?}` | 201 | Add task manually |
| PUT | `/api/tasks/{id}` | `{description?, startTime, endTime, projectIds?}` | 200 | Edit task |
| DELETE | `/api/tasks/{id}` | — | 204 | Delete task |

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

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| GET | `/api/projects` | — | 200 `Project[]` | List root projects (with nested subprojects) |
| POST | `/api/projects` | `{name, description?, parentProjectId?}` | 201 | Create project |
| PUT | `/api/projects/{id}` | `{name, description?}` | 200 | Edit project |
| DELETE | `/api/projects/{id}?force=false` | — | 204 or 409 | Delete project; 409 if associations exist |

Project response shape:
```json
{
  "id": 5,
  "name": "Thesis",
  "description": "My master's thesis",
  "parentId": null,
  "subprojects": [
    {"id": 6, "name": "Literature Review", "subprojects": [], "totalSeconds": 3600, ...}
  ],
  "totalSeconds": 7200,
  "createdAt": "2026-06-01T09:00:00Z"
}
```

---

## Key Design Decisions

- **Stateless JWT auth** — no server-side sessions; the token is stored in `localStorage` and sent as a Bearer header on every request.
- **H2 file-based DB in dev** — data persists across restarts without any setup. The `test` profile uses an in-memory H2 instance that is wiped between test classes via `@BeforeEach` repository clears.
- **`@ManyToMany` task–project join table** (`task_projects`) — tasks can belong to multiple projects. Cascades are handled manually (e.g., `task.getProjects().clear()` before delete) to avoid FK violations.
- **Recursive `totalSeconds` with deduplication** — when a task is associated with both a parent and child project, its duration is counted only once toward the parent's total using a `Set<Long>` of seen task IDs passed down the recursion.
- **Force-delete pattern** — deleting a project with associations returns 409 + counts. The frontend shows a warning dialog; the user confirms to call `DELETE ?force=true` which disassociates tasks and removes subprojects.
- **Project tree in task form** — the project selector uses a flattened traversal of the project tree with depth-based indentation, rendered as checkboxes. Multi-select allows a task to be linked to multiple projects simultaneously.
