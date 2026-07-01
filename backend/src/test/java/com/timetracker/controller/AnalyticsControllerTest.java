package com.timetracker.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timetracker.dto.auth.LoginRequest;
import com.timetracker.dto.auth.RegisterRequest;
import com.timetracker.dto.task.CreateTaskRequest;
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
import java.time.LocalDate;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnalyticsControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired TaskRepository taskRepository;

    private String jwt;
    private String otherJwt;

    @BeforeEach
    void setUp() throws Exception {
        taskRepository.deleteAll();
        userRepository.deleteAll();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("analytics@example.com", "password123", "AnalyticsUser"))))
                .andExpect(status().isCreated());

        MvcResult r = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("analytics@example.com", "password123"))))
                .andReturn();
        jwt = objectMapper.readTree(r.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new RegisterRequest("other@example.com", "password123", "OtherUser"))))
                .andExpect(status().isCreated());

        MvcResult r2 = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new LoginRequest("other@example.com", "password123"))))
                .andReturn();
        otherJwt = objectMapper.readTree(r2.getResponse().getContentAsString()).get("token").asText();
    }

    private void addTask(String token, Instant start, Instant end) throws Exception {
        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        new CreateTaskRequest("Task", start, end, null))))
                .andExpect(status().isCreated());
    }

    // ── Heatmap ───────────────────────────────────────────────────────────────

    @Test
    void heatmap_returnsCorrectDayAndTotalSeconds() throws Exception {
        // Task on 2026-03-10: 2h
        Instant start = Instant.parse("2026-03-10T08:00:00Z");
        Instant end   = Instant.parse("2026-03-10T10:00:00Z");
        addTask(jwt, start, end);

        mockMvc.perform(get("/api/analytics/heatmap?year=2026")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.days", hasSize(1)))
                .andExpect(jsonPath("$.days[0].date").value("2026-03-10"))
                .andExpect(jsonPath("$.days[0].totalSeconds").value(7200));
    }

    @Test
    void heatmap_aggregatesMultipleTasksSameDay() throws Exception {
        addTask(jwt, Instant.parse("2026-05-01T08:00:00Z"), Instant.parse("2026-05-01T09:00:00Z")); // 1h
        addTask(jwt, Instant.parse("2026-05-01T10:00:00Z"), Instant.parse("2026-05-01T11:30:00Z")); // 1.5h

        mockMvc.perform(get("/api/analytics/heatmap?year=2026")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days", hasSize(1)))
                .andExpect(jsonPath("$.days[0].date").value("2026-05-01"))
                .andExpect(jsonPath("$.days[0].totalSeconds").value(9000)); // 2.5h
    }

    @Test
    void heatmap_emptyYearReturnsEmptyDaysList() throws Exception {
        mockMvc.perform(get("/api/analytics/heatmap?year=2020")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2020))
                .andExpect(jsonPath("$.days", hasSize(0)));
    }

    @Test
    void heatmap_omitsRunningTaskWithNoEndTime() throws Exception {
        // Start a timer (no end time)
        mockMvc.perform(post("/api/tasks/start")
                .header("Authorization", "Bearer " + jwt)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/analytics/heatmap?year=" + LocalDate.now().getYear())
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days", hasSize(0)));
    }

    @Test
    void heatmap_dataScopedToAuthenticatedUser() throws Exception {
        // Other user adds a task in 2026
        addTask(otherJwt, Instant.parse("2026-06-15T08:00:00Z"), Instant.parse("2026-06-15T09:00:00Z"));

        // Authenticated user has no tasks
        mockMvc.perform(get("/api/analytics/heatmap?year=2026")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days", hasSize(0)));
    }

    @Test
    void heatmap_returns401WithoutAuth() throws Exception {
        mockMvc.perform(get("/api/analytics/heatmap?year=2026"))
                .andExpect(status().isUnauthorized());
    }

    // ── Weekly pattern ────────────────────────────────────────────────────────

    @Test
    void weeklyPattern_returns7EntriesMonToSun() throws Exception {
        mockMvc.perform(get("/api/analytics/weekly-pattern?weeks=12")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks").value(12))
                .andExpect(jsonPath("$.byDayOfWeek", hasSize(7)))
                .andExpect(jsonPath("$.byDayOfWeek[0].day").value("MON"))
                .andExpect(jsonPath("$.byDayOfWeek[1].day").value("TUE"))
                .andExpect(jsonPath("$.byDayOfWeek[2].day").value("WED"))
                .andExpect(jsonPath("$.byDayOfWeek[3].day").value("THU"))
                .andExpect(jsonPath("$.byDayOfWeek[4].day").value("FRI"))
                .andExpect(jsonPath("$.byDayOfWeek[5].day").value("SAT"))
                .andExpect(jsonPath("$.byDayOfWeek[6].day").value("SUN"));
    }

    @Test
    void weeklyPattern_computesCorrectAverageForRecentTask() throws Exception {
        // Task today: 1h (3600 seconds). Average over 1 week should be 3600/1 = 3600
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(60);
        addTask(jwt, start, end);

        mockMvc.perform(get("/api/analytics/weekly-pattern?weeks=1")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byDayOfWeek", hasSize(7)))
                .andExpect(jsonPath("$.byDayOfWeek[*].avgSeconds",
                        hasItem(closeTo(3540.0, 60.0)))); // ~3540 ± 60s
    }

    @Test
    void weeklyPattern_returns401WithoutAuth() throws Exception {
        mockMvc.perform(get("/api/analytics/weekly-pattern"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void weeklyPattern_dataScopedToAuthenticatedUser() throws Exception {
        // Other user has tasks; main user has none
        Instant start = Instant.now().minusSeconds(3600);
        Instant end   = Instant.now().minusSeconds(60);
        addTask(otherJwt, start, end);

        mockMvc.perform(get("/api/analytics/weekly-pattern?weeks=1")
                .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byDayOfWeek[*].avgSeconds", everyItem(is(0.0))));
    }
}
