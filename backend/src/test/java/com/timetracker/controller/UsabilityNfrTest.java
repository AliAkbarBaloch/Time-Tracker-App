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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * NFR-003 Usability verification.
 * Verifies: validation errors are structured and field-level (not raw HTTP codes),
 * all error messages are human-readable strings, key navigation endpoints respond,
 * and the ≤ 2 click rule holds (start timer = 1 API call from dashboard).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UsabilityNfrTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("ux@example.com", "password123", "UX User"))))
                .andExpect(status().isCreated());

        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("ux@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    // ── AC: Field-level validation errors — not raw HTTP codes ────────────

    @Test
    void register_blankEmail_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"\",\"password\":\"password123\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("errors")).isTrue();
        assertThat(body.get("errors").has("email")).isTrue();
        String msg = body.get("errors").get("email").asText();
        assertThat(msg).isNotBlank().doesNotContain("400").doesNotContain("Bad Request");
    }

    @Test
    void register_invalidEmail_returns400WithHumanReadableMessage() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"notanemail\",\"password\":\"password123\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("errors")).isTrue();
        String emailError = body.get("errors").get("email").asText();
        assertThat(emailError).isNotBlank();
        // Must be a sentence, not a raw code
        assertThat(emailError).doesNotMatch("^[0-9]+$");
    }

    @Test
    void register_shortPassword_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"valid@x.com\",\"password\":\"short\",\"displayName\":\"Test\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.get("errors").has("password")).isTrue();
        assertThat(body.get("errors").get("password").asText()).isNotBlank();
    }

    @Test
    void register_blankDisplayName_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"valid@x.com\",\"password\":\"password123\",\"displayName\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.get("errors").has("displayName")).isTrue();
    }

    @Test
    void createProject_blankName_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"description\":null}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("errors")).isTrue();
        assertThat(body.get("errors").has("name")).isTrue();
        assertThat(body.get("errors").get("name").asText()).isNotBlank();
    }

    @Test
    void createTask_nullStartTime_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"test\",\"startTime\":null,\"endTime\":\"2026-06-01T10:00:00Z\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("errors")).isTrue();
        assertThat(body.get("errors").has("startTime")).isTrue();
        assertThat(body.get("errors").get("startTime").asText()).isNotBlank();
    }

    @Test
    void createTask_nullEndTime_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"test\",\"startTime\":\"2026-06-01T09:00:00Z\",\"endTime\":null}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.get("errors").has("endTime")).isTrue();
    }

    @Test
    void login_blankEmail_returns400WithFieldError() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"\",\"password\":\"password123\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("errors")).isTrue();
        assertThat(body.get("errors").has("email")).isTrue();
    }

    // ── AC: Error messages are human-readable, not raw HTTP codes ─────────

    @Test
    void wrongCredentials_returns401WithHumanReadableMessage() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"ux@example.com\",\"password\":\"wrongpassword\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("message")).isTrue();
        String msg = body.get("message").asText();
        assertThat(msg).isNotBlank().doesNotMatch("^[0-9]+$");
    }

    @Test
    void noToken_returns401WithHumanReadableMessage() throws Exception {
        MvcResult r = mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isUnauthorized())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("message")).isTrue();
        assertThat(body.get("message").asText()).isNotBlank();
    }

    @Test
    void duplicateEmail_returns409WithHumanReadableMessage() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("ux@example.com", "password123", "Duplicate"))))
                .andExpect(status().isConflict())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("message")).isTrue();
        assertThat(body.get("message").asText()).isNotBlank().doesNotMatch("^[0-9]+$");
    }

    @Test
    void invalidTimeRange_returns400WithHumanReadableMessage() throws Exception {
        MvcResult r = mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"test\",\"startTime\":\"2026-06-01T11:00:00Z\",\"endTime\":\"2026-06-01T09:00:00Z\"}"))
                .andExpect(status().isBadRequest())
                .andReturn();

        JsonNode body = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(body.has("message")).isTrue();
        assertThat(body.get("message").asText()).isNotBlank();
    }

    // ── AC: Start timer requires only 1 API call from dashboard ──────────

    @Test
    void startTimer_singleApiCall_returnsRunningTask() throws Exception {
        // Start timer is 1 click → 1 POST call — no pre-fetch required
        MvcResult r = mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"one click start\"}"))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode task = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(task.get("description").asText()).isEqualTo("one click start");
        assertThat(task.get("endTime").isNull()).isTrue();
    }

    @Test
    void stopTimer_singleApiCall_returnsCompletedTask() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"one click stop\"}"))
                .andExpect(status().isCreated());

        MvcResult r = mockMvc.perform(post("/api/tasks/stop")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode task = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(task.get("endTime").isNull()).isFalse();
    }

    // ── AC: Running timer always visible — active task API works ─────────

    @Test
    void activeTask_alwaysRetrievableFromAnyContext() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"always visible\"}"))
                .andExpect(status().isCreated());

        // GET /tasks/active returns the running task (used by topbar on every page load)
        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("always visible"))
                .andExpect(jsonPath("$.endTime").doesNotExist());
    }

    @Test
    void noActiveTask_returns204_notAnError() throws Exception {
        // When no timer is running, GET /active returns 204 (not an error)
        // so the topbar simply shows nothing — no broken state
        mockMvc.perform(get("/api/tasks/active")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNoContent());
    }
}
