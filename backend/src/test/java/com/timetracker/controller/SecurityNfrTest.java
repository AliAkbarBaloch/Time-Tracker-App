package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.entity.User;
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
 * NFR-001 Security verification.
 * Covers: BCrypt storage, JWT auth on all endpoints, cross-user isolation (403/404),
 * Bean Validation (400), SQL-injection inputs handled safely.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityNfrTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwtA;
    private String jwtB;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        register("userA@example.com", "passwordAAA1", "User A");
        register("userB@example.com", "passwordBBB1", "User B");
        jwtA = login("userA@example.com", "passwordAAA1");
        jwtB = login("userB@example.com", "passwordBBB1");
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
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private long createTask(String jwt, Instant start, Instant end) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("description", "test task");
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
        body.put("description", null);
        body.put("parentProjectId", null);
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    // ── AC: Password never stored as plain text (BCrypt) ─────────────────

    @Test
    void bcrypt_passwordStoredAsHash_notPlainText() {
        User user = userRepository.findByEmail("userA@example.com").orElseThrow();
        String hash = user.getPasswordHash();
        assertThat(hash).startsWith("$2a$").doesNotContain("passwordAAA1");
    }

    @Test
    void bcrypt_hashStartsWithBcryptPrefix() {
        User user = userRepository.findByEmail("userB@example.com").orElseThrow();
        assertThat(user.getPasswordHash()).startsWith("$2a$");
    }

    @Test
    void bcrypt_twoUsersWithSamePassword_haveDistinctHashes() throws Exception {
        register("c@example.com", "samePassword1", "C");
        register("d@example.com", "samePassword1", "D");
        String hashC = userRepository.findByEmail("c@example.com").orElseThrow().getPasswordHash();
        String hashD = userRepository.findByEmail("d@example.com").orElseThrow().getPasswordHash();
        assertThat(hashC).isNotEqualTo(hashD);
    }

    // ── AC: Protected endpoints return 401 without a valid JWT ────────────

    @Test
    void jwt_getTasksWithoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks")).andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_startTaskWithoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_stopTaskWithoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks/stop")).andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_createTaskWithoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/tasks")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_getProjectsWithoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects")).andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_createProjectWithoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/projects")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_getDashboardSummaryWithoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_changePasswordWithoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/auth/change-password")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_tamperedToken_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.tampered.signature"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_malformedToken_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    // ── AC: Public endpoints accessible without JWT ───────────────────────

    @Test
    void jwt_registerEndpoint_isPublic() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("pub@example.com", "password99", "Pub"))))
                .andExpect(status().isCreated());
    }

    @Test
    void jwt_loginEndpoint_isPublic() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("userA@example.com", "passwordAAA1"))))
                .andExpect(status().isOk());
    }

    // ── AC: User A cannot read/modify User B's tasks ──────────────────────

    @Test
    void ownership_userBCannotEditUserATask_returns403() throws Exception {
        Instant start = Instant.parse("2026-06-01T09:00:00Z");
        Instant end   = Instant.parse("2026-06-01T10:00:00Z");
        long taskId = createTask(jwtA, start, end);

        Map<String, Object> updateBody = new HashMap<>();
        updateBody.put("description", "hacked");
        updateBody.put("startTime", start.toString());
        updateBody.put("endTime", end.toString());
        updateBody.put("projectIds", null);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwtB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownership_userBCannotDeleteUserATask_returns403() throws Exception {
        Instant start = Instant.parse("2026-06-01T11:00:00Z");
        Instant end   = Instant.parse("2026-06-01T12:00:00Z");
        long taskId = createTask(jwtA, start, end);

        mockMvc.perform(delete("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwtB))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownership_userACanEditOwnTask() throws Exception {
        Instant start = Instant.parse("2026-06-01T13:00:00Z");
        Instant end   = Instant.parse("2026-06-01T14:00:00Z");
        long taskId = createTask(jwtA, start, end);

        Map<String, Object> updateBody = new HashMap<>();
        updateBody.put("description", "updated");
        updateBody.put("startTime", start.toString());
        updateBody.put("endTime", end.toString());
        updateBody.put("projectIds", null);

        mockMvc.perform(put("/api/tasks/" + taskId)
                .header("Authorization", "Bearer " + jwtA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isOk());
    }

    @Test
    void ownership_userBCannotEditUserAProject_returns404() throws Exception {
        long projectId = createProject(jwtA, "Secret Project");

        Map<String, Object> updateBody = new HashMap<>();
        updateBody.put("name", "Hacked");
        updateBody.put("description", null);

        mockMvc.perform(put("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwtB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateBody)))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownership_userBCannotDeleteUserAProject_returns404() throws Exception {
        long projectId = createProject(jwtA, "Secret Project 2");

        mockMvc.perform(delete("/api/projects/" + projectId)
                .header("Authorization", "Bearer " + jwtB))
                .andExpect(status().isNotFound());
    }

    @Test
    void ownership_taskListReturnsOnlyOwnTasks() throws Exception {
        Instant start = Instant.parse("2026-06-01T15:00:00Z");
        Instant end   = Instant.parse("2026-06-01T16:00:00Z");
        createTask(jwtA, start, end);

        // User B lists tasks — should get empty list, not User A's task
        MvcResult r = mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwtB))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString()).size()).isZero();
    }

    @Test
    void ownership_projectListReturnsOnlyOwnProjects() throws Exception {
        createProject(jwtA, "Only For A");

        MvcResult r = mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwtB))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(r.getResponse().getContentAsString()).size()).isZero();
    }

    // ── AC: Input validation returns 400 ─────────────────────────────────

    @Test
    void validation_registerWithBlankEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"\",\"password\":\"password123\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_registerWithInvalidEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"not-an-email\",\"password\":\"password123\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_registerWithShortPassword_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"x@x.com\",\"password\":\"short\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_registerWithBlankDisplayName_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"x@x.com\",\"password\":\"password123\",\"displayName\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_createTaskWithNullStartTime_returns400() throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwtA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"test\",\"startTime\":null,\"endTime\":\"2026-06-01T10:00:00Z\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_createTaskWithNullEndTime_returns400() throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwtA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"test\",\"startTime\":\"2026-06-01T09:00:00Z\",\"endTime\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_createProjectWithBlankName_returns400() throws Exception {
        mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwtA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"description\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validation_loginWithBlankEmail_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"\",\"password\":\"password123\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── AC: SQL injection inputs are safely handled ───────────────────────

    @Test
    void sqlInjection_inEmailField_treatedSafelyOrRejected() throws Exception {
        // Parameterised JPA queries prevent SQL injection; the input is either
        // rejected by @Email validation (400) or stored as a literal string.
        int status = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"x' OR '1'='1\",\"password\":\"password123\",\"displayName\":\"Hacker\"}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isIn(400, 409, 201); // 400 = validation, 201 = safely stored as literal
    }

    @Test
    void sqlInjection_inSearchParam_doesNotCrashAndReturnsEmpty() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Bearer " + jwtA)
                .param("search", "' OR 1=1; DROP TABLE tasks; --"))
                .andExpect(status().isOk())
                .andExpect(content().string("[]"));
    }

    @Test
    void sqlInjection_inProjectName_storedSafelyAsLiteral() throws Exception {
        // JPA uses parameterised queries so injection payloads are stored literally
        mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwtA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"'; DROP TABLE projects; --\",\"description\":null}"))
                .andExpect(status().isCreated());

        // Tables still intact — we can still list projects
        mockMvc.perform(get("/api/projects")
                .header("Authorization", "Bearer " + jwtA))
                .andExpect(status().isOk());
    }

    // ── JwtAuthFilter: Authorization header present but not "Bearer " prefix ──

    @Test
    void jwt_authorizationHeaderWithoutBearerPrefix_returns401() throws Exception {
        // The header exists (StringUtils.hasText → true) but doesn't start with "Bearer "
        // so extractToken() returns null → request is treated as unauthenticated
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Token " + jwtA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void jwt_authorizationHeaderWithBasicScheme_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks")
                .header("Authorization", "Basic dXNlcjpwYXNz"))
                .andExpect(status().isUnauthorized());
    }
}
