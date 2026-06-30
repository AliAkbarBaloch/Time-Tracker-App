[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# TimeTracker

A full-stack time tracking web application for individuals (students, freelancers, researchers) to track time spent on projects, lectures, and activities.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.4, Spring Security, Spring Data JPA |
| Database | H2 (file-based, fully local — no external DB required) |
| Frontend | React 19, Vite, React Router, Axios |
| Auth | JWT (to be implemented) + BCrypt |

## Project Structure

```
.
├── docker-compose.yml    # Single-command full-stack deployment
├── backend/              # Spring Boot Maven project (Java 21)
│   ├── Dockerfile
│   └── src/main/java/com/timetracker/
│       ├── config/       # SecurityConfig, CorsConfig
│       ├── controller/   # REST controllers
│       ├── entity/       # JPA entities: User, Project, Task
│       └── repository/   # Spring Data repositories
└── frontend/             # React + Vite SPA (Node 24+)
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── pages/        # LoginPage, DashboardPage, ProjectsPage, OverviewPage
        └── components/   # Layout (topbar + navigation)
```

## Running with Docker Compose (recommended)

```bash
docker compose up --build
# Backend:  http://localhost:8080
# Frontend: http://localhost:3000
```

Data is persisted in a Docker volume (`timetracker-data`) across restarts.

## Running Locally (development)

### Prerequisites
- Java 21 or 25
- Node.js 24+

### Backend

```bash
cd backend
./mvnw spring-boot:run
# Starts on http://localhost:8080
# H2 console: http://localhost:8080/h2-console
#   JDBC URL: jdbc:h2:file:./data/timetracker
```

> If Java 21 is not your shell's default, set it explicitly:
> `JAVA_HOME="$(/usr/libexec/java_home -v 21)" ./mvnw spring-boot:run`

### Frontend

```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:3000
# /api/* is proxied to the backend on port 8080
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend health check |

## Current Status

Prototype skeleton — architecture and static mockups only. No authentication or business logic yet.
