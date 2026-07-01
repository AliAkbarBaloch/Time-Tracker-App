package com.timetracker.controller;

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
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DashboardControllerTest {

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
                        new RegisterRequest("dash@example.com", "password123", "Dash"))))
                .andExpect(status().isCreated());
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("dash@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();
    }

    private void createTask(String description, Instant start, Instant end) throws Exception {
        String body = objectMapper.writeValueAsString(
                new java.util.HashMap<String, Object>() {{
                    put("description", description);
                    put("startTime", start.toString());
                    put("endTime", end != null ? end.toString() : null);
                    put("projectIds", null);
                }});
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void getSummary_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getSummary_newUser_returnsZerosAndEmptyLists() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").value(0))
                .andExpect(jsonPath("$.weekSeconds").value(0))
                .andExpect(jsonPath("$.runningTask").doesNotExist())
                .andExpect(jsonPath("$.topProjects", hasSize(0)));
    }

    @Test
    void getSummary_withCompletedTaskToday_returnsTodayAndWeekSeconds() throws Exception {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        Instant start = now.withHour(9).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant end   = now.withHour(10).withMinute(0).withSecond(0).withNano(0).toInstant();
        createTask("morning work", start, end);

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").value(3600))
                .andExpect(jsonPath("$.weekSeconds").value(3600));
    }

    @Test
    void getSummary_runningTaskShownWhenPresent() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"in progress\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runningTask").isNotEmpty())
                .andExpect(jsonPath("$.runningTask.description").value("in progress"));
    }

    @Test
    void getSummary_runningTaskNotCountedInSeconds() throws Exception {
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"description\":\"running\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").value(0))
                .andExpect(jsonPath("$.weekSeconds").value(0));
    }

    @Test
    void getSummary_oldTaskNotCountedInToday() throws Exception {
        // task started yesterday
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        Instant yesterdayStart = now.minusDays(1).withHour(9).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant yesterdayEnd   = now.minusDays(1).withHour(10).withMinute(0).withSecond(0).withNano(0).toInstant();
        createTask("yesterday", yesterdayStart, yesterdayEnd);

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").value(0));
    }

    @Test
    void getSummary_topProjectsIncludesProjectWithWeekTime() throws Exception {
        // create project
        MvcResult pr = mockMvc.perform(post("/api/projects")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Alpha\",\"color\":\"#ff0000\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        long projectId = objectMapper.readTree(pr.getResponse().getContentAsString()).get("id").asLong();

        // create task this week associated with project
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        Instant start = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant end   = now.withHour(9).withMinute(30).withSecond(0).withNano(0).toInstant();
        String body = objectMapper.writeValueAsString(
                new java.util.HashMap<String, Object>() {{
                    put("description", "alpha task");
                    put("startTime", start.toString());
                    put("endTime", end.toString());
                    put("projectIds", java.util.List.of(projectId));
                }});
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topProjects", hasSize(1)))
                .andExpect(jsonPath("$.topProjects[0].name").value("Alpha"))
                .andExpect(jsonPath("$.topProjects[0].weekSeconds").value(5400));
    }

    @Test
    void getSummary_topProjectsLimitedToFive() throws Exception {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);

        for (int i = 1; i <= 7; i++) {
            final int idx = i;
            MvcResult pr = mockMvc.perform(post("/api/projects")
                    .header("Authorization", "Bearer " + jwt)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Project" + i + "\",\"color\":\"#ff0000\"}"))
                    .andExpect(status().isCreated())
                    .andReturn();
            long pid = objectMapper.readTree(pr.getResponse().getContentAsString()).get("id").asLong();

            Instant s = now.withHour(8).withMinute(0).withSecond(0).withNano(0).toInstant().plusSeconds(idx * 3600L);
            Instant e = s.plusSeconds(idx * 60L);
            String body = objectMapper.writeValueAsString(
                    new java.util.HashMap<String, Object>() {{
                        put("description", "task" + idx);
                        put("startTime", s.toString());
                        put("endTime", e.toString());
                        put("projectIds", java.util.List.of(pid));
                    }});
            mockMvc.perform(post("/api/tasks")
                    .header("Authorization", "Bearer " + jwt)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
                    .andExpect(status().isCreated());
        }

        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topProjects", hasSize(5)));
    }

    @Test
    void getSummary_responseHasExpectedFields() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").exists())
                .andExpect(jsonPath("$.weekSeconds").exists())
                .andExpect(jsonPath("$.topProjects").exists());
    }

    @Test
    void getSummary_twoUsersAreSeparated() throws Exception {
        // register second user
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("dash2@example.com", "password123", "Dash2"))))
                .andExpect(status().isCreated());
        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("dash2@example.com", "password123"))))
                .andReturn();
        String jwt2 = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();

        // user1 creates a task today
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        Instant start = now.withHour(9).withMinute(0).withSecond(0).withNano(0).toInstant();
        Instant end   = now.withHour(10).withMinute(0).withSecond(0).withNano(0).toInstant();
        createTask("user1 task", start, end);

        // user2 dashboard shows zero
        mockMvc.perform(get("/api/dashboard/summary")
                .header("Authorization", "Bearer " + jwt2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.todaySeconds").value(0))
                .andExpect(jsonPath("$.weekSeconds").value(0));
    }
}
