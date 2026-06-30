[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# TimeTracker

A full-stack time tracking web application for individuals (students, freelancers, researchers) to track time spent on projects, lectures, and activities.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 3.4, Spring Security, Spring Data JPA |
| Database | H2 (file-based, local persistence) |
| Frontend | React 18, Vite, React Router, Axios |
| Auth | JWT (to be implemented) + BCrypt |

## Project Structure

```
.
├── backend/          # Spring Boot Maven project
│   ├── src/main/java/com/timetracker/
│   │   ├── config/       # SecurityConfig, CorsConfig
│   │   ├── controller/   # REST controllers
│   │   ├── entity/       # JPA entities: User, Project, Task
│   │   └── repository/   # Spring Data repositories
│   └── src/main/resources/application.properties
└── frontend/         # React + Vite SPA
    └── src/
        ├── pages/    # LoginPage, DashboardPage, ProjectsPage, OverviewPage
        └── components/ # Layout (topbar + navigation)
```

## Running Locally

### Backend

```bash
cd backend
# Requires Java 21+
./mvnw spring-boot:run
# Starts on http://localhost:8080
# H2 console: http://localhost:8080/h2-console  (JDBC URL: jdbc:h2:file:./data/timetracker)
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:3000
# /api/* requests are proxied to the backend on port 8080
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend health check |

## Current Status

Prototype skeleton — architecture only. Static mockups for all main pages. No authentication or business logic yet.
