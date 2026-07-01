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
- **Usability** — start/stop timer in one click from the Dashboard, add task/project in ≤ 2 clicks, running timer always visible in the top navigation bar on every page, field-level validation errors shown inline under the relevant input (not concatenated into a single banner), responsive layout at ≥ 1024 px.
- **Local deployability** — the entire stack (backend + frontend + database) starts with a single `docker compose up --build` command; no cloud accounts, no external databases, and no manual setup beyond Docker. The `GET /api/health` endpoint allows Docker Compose to health-check the backend. SPA routing (direct-link refreshes, bookmarks) works correctly — the backend serves `static/index.html` for all non-API client-side routes so React Router can take over. The H2 console is disabled by default and can be enabled temporarily with `-Dspring.h2.console.enabled=true` if needed for database inspection.
- **Performance** — dashboard summary data is fetched in a single aggregated `GET /api/dashboard/summary` call (no waterfall). Task lists include embedded project data in the same response body — no follow-up calls needed. Database indexes on `tasks(user_id, start_time)`, `tasks(user_id, end_time)`, and `projects(user_id, parent_project_id)` cover the hot query paths. All task-fetching repository methods use `LEFT JOIN FETCH t.projects` to eliminate the N+1 query problem when loading task–project associations.
- **Project sharing** — project owners can invite registered users by email (`POST /api/projects/{id}/members`). Invitees see the shared project immediately in their project list with a "👥 Shared" badge. Members can associate their own tasks with shared projects. The project detail page shows all members with their roles (OWNER/MEMBER) and an invite form for the owner. Only the owner can edit, delete, or manage membership. Time aggregation in the project summary automatically includes tasks from all members. The `project_members` table is back-filled on startup for pre-existing projects via `MembershipSeeder`.
- **Task overview for shared projects** — the project summary response now includes a `contributions` array showing each member's total seconds. Each task entry carries `userId`/`userName` so the frontend can attribute work to its owner. An optional `?userId={id}` query param on both `GET /api/projects/{id}/summary` and `GET /api/tasks` filters results to a single member (both caller and target must be project members; non-member userId returns 403). The project detail page shows a "Contributors" card and a user-filter dropdown for shared projects; task rows display the owner's display name when the project is shared.
- **Export project tasks** — an "Export" button on the project detail page opens a modal where you choose the file format (CSV or JSON) and optionally restrict the export to a specific calendar month. Clicking "Download" calls `GET /api/projects/{id}/export?format=csv|json` and triggers a browser file download via a Blob URL (the JWT is never embedded in the URL). Tasks are collected recursively from the full project subtree so sub-project activity is always included. The CSV columns are `task_id, description, start_time, end_time, duration_seconds, projects, user`; the `projects` column shows the full hierarchy path (e.g. `"Thesis > Literature Review"`). The JSON response wraps the task array in `{ "project": "...", "exportedAt": "...", "tasks": [...] }`. Non-members receive 404. Both `?from/to` ISO params and `?year/month` convenience params are supported for date filtering.
- **User preferred time zone** — every user has a `timezone` field (default `"UTC"`) stored in the database. The timezone is returned in both the register and login responses, stored in `AuthContext`, and persisted in `localStorage`. A new "Preferred Time Zone" section in the Settings page lets users choose from a curated list of common IANA timezone identifiers and saves the choice via `PUT /api/users/profile`. All task times throughout the app (task list, project detail, weekly/monthly overview, new-task form defaults) are displayed in the user's preferred timezone using the browser's built-in `Intl.DateTimeFormat` API — no external libraries needed. Stored times remain UTC at all times; only the display layer changes. `GET /api/users/profile` returns the full user profile including `timezone`; `PUT /api/users/profile` validates the timezone string with `ZoneId.of()` and returns HTTP 400 with an informative message if the value is not a valid IANA identifier.
- **Task templates** — users can save frequently-used task configurations as templates (name, optional description, optional project associations). A "Task Templates" section on the Dashboard shows all personal templates as cards with a name, description preview, and project chips. Clicking **▶ Start** on a template creates a running task pre-filled with the template's description and project associations — the topbar timer appears immediately. Templates can be created via a "New Template" form (with project multi-select), edited inline (pencil button), and deleted (with a confirmation dialog). Templates are strictly private — users can only access their own. `POST /api/task-templates/{id}/start` returns 409 if a timer is already running. All CRUD operations are available via `GET/POST /api/task-templates` and `PUT/DELETE /api/task-templates/{id}`.
- **Productivity analytics** — a dedicated "Analytics" page (accessible from the top navigation) shows two visualisations derived from the user's tracked history. The **Activity Heatmap** renders a GitHub-style 52–53-week grid (7 rows × N columns, Monday-first). Each cell represents one calendar day and is colour-coded in four levels based on the day's share of the year's maximum: grey (#ebedf0) for zero, light green (#9be9a8) for < 25 %, medium green (#40c463) for 25–50 %, dark green (#30a14e) for 50–75 %, and darkest green (#216e39) at the top tier. Hovering a cell shows a tooltip with the date and formatted duration. A year selector at the top-right lets users browse any year (± 3 from current). Day boundaries are calculated in the user's preferred timezone (integrated with US-025). The **Day-of-Week Pattern** bar chart shows the average tracked seconds per weekday (MON–SUN) over the last 12 weeks. Bar heights are proportional to the day with the most average time; each bar shows the formatted average below it. Only completed tasks (tasks with both `startTime` and `endTime`) are included in both visualisations; running timers are excluded. Data is always scoped to the authenticated user. API: `GET /api/analytics/heatmap?year=<int>` and `GET /api/analytics/weekly-pattern?weeks=<int>` (defaults: current year, 12 weeks).
- **Project time budgets** — each project can optionally have a `budgetHours` value (a positive decimal, e.g. `40.0`) set at create or edit time. When a budget is set, the project detail page and the projects list both display a colour-coded progress bar: green (ON_TRACK, < 80% used), orange (WARNING, 80–99% used), and red (OVER_BUDGET, ≥ 100% used) with an "Over budget" badge. The Dashboard's top-projects list also shows the budget bar and used/total hour labels. Budget tracking aggregates all-time hours across the full project subtree and all members (not just the current user). The `budgetStatus` field (`ON_TRACK`, `WARNING`, or `OVER_BUDGET`) and `budgetPercent` are computed server-side and included in both `ProjectSummaryResponse` and the dashboard's `TopProject` entries. A null budget means no restriction is enforced.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 (compiled) / Java 25 Temurin (runtime), Spring Boot 3.4.1, Spring Security 6, Spring Data JPA |
| Database | H2 — in-memory for tests, file-based for development (no external database required) |
| Frontend | React 19, Vite 6, React Router 7, Axios |
| Auth | Stateless JWT (jjwt 0.12.6) + BCrypt password hashing |
| Testing (backend) | JUnit 5, Mockito, Spring MockMvc (integration tests hit a real H2 instance) |
| Linting (backend) | Checkstyle 3.6.0 — no-tabs, Java naming conventions, max 250 chars/line, runs on `mvn verify` |
| Coverage (backend) | JaCoCo 0.8.12 — 90% line coverage enforced on `mvn verify` |
| Mutation testing | PITest 1.17.1 + pitest-junit5-plugin 1.2.1 — 80% test-strength threshold (service unit tests) |
| Testing (frontend) | Vitest, @testing-library/react, @vitest/coverage-v8 — 90% line/statement coverage enforced |
| Linting (frontend) | oxlint (React + oxc plugins) — runs on every CI push |
| System tests | Playwright 1.49 (TypeScript) — E2E tests per user story against the full docker-compose stack |
| CI | GitHub Actions — lint + unit + integration + system tests (Playwright), JaCoCo coverage, PITest mutation tests |

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
    ├── e2e/                          # Playwright system tests (TypeScript, one file per user story)
    │   └── helpers/                  # auth.ts — API-based login helper (injects JWT into localStorage)
    ├── playwright.config.ts          # Playwright config: baseURL, retries, Chromium project
    └── src/
        ├── api/                      # authApi.js, taskApi.js, projectApi.js, analyticsApi.js (Axios)
        ├── context/                  # AuthContext (JWT storage + auth state + timezone), TimerContext (shared active task state)
        ├── pages/                    # LoginPage, DashboardPage, TasksPage, ProjectsPage, ProjectDetailPage, OverviewPage, SettingsPage, AnalyticsPage
        ├── utils/                    # dateUtils.js — timezone-aware Intl API helpers (US-025)
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
- Runs all unit and integration tests against an in-memory H2 database

