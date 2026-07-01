package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.project.CreateProjectRequest;
import com.timetracker.dto.task.CreateTaskRequest;
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
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectSummaryControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;
    private String otherJwt;
    private Long projectId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        // Primary user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("summary@example.com", "password123", "Summary"))))
                .andExpect(status().isCreated());
        MvcResult r1 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("summary@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r1.getResponse().getContentAsString()).get("token").asText();

        // Secondary user (for ownership tests)
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("other@example.com", "password123", "Other"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("other@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        // Create a root project for the primary user
        MvcResult pr = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Thesis", "Research project", null, null))))
                .andExpect(status().isCreated())
                .andReturn();
        projectId = objectMapper.readTree(pr.getResponse().getContentAsString()).get("id").asLong();
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private long createProject(String name, Long parentId) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest(name, null, parentId, null))))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    private void createTask(String desc, Instant start, Instant end, List<Long> projectIds) throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest(desc, start, end, projectIds))))
                .andExpect(status().isCreated());
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void getSummary_noDateRange_returnsProjectWithTasks() throws Exception {
        Instant start = Instant.parse("2026-06-01T10:00:00Z");
        Instant end   = Instant.parse("2026-06-01T11:00:00Z");
        createTask("Read paper", start, end, List.of(projectId));

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(projectId.intValue())))
                .andExpect(jsonPath("$.name", is("Thesis")))
                .andExpect(jsonPath("$.description", is("Research project")))
                .andExpect(jsonPath("$.totalSeconds", is(3600)))
                .andExpect(jsonPath("$.tasks", hasSize(1)))
                .andExpect(jsonPath("$.tasks[0].description", is("Read paper")));
    }

    @Test
    void getSummary_withDateRange_filtersTasksByStartTime() throws Exception {
        Instant inRange  = Instant.parse("2026-06-15T09:00:00Z");
        Instant outRange = Instant.parse("2026-05-01T09:00:00Z");
        createTask("In range",  inRange,  inRange.plusSeconds(1800), List.of(projectId));
        createTask("Out range", outRange, outRange.plusSeconds(1800), List.of(projectId));

        String from = "2026-06-01T00:00:00Z";
        String to   = "2026-07-01T00:00:00Z";

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt)
                .param("from", from).param("to", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks", hasSize(1)))
                .andExpect(jsonPath("$.tasks[0].description", is("In range")))
                .andExpect(jsonPath("$.totalSeconds", is(1800)));
    }

    @Test
    void getSummary_noTasksInRange_returnsZeroTotalAndEmptyList() throws Exception {
        Instant start = Instant.parse("2026-01-10T08:00:00Z");
        createTask("Old task", start, start.plusSeconds(3600), List.of(projectId));

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt)
                .param("from", "2026-06-01T00:00:00Z")
                .param("to",   "2026-07-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(0)))
                .andExpect(jsonPath("$.tasks", hasSize(0)));
    }

    @Test
    void getSummary_deduplicatesTasksSharedBetweenSiblingSubprojects() throws Exception {
        // Thesis → sub-A, sub-B (siblings); one task linked to BOTH siblings
        long subA = createProject("Sub-A", projectId);
        long subB = createProject("Sub-B", projectId);

        Instant start = Instant.parse("2026-06-10T08:00:00Z");
        createTask("Shared task", start, start.plusSeconds(7200), List.of(subA, subB));

        // Parent total must be 7200 (not 14400) — shared task counted only once
        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds", is(7200)))
                .andExpect(jsonPath("$.tasks", hasSize(1)));
    }

    @Test
    void getSummary_showsSubprojectIndividualTotals() throws Exception {
        long sub = createProject("Literature", projectId);

        Instant start = Instant.parse("2026-06-05T10:00:00Z");
        createTask("Sub task", start, start.plusSeconds(5400), List.of(sub));

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subprojects", hasSize(1)))
                .andExpect(jsonPath("$.subprojects[0].name", is("Literature")))
                .andExpect(jsonPath("$.subprojects[0].totalSeconds", is(5400)))
                .andExpect(jsonPath("$.totalSeconds", is(5400)));
    }

    @Test
    void getSummary_tasksAreSortedByStartTime() throws Exception {
        Instant first  = Instant.parse("2026-06-01T07:00:00Z");
        Instant second = Instant.parse("2026-06-01T09:00:00Z");
        createTask("Second", second, second.plusSeconds(1800), List.of(projectId));
        createTask("First",  first,  first.plusSeconds(1800),  List.of(projectId));

        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tasks[0].description", is("First")))
                .andExpect(jsonPath("$.tasks[1].description", is("Second")));
    }

    @Test
    void getSummary_projectNotFound_returns404() throws Exception {
        mockMvc.perform(get("/api/projects/{id}/summary", 99999L)
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void getSummary_otherUsersProject_returns404() throws Exception {
        // otherJwt user tries to read primary user's project
        mockMvc.perform(get("/api/projects/{id}/summary", projectId)
                .header("Authorization", "Bearer " + otherJwt))
                .andExpect(status().isNotFound());
    }

    @Test
    void getSummary_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects/{id}/summary", projectId))
                .andExpect(status().isUnauthorized());
    }
}
