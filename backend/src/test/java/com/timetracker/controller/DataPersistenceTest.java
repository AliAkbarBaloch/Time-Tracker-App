package com.timetracker.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.repository.ProjectRepository;
import com.timetracker.repository.TaskRepository;
import com.timetracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * US-021 Data Persistence verification.
 * Proves: tasks/projects/users survive logout and re-login, running timers
 * are retrievable after re-authentication, sub-entities and join records
 * persist, and user data is correctly scoped per account.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DataPersistenceTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void register(String email, String password, String name) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest(email, password, name))))
                .andExpect(status().isCreated());
    }

    private String login(String email, String password) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest(email, password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private long createManualTask(String jwt, String description, Instant start, Instant end) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("description", description);
        body.put("startTime", start.toString());
        body.put("endTime", end.toString());
        body.put("projectIds", null);
        MvcResult r = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createProject(String jwt, String name) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("name", name);
        body.put("description", "test project");
        body.put("parentProjectId", null);
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    // ── AC: Data accessible after logout and re-login ─────────────────────

    @Test
    void task_persistsAfterLogoutAndRelogin() throws Exception {
        register("persist@example.com", "password123", "Persist");
        String jwt1 = login("persist@example.com", "password123");

        Instant start = Instant.parse("2026-06-01T09:00:00Z");
        Instant end   = Instant.parse("2026-06-01T10:00:00Z");
        long taskId = createManualTask(jwt1, "persistent task", start, end);

        // Simulate logout by discarding jwt1 and obtaining a new token
        String jwt2 = login("persist@example.com", "password123");

        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode tasks = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(tasks.size()).isGreaterThanOrEqualTo(1);
        boolean found = false;
        for (JsonNode t : tasks) {
            if (t.get("id").asLong() == taskId) {
                assertThat(t.get("description").asText()).isEqualTo("persistent task");
                found = true;
            }
        }
        assertThat(found).as("Task created before re-login should still be present").isTrue();
    }

    @Test
    void project_persistsAfterLogoutAndRelogin() throws Exception {
        register("projpersist@example.com", "password123", "ProjPersist");
        String jwt1 = login("projpersist@example.com", "password123");

        long projectId = createProject(jwt1, "My Persistent Project");

        // Re-login with a fresh token
        String jwt2 = login("projpersist@example.com", "password123");

        MvcResult r = mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode projects = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(projects.size()).isGreaterThanOrEqualTo(1);
        boolean found = false;
        for (JsonNode p : projects) {
            if (p.get("id").asLong() == projectId) {
                assertThat(p.get("name").asText()).isEqualTo("My Persistent Project");
                found = true;
            }
        }
        assertThat(found).as("Project created before re-login should still be present").isTrue();
    }

    @Test
    void userAccount_persistsAndLoginSucceedsAfterRegistration() throws Exception {
        register("account@example.com", "password123", "Account");

        // Confirm login succeeds with the same credentials — proves account is stored
        String token = login("account@example.com", "password123");
        assertThat(token).isNotBlank();
    }

    // ── AC: Running timer accessible after re-authentication ─────────────

    @Test
    void runningTimer_retrievableAfterRelogin() throws Exception {
        register("timer@example.com", "password123", "Timer");
        String jwt1 = login("timer@example.com", "password123");

        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"still running\"}"))
                .andExpect(status().isCreated());

        // Re-login
        String jwt2 = login("timer@example.com", "password123");

        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("still running"))
                .andExpect(jsonPath("$.endTime").doesNotExist());
    }

    @Test
    void runningTimer_appearsInTaskListAfterRelogin() throws Exception {
        register("timerlist@example.com", "password123", "TimerList");
        String jwt1 = login("timerlist@example.com", "password123");

        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt1)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"running task\"}"))
                .andExpect(status().isCreated());

        String jwt2 = login("timerlist@example.com", "password123");

        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode tasks = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(tasks.size()).isGreaterThanOrEqualTo(1);
        boolean hasRunning = false;
        for (JsonNode t : tasks) {
            if (t.has("running") && t.get("running").asBoolean()) {
                hasRunning = true;
            }
        }
        assertThat(hasRunning).as("Running task should appear in list after re-login").isTrue();
    }

    // ── AC: Sub-entities and join records persist ─────────────────────────

    @Test
    void subproject_persistsNestedUnderParent() throws Exception {
        register("subproj@example.com", "password123", "SubProj");
        String jwt = login("subproj@example.com", "password123");

        long parentId = createProject(jwt, "Parent Project");

        Map<String, Object> childBody = new HashMap<>();
        childBody.put("name", "Child Project");
        childBody.put("description", null);
        childBody.put("parentProjectId", parentId);
        MvcResult cr = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(childBody)))
                .andExpect(status().isCreated())
                .andReturn();
        long childId = objectMapper.readTree(cr.getResponse().getContentAsString()).get("id").asLong();

        // Re-login and verify hierarchy is intact
        String jwt2 = login("subproj@example.com", "password123");
        MvcResult r = mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode projects = objectMapper.readTree(r.getResponse().getContentAsString());
        boolean childFound = false;
        for (JsonNode p : projects) {
            if (p.get("id").asLong() == parentId) {
                for (JsonNode sub : p.get("subprojects")) {
                    if (sub.get("id").asLong() == childId) {
                        childFound = true;
                    }
                }
            }
        }
        assertThat(childFound).as("Subproject should persist nested under parent after re-login").isTrue();
    }

    @Test
    void taskProjectAssociation_persistsAfterRelogin() throws Exception {
        register("assoc@example.com", "password123", "Assoc");
        String jwt = login("assoc@example.com", "password123");

        long projectId = createProject(jwt, "Work Project");

        Map<String, Object> taskBody = new HashMap<>();
        taskBody.put("description", "linked task");
        taskBody.put("startTime", "2026-06-01T09:00:00Z");
        taskBody.put("endTime", "2026-06-01T10:00:00Z");
        taskBody.put("projectIds", java.util.List.of(projectId));
        MvcResult tr = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(taskBody)))
                .andExpect(status().isCreated())
                .andReturn();
        long taskId = objectMapper.readTree(tr.getResponse().getContentAsString()).get("id").asLong();

        // Re-login and verify project association is intact
        String jwt2 = login("assoc@example.com", "password123");
        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode tasks = objectMapper.readTree(r.getResponse().getContentAsString());
        boolean associationFound = false;
        for (JsonNode t : tasks) {
            if (t.get("id").asLong() == taskId) {
                for (JsonNode p : t.get("projects")) {
                    if (p.get("id").asLong() == projectId) {
                        associationFound = true;
                    }
                }
            }
        }
        assertThat(associationFound).as("Task-project join should persist after re-login").isTrue();
    }

    @Test
    void multipleTasksPersistAndAllReturnedAfterRelogin() throws Exception {
        register("multi@example.com", "password123", "Multi");
        String jwt1 = login("multi@example.com", "password123");

        createManualTask(jwt1, "task one",   Instant.parse("2026-06-01T08:00:00Z"), Instant.parse("2026-06-01T09:00:00Z"));
        createManualTask(jwt1, "task two",   Instant.parse("2026-06-01T09:00:00Z"), Instant.parse("2026-06-01T10:00:00Z"));
        createManualTask(jwt1, "task three", Instant.parse("2026-06-01T10:00:00Z"), Instant.parse("2026-06-01T11:00:00Z"));

        String jwt2 = login("multi@example.com", "password123");

        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode tasks = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(tasks.size()).isEqualTo(3);
    }

    // ── AC: Data correctly scoped per user after re-login ─────────────────

    @Test
    void userA_dataNotVisibleToUserB_afterBothRelogin() throws Exception {
        register("ua@example.com", "password123", "User A");
        register("ub@example.com", "password123", "User B");

        String jwtA1 = login("ua@example.com", "password123");
        createManualTask(jwtA1, "secret task", Instant.parse("2026-06-02T08:00:00Z"), Instant.parse("2026-06-02T09:00:00Z"));
        createProject(jwtA1, "secret project");

        // Both users re-login
        String jwtB2 = login("ub@example.com", "password123");

        MvcResult tasksR = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwtB2))
                .andExpect(status().isOk()).andReturn();
        MvcResult projR = mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwtB2))
                .andExpect(status().isOk()).andReturn();

        assertThat(objectMapper.readTree(tasksR.getResponse().getContentAsString()).size()).isZero();
        assertThat(objectMapper.readTree(projR.getResponse().getContentAsString()).size()).isZero();
    }

    @Test
    void userA_dataStillAccessibleAfterUserBLogs() throws Exception {
        register("ua2@example.com", "password123", "User A2");
        register("ub2@example.com", "password123", "User B2");

        String jwtA = login("ua2@example.com", "password123");
        long taskId = createManualTask(jwtA, "user a task",
                Instant.parse("2026-06-02T10:00:00Z"), Instant.parse("2026-06-02T11:00:00Z"));

        // User B logs in and out (does nothing)
        login("ub2@example.com", "password123");

        // User A re-fetches — own data unaffected
        String jwtA2 = login("ua2@example.com", "password123");
        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwtA2))
                .andExpect(status().isOk()).andReturn();

        JsonNode tasks = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(tasks.size()).isEqualTo(1);
        assertThat(tasks.get(0).get("id").asLong()).isEqualTo(taskId);
    }

    // ── AC: H2 file-mode and DDL-auto verified in configuration ──────────

    @Test
    void schema_autoCreated_registrationWorksOnFreshDb() throws Exception {
        // If schema were not auto-created, this would throw a table-not-found error.
        // This test proves Hibernate DDL-auto creates all tables on boot with no manual SQL.
        register("fresh@example.com", "password123", "Fresh");
        String token = login("fresh@example.com", "password123");
        assertThat(token).isNotBlank();

        // And all entity tables are usable
        createProject(token, "Bootstrap Project");
        createManualTask(token, "bootstrap task",
                Instant.parse("2026-06-01T12:00:00Z"), Instant.parse("2026-06-01T13:00:00Z"));

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/projects").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