Expected output at the end:
```
Tests run: 428, Failures: 0, Errors: 0, Skipped: 0
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
> The H2 console is **disabled by default**. To enable it for a single run:
> ```bash
> ./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Dspring.h2.console.enabled=true"
> ```
> Then open http://localhost:8080/h2-console in your browser.
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
Test Files  12 passed (12)
     Tests  275 passed (275)
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
   - Open **Settings** to change your preferred time zone (choose from common IANA zones; all task times across the app update immediately) or to change your password.
   - Open **Analytics** in the navigation to see your productivity heatmap (GitHub-style activity grid colour-coded by tracked time) and day-of-week pattern chart. Use the year selector to browse historical years.

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

To also run JaCoCo line-coverage enforcement (≥ 90%):

```bash
./mvnw verify
```

To run mutation tests (PITest — ≥ 80% test strength on service unit tests):

```bash
./mvnw pitest:mutationCoverage
```

PITest targets all `com.timetracker.service.*` classes and runs against the Mockito-based service unit tests (no Spring context started). The test-strength metric measures killed/covered mutations (225/281 = 80%) against the 80% threshold. HTML report generated at `target/pit-reports/index.html`.



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
| `TaskServiceTest` | 37 | All task service operations including project association, date filtering, keyword search, projectId filter (unit); ArgumentCaptor tests kill setter/boundary/lambda mutations |
| `ProjectServiceTest` | 24 | All project service operations including member management (unit) |
| `ProjectSummaryControllerTest` | 9 | GET /projects/{id}/summary — date range, deduplication, subproject totals, 401/404 |
| `DashboardControllerTest` | 10 | GET /api/dashboard/summary — today/week totals, running task, top projects, cross-user isolation, 401 |
| `DashboardServiceTest` | 11 | Dashboard service unit — empty state, today/week aggregation, running task, top 5 limit, subtree time, user not found; weekStart=Monday assertion, budget usedHours/budgetPercent verification |
| `SecurityNfrTest` | 33 | NFR-001 Security: BCrypt hash format/salting, JWT 401 on all protected endpoints, tampered token, public endpoints, cross-user isolation (403/404 for tasks/projects), Bean Validation 400 (blank/invalid fields), SQL injection inputs handled safely |
| `DataPersistenceTest` | 11 | US-021 Data Persistence: tasks/projects survive logout+re-login, running timer accessible after re-auth, subproject hierarchy persists, task-project join persists, multi-task retrieval, cross-user isolation after re-login, schema auto-created on first boot |
| `UsabilityNfrTest` | 16 | NFR-003 Usability: field-level 400 errors have human-readable messages (register/login/createTask/createProject), 401/409 include `message`, start/stop timer each require exactly 1 API call, GET /tasks/active returns running task for topbar, 204 returned (not an error) when no timer is running |
| `LocalDeployabilityTest` | 15 | NFR-004 Local Deployability: health endpoint returns 200 with status UP (public), production config uses jdbc:h2:file: (file-based persistence), ddl-auto=update (data survives restarts), H2 console disabled by default, SPA fallback serves index.html for /dashboard/tasks/projects/5 routes, SPA controller ignores /api/ routes and static file paths, docker-compose.yml exists and defines backend+frontend services with a volume, application starts with no external dependencies |
| `PerformanceNfrTest` | 11 | NFR-002 Performance: DB indexes verified in INFORMATION_SCHEMA (tasks user+start, tasks user+endtime, projects user+parent, task_projects join columns), dashboard single-call returns all fields (today/week totals + running task + top projects), task list embeds project data per task (no follow-up calls), date-range list embeds projects, active task embeds projects |
| `ProjectSharingTest` | 17 | US-022 Project Sharing: invite returns 201 + MemberResponse, invitee sees project with shared=true, own project has shared=false, unknown email 404, duplicate 409, member associates task, non-member 404 on summary, remove member + loses access, owner self-remove 400, member edit/delete blocked 404, members list returns all fields, member can list members, non-member listMembers 404, time aggregation across users, invalid email 400, blank email 400 |
| `SharedProjectSummaryTest` | 12 | US-023 Task Overview: contributions array with per-user totals, tasks include userId/userName, ?userId= filter scopes tasks + total, contributions always full for dropdown, all-users default shows combined total, non-member 404, non-member userId 403, combined total = sum of contributions, member can access, task list userId filter, non-member userId 403, userId without projectId 403 |
| `ProjectExportTest` | 14 | US-024 Export: CSV attachment header + filename, CSV header row, task data in row, project name in projects column, JSON attachment header, JSON top-level structure, JSON task fields complete, subproject tasks included, hierarchy path "Root > Sub", year+month filter, empty date range returns header-only CSV, running timer without project excluded, non-member 404, no-auth 401 |
| `UserProfileTest` | 13 | US-025 Time Zones: GET profile returns all fields, default UTC timezone, 401 without auth, PUT valid IANA timezone, PUT persists timezone, invalid timezone 400, bogus timezone 400, displayName-only update, both fields update, login response includes timezone, register response defaults to UTC, timezone change does not affect createdAt, PUT 401 without auth |
| `ProjectBudgetTest` | 9 | US-026 Project Budgets: create with budgetHours, null budget allowed, ON_TRACK status (<80%), WARNING status (80–99%), OVER_BUDGET status (≥100%), update budget, null clears budget, shared project summary includes budget, listProjects includes budgetHours |
| `TaskTemplateTest` | 11 | US-027 Task Templates: create with all fields, no-description/no-project create, list returns only own templates, update name+desc+projects, delete returns 204, start-from-template creates running task with description+projects, start while running 409, cross-user isolation (PUT/DELETE/start on other's template → 404), multi-project template in list, 401 without auth, 400 blank name |
| `AnalyticsControllerTest` | 10 | US-028 Productivity Analytics: heatmap correct day + total seconds, multiple tasks same day aggregated, empty year returns empty days list, running timer excluded from heatmap, heatmap data scoped to authenticated user, heatmap 401 without auth, weekly pattern returns 7 entries MON–SUN, weekly pattern computes correct average for recent task, weekly pattern 401 without auth, weekly pattern data scoped to authenticated user |

### Backend — Checkstyle linter

```bash
cd backend
./mvnw checkstyle:check
```

Checks no-tab characters, standard Java naming conventions (UpperCamelCase types, lowerCamelCase methods/fields, UPPER_SNAKE_CASE constants), and a 250-character line limit. Zero violations. Also runs automatically as part of `./mvnw verify`.

### System tests (Playwright E2E)

Requires the full application to be running (either locally or via Docker Compose):

```bash
# Start the stack
docker compose up -d

