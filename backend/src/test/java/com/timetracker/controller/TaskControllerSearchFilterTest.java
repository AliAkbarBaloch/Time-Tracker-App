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
class TaskControllerSearchFilterTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;
    @Autowired ProjectRepository projectRepository;

    private String jwt;
    private Long projectId;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("filter@example.com", "password123", "Filter"))))
                .andExpect(status().isCreated());

        MvcResult login = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("filter@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(login.getResponse().getContentAsString()).get("token").asText();

        MvcResult proj = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Thesis", null, null))))
                .andExpect(status().isCreated())
                .andReturn();
        projectId = objectMapper.readTree(proj.getResponse().getContentAsString()).get("id").asLong();
    }

    private void createTask(String desc, Instant start, Instant end, List<Long> projectIds) throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest(desc, start, end, projectIds))))
                .andExpect(status().isCreated());
    }

    // ── No filter: existing behaviour preserved ───────────────

    @Test
    void listTasks_noFilter_returnsAll() throws Exception {
        Instant s = Instant.parse("2026-06-01T10:00:00Z");
        createTask("Task A", s, s.plusSeconds(3600), null);
        createTask("Task B", s.plusSeconds(7200), s.plusSeconds(10800), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    // ── Keyword search ────────────────────────────────────────

    @Test
    void listTasks_searchByKeyword_returnsMatchingTasks() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Read research paper", s, s.plusSeconds(1800), null);
        createTask("Write code", s.plusSeconds(3600), s.plusSeconds(7200), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("search", "research"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description", is("Read research paper")));
    }

    @Test
    void listTasks_searchIsCaseInsensitive() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Read Research Paper", s, s.plusSeconds(1800), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("search", "research"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void listTasks_searchNoMatch_returnsEmpty() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Write code", s, s.plusSeconds(1800), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("search", "nonexistent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ── Project filter ────────────────────────────────────────

    @Test
    void listTasks_filterByProjectId_returnsOnlyProjectTasks() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Thesis task", s, s.plusSeconds(1800), List.of(projectId));
        createTask("Unrelated task", s.plusSeconds(3600), s.plusSeconds(5400), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("projectId", projectId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description", is("Thesis task")));
    }

    @Test
    void listTasks_filterByProjectId_includesSubprojectTasks() throws Exception {
        MvcResult subR = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateProjectRequest("Literature", null, projectId))))
                .andExpect(status().isCreated()).andReturn();
        long subId = objectMapper.readTree(subR.getResponse().getContentAsString()).get("id").asLong();

        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Subproject task", s, s.plusSeconds(1800), List.of(subId));
        createTask("Unrelated", s.plusSeconds(3600), s.plusSeconds(5400), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("projectId", projectId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description", is("Subproject task")));
    }

    @Test
    void listTasks_projectIdNotFound_returns404() throws Exception {
        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("projectId", "99999"))
                .andExpect(status().isNotFound());
    }

    // ── Combined filters ──────────────────────────────────────

    @Test
    void listTasks_searchAndProjectCombined_andLogic() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("Thesis reading", s, s.plusSeconds(1800), List.of(projectId));
        createTask("Thesis writing", s.plusSeconds(3600), s.plusSeconds(5400), List.of(projectId));
        createTask("Other reading", s.plusSeconds(7200), s.plusSeconds(9000), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("search", "reading")
                .param("projectId", projectId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description", is("Thesis reading")));
    }

    @Test
    void listTasks_searchAndDateRange_combined() throws Exception {
        Instant s = Instant.parse("2026-06-10T09:00:00Z");
        createTask("June study", s, s.plusSeconds(1800), null);
        createTask("May study", Instant.parse("2026-05-01T09:00:00Z"),
                Instant.parse("2026-05-01T10:00:00Z"), null);

        mockMvc.perform(get("/api/tasks").header("Authorization", "Bearer " + jwt)
                .param("search", "study")
                .param("from", "2026-06-01T00:00:00Z")
                .param("to",   "2026-07-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].description", is("June study")));
    }

    // ── Auth ──────────────────────────────────────────────────

    @Test
    void listTasks_withSearch_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/tasks").param("search", "test"))
                .andExpect(status().isUnauthorized());
    }
}