# Run Playwright tests (from the frontend directory)
cd frontend
npx playwright test
```

Tests connect to `http://localhost:3000` (frontend) and `http://localhost:8080` (API for auth setup). Each test file covers the acceptance criteria of one user story.

| Test file | User story | What it covers |
|---|---|---|
| `us001-registration.spec.ts` | US-001 | Happy path (→ /dashboard), duplicate email error, empty form validation, password mismatch, short password |
| `us002-login.spec.ts` | US-002 | Valid credentials → /dashboard, wrong password generic error, non-existent email same error, empty form validation, protected route stays accessible after login, invalid token → /login |
| `us003-logout.spec.ts` | US-003 | Logout button → /login + localStorage cleared, /dashboard after logout → /login, /tasks after logout → /login, unauthenticated API call → 401 |

### Frontend

```bash
cd frontend
npx vitest run
```

| Test file | Count | What it covers |
|---|---|---|
| `LoginPage.test.jsx` | 17 | Register, login, tabs, error states; confirm-password field shown in register mode; client-side validation (password ≥ 8 chars, passwords match) blocks API call; field-level inline errors under each input (email, password, displayName, confirmPassword); clears on tab switch; general banner for non-validation errors |
| `DashboardPage.test.jsx` | 28 | Timer start/stop, active task display, summary cards (today/week), top projects list, running task info, refresh after timer actions; template list renders, Start button calls API, New Template form, create submit, edit form pre-fill, save edit, delete confirm dialog, project checkboxes in form |
| `SettingsPage.test.jsx` | 11 | Timezone selector renders with UTC default; change timezone; calls updateProfile on submit; success/error messages; success clears on change; common IANA zones in dropdown; change password form, error display |
| `dateUtils.test.js` | 22 | formatInZone (empty input, valid ISO, invalid tz fallback); toDatetimeLocalInTz (empty, UTC, Berlin, Kolkata, NY, day boundary); nowInTz (format); getDateStrInTz (empty, UTC, Kolkata next-day, NY prev-day); todayInTz (shape, consistency); localDateToUtcIso (UTC, Berlin, Kolkata, NY, round-trips UTC/Berlin/Kolkata) |
| `TasksPage.test.jsx` | 30 | Create, edit, delete tasks; project multi-select on create/edit; project display in task row; field-level error extraction from 400 responses; Add Task button reachable in 1 click |
| `ProjectsPage.test.jsx` | 30 | Create, edit, delete projects; tree view; collapse; force delete dialog; field-level error extraction from 400 responses; New Project button reachable in 1 click; shared badge shown for shared=true projects; no badge for owned projects; budget field in create/edit forms; budget bar colour-coded (green/orange/red); over-budget badge; no bar when no budget |
| `OverviewPage.test.jsx` | 48 | Week view (day/week totals, nav, task grouping, click); month view (calendar cells, day totals, month total, selected-day panel, nav, loading) |
| `ProjectDetailPage.test.jsx` | 51 | Date-range presets, custom range form, project name/desc/total, subproject totals, task list, running task, error states, back navigation; members section rendered; member list shows name+email+role; invite form visible to owner only; invite API called with correct email; invite error shown; remove button only for MEMBER rows; removeMember API called; member count in header; contributors card for shared projects; no contributors card for solo; user-filter dropdown shown; dropdown change re-fetches with userId; task owner name on shared rows; no owner name for solo; Export button renders; modal opens/closes; format radios (CSV/JSON); scope radios (All Time/Specific Month); year+month inputs appear for month scope; Download calls exportProject API and triggers blob download; JSON format passes correct param; month scope passes year+month params; error shown when export fails |
| `Layout.test.jsx` | 14 | Topbar timer visible/hidden, elapsed from startTime, timer on all pages, API called once on mount |
| `TasksPage.test.jsx (filter)` | 10 | Filter panel rendered, search debounce, project filter, date range, no-results message, reset |
| `AnalyticsPage.test.jsx` | 11 | Analytics page renders, heatmap grid present, heatmap cells for days with data, year selector shows current year, year change triggers re-fetch, weekly pattern chart renders, 7 day-of-week bars MON–SUN, non-zero bar height for active days, heatmap legend rendered, correct cell color for high activity, tooltip title attribute on cells |

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
| POST | `/api/auth/register` | `{email, password, displayName}` | 201 | Creates account; returns JWT + timezone (default "UTC") |
| POST | `/api/auth/login` | `{email, password}` | 200 `{token, email, displayName, timezone}` | Returns JWT with user's current timezone |
| POST | `/api/auth/change-password` | `{currentPassword, newPassword}` | 204 | — |

### User Profile (US-025)

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/users/profile` | — | 200 `UserProfileResponse` | Returns id, email, displayName, timezone, createdAt |
| PUT | `/api/users/profile` | `{displayName?, timezone?}` | 200 `UserProfileResponse` | Both fields optional; null = no change; invalid IANA timezone → 400 |

User profile response shape:
```json
{
  "id": 1,
  "email": "alice@example.com",
  "displayName": "Alice",
  "timezone": "Europe/Berlin",
  "createdAt": "2026-07-01T10:00:00Z"
}
```

### Tasks

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/tasks` | — | 200 `Task[]` | Optional: `?from=<ISO>&to=<ISO>` (date range), `?search=<text>` (description contains), `?projectId=<id>` (project + subtree), `?userId=<id>` (member's tasks — requires projectId, both must be members; 403 if non-member) |
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

### Task Templates (US-027)

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/task-templates` | — | 200 `TemplateResponse[]` | List own templates, newest first |
| POST | `/api/task-templates` | `{name, description?, projectIds?}` | 201 `TemplateResponse` | Create template; `name` required (max 100); `projectIds` must be projects the user is a member of |
| PUT | `/api/task-templates/{id}` | `{name, description?, projectIds?}` | 200 `TemplateResponse` | Update template (own only; 404 if not found or not owner) |
| DELETE | `/api/task-templates/{id}` | — | 204 | Delete template (own only) |
| POST | `/api/task-templates/{id}/start` | — | 201 `TaskResponse` | Start a timer pre-filled with template description + projects; 409 if timer already running; 404 if wrong user |

Template response shape:
```json
{
  "id": 1,
  "name": "Daily Stand-Up",
  "description": "Morning sync meeting",
  "projects": [{"id": 2, "name": "Thesis"}],
  "createdAt": "2026-07-01T08:00:00Z"
}
```

### Analytics (US-028)

| Method | Path | Query params | Response | Notes |
|---|---|---|---|---|
| GET | `/api/analytics/heatmap` | `?year=<int>` (default: current year) | 200 `HeatmapResponse` | Returns total tracked seconds per calendar day for the given year (only days with > 0 seconds included); day boundaries use the user's preferred timezone |
| GET | `/api/analytics/weekly-pattern` | `?weeks=<int>` (default: 12) | 200 `WeeklyPatternResponse` | Returns average tracked seconds per day of week (MON–SUN) over the last N weeks |

Heatmap response shape:
```json
{
  "year": 2026,
  "days": [
    { "date": "2026-03-10", "totalSeconds": 7200 },
    { "date": "2026-03-11", "totalSeconds": 3600 }
  ]
}
```

Weekly pattern response shape:
```json
{
  "weeks": 12,
  "byDayOfWeek": [
    { "day": "MON", "avgSeconds": 5400.0 },
    { "day": "TUE", "avgSeconds": 3600.0 },
    { "day": "WED", "avgSeconds": 7200.0 },
    { "day": "THU", "avgSeconds": 4800.0 },
    { "day": "FRI", "avgSeconds": 2700.0 },
    { "day": "SAT", "avgSeconds": 900.0 },
    { "day": "SUN", "avgSeconds": 0.0 }
  ]
}
```

### Projects

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| GET | `/api/projects` | — | 200 `Project[]` | Returns root projects; includes owned AND shared projects; `shared: true` on invited projects |
| POST | `/api/projects` | `{name, description?, parentProjectId?, budgetHours?}` | 201 | Creates project or subproject; `budgetHours` is a positive decimal (e.g. `40.0`); null = no budget |
| PUT | `/api/projects/{id}` | `{name, description?, budgetHours?}` | 200 | Rename / re-describe / set budget (OWNER only); null `budgetHours` clears the budget |
| DELETE | `/api/projects/{id}` | — | 204 or 409 | 409 if associations exist; add `?force=true` to override (OWNER only) |
| GET | `/api/projects/{id}/summary` | — | 200 `ProjectSummaryResponse` | Any member can view; optional `?from=<ISO>&to=<ISO>` (date filter), `?userId=<id>` (filter tasks+total to one member; contributions always shows all; 403 if userId is not a member) |
| GET | `/api/projects/{id}/members` | — | 200 `Member[]` | Lists all members with role; accessible to any member |
| POST | `/api/projects/{id}/members` | `{email}` | 201 `Member` | Invite by email (OWNER only); 404 if unknown, 409 if duplicate |
| DELETE | `/api/projects/{id}/members/{userId}` | — | 204 | Remove member (OWNER only); 400 if owner tries to remove themselves |
| GET | `/api/projects/{id}/export` | — | 200 (file download) | Download tasks as CSV or JSON. Params: `?format=csv\|json` (default csv), `?from=<ISO>&to=<ISO>` (date range), `?year=<int>&month=<int>` (calendar month). Content-Disposition: attachment. Non-members receive 404. |

Project response shape:
```json
{
  "id": 5,
  "name": "Thesis",
  "description": "My master's thesis",
  "parentId": null,
  "subprojects": [
    {"id": 6, "name": "Literature Review", "subprojects": [], "totalSeconds": 3600, "createdAt": "...", "shared": false}
  ],
  "totalSeconds": 7200,
  "createdAt": "2026-06-01T09:00:00Z",
  "shared": false,
  "budgetHours": 40.0
}
```

Project summary response includes additional budget fields (US-026):
```json
{
  "budgetHours": 40.0,
  "usedHours": 36.5,
  "budgetPercent": 91.25,
  "budgetStatus": "WARNING"
}
```

Member response shape:
```json
{
  "userId": 2,
  "email": "bob@example.com",
  "displayName": "Bob",
  "role": "MEMBER",
  "joinedAt": "2026-07-01T10:00:00Z"
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
- **Project sharing membership model (US-022)** — a separate `project_members` table stores `(project_id, user_id, role, joined_at)` with a unique constraint on `(project_id, user_id)`. `project.user_id` is kept as the original owner FK for backward compatibility. Access checks use the membership table: `findByIdAndMember` for read operations (any member), `findByIdAndUser` for write operations (owner only). `MembershipSeeder` runs on startup to back-fill OWNER rows for all projects created before this feature was added. `UserNotFoundException` (plain `RuntimeException`) is used instead of Spring Security's `UsernameNotFoundException` when the invitee email is not registered, to prevent the exception from being intercepted by Spring Security's exception handling as a 401.
- **Timezone display without a library (US-025)** — all timezone conversion uses the built-in `Intl.DateTimeFormat` API (`Intl.DateTimeFormat`, `formatToParts`, `en-CA` locale for deterministic `YYYY-MM-DD` output). `localDateToUtcIso` converts a "local" datetime-local input value to UTC using a naive-UTC + offset-measurement approach: treat the input as UTC, measure the offset the target timezone shows for that UTC instant, apply the correction. One iteration is accurate for all standard and DST zones. The `timezone` column on the `User` entity defaults to `"UTC"` so pre-existing accounts work without migration. IANA timezone IDs are validated at the Spring layer using `ZoneId.of()`, which throws `DateTimeException` on unrecognised strings; `GlobalExceptionHandler` catches `InvalidTimezoneException` and returns HTTP 400.
- **Task templates (US-027)** — `TaskTemplate` is a separate JPA entity (`task_templates` table) owned by a `User` with a `@ManyToMany` to `Project` via a `template_projects` join table. `startFromTemplate` delegates to `TaskService.startTask(userEmail, request, projectIds)` — an overloaded method added to `TaskService` so that `startTask` called from `TaskController` (no projects) and from templates (with projects) share the same 409-if-running logic without duplication. Ownership is enforced via `findByIdAndUser` — callers from other users get a 404 (not a 403) to avoid leaking template existence. Project associations on a template are resolved with `findByIdAndMember` so users can only link projects they are members of (preventing association with arbitrary project IDs). Deleting a template clears its project join-table entries before the delete to avoid FK constraint violations.
- **Project time budgets (US-026)** — `budgetHours` is a nullable `Double` column on the `Project` entity. `ProjectService.computeBudgetStatus(budgetHours, usedHours)` is a `static` helper so both `ProjectService.getProjectSummary` and `DashboardService` can compute budget status without a circular dependency. Budget percentage is capped at 100% for the visual progress bar (the label still shows the true percentage). The three status values (`ON_TRACK`, `WARNING`, `OVER_BUDGET`) are thresholded at 80% and 100% and used by the frontend to select the bar colour and optional "Over budget" badge. Budget usage is always an all-time aggregate of the full project subtree across all members (i.e. it is independent of the date-range filter on the summary).
- **Per-user contribution breakdown (US-023)** — `ProjectSummaryResponse` now carries a `contributions` list (per-user totals) and `userId`/`userName` on every `TaskSummary` entry. `getProjectSummary` collects all task entities from the subtree via `collectSubtreeTaskEntities` (deduplication by task id), groups them by `Task.user` for contributions, and optionally filters `tasks` + `totalSeconds` when `?userId=` is present. The `contributions` array is always the full per-user breakdown regardless of the user filter, so the frontend dropdown remains functional. `AccessDeniedException` (403) is thrown when the `userId` param belongs to a non-member. The same `userId` filter on `GET /api/tasks` validates that both the caller and the target user are project members using `projectRepository.findByIdAndMember(projectId, targetUser)` — no new repository dependency needed in `TaskService`.
- **Productivity analytics (US-028)** — `AnalyticsService` uses `findByUserAndStartTimeBetweenOrderByStartTimeAsc` (the same repository method used by daily/weekly views) for both heatmap and weekly-pattern queries, reusing the existing index on `(user_id, start_time)` with no new indexes needed. Heatmap year boundaries are computed as `ZonedDateTime.of(year, 1, 1, 0, 0, 0, 0, zone).toInstant()` using the user's IANA timezone (US-025), so users in e.g. `America/New_York` see the correct day split. Running tasks (endTime = null) and zero-second tasks are excluded. The weekly-pattern range is a rolling window: `Instant.now().minus(weeks * 7, ChronoUnit.DAYS)` — it always covers the most recent N full weeks regardless of the current day. Average is computed as `total / weeks` (not `total / distinct-days-with-data`), giving a true per-week average. Frontend heatmap: `buildHeatmapCells` creates a flat cell array padded to complete weeks using `(Jan1.getDay() + 6) % 7` (converts JS Sunday=0 to Monday=0), then rendered via a CSS `grid-template-rows: repeat(7, 14px); grid-auto-flow: column` grid — this naturally produces week columns from a flat row-major array.
